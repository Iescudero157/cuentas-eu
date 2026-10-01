// ---------------------------------------------------------------------------
// V11 · Análisis y validación del certificado del emisor (PKCS#12).
//
// El usuario sube el certificado tal y como lo exportan FNMT/Camerfirma/…
// (fichero .p12/.pfx protegido con contraseña). Aquí se:
//  1. Parsea y verifica la contraseña (node-forge: cubre tanto los PKCS#12
//     legados 3DES/RC2 como los modernos PBES2/AES de OpenSSL 3).
//  2. Extrae los METADATOS públicos (titular, NIF, validez, huella) para
//     validar caducidad y auditar sin tocar la clave privada.
//  3. Normaliza el material a PEM (clave PKCS#8 + cadena) cuando la clave es
//     RSA — el formato que node:tls acepta siempre —, o conserva el PKCS#12
//     original si no (p. ej. clave EC), y comprueba con createSecureContext
//     que Node podrá usarlo de verdad para el mTLS del art. 5 Orden
//     HAC/1177/2024.
//
// Este módulo es PURO (sin BD, sin red). La custodia cifrada vive en
// cert-store.ts y el modelo de amenazas en docs/verifactu/SEGURIDAD-CERTS.md.
// PROHIBIDO volcar a logs claves, passphrases o el propio PKCS#12.
// ---------------------------------------------------------------------------

import forge from 'node-forge'
import { createSecureContext } from 'node:tls'
import { createHash } from 'node:crypto'

import type { CertificadoCliente } from './aeat-cliente.ts'

// ---------------------------------------------------------------------------
// Errores tipados (mensajes SIN material criptográfico, aptos para UI)
// ---------------------------------------------------------------------------

export type CodigoErrorCertificado =
  | 'PKCS12_INVALIDO'
  | 'PASSPHRASE_INCORRECTA'
  | 'SIN_CLAVE'
  | 'SIN_CERTIFICADO'
  | 'CLAVE_NO_CORRESPONDE'
  | 'NO_UTILIZABLE'

export class ErrorCertificado extends Error {
  readonly codigo: CodigoErrorCertificado
  constructor(codigo: CodigoErrorCertificado, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorCertificado'
    this.codigo = codigo
  }
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface MetadatosCertificado {
  /** CN del sujeto (nombre visible del titular). */
  subjectCn: string
  /**
   * NIF del titular del certificado, del atributo serialNumber (2.5.4.5) del
   * sujeto — los certificados cualificados españoles usan «IDCES-<NIF>».
   */
  nifCertificado: string | null
  /**
   * NIF/CIF de la entidad representada, del organizationIdentifier (2.5.4.97)
   * — «VATES-<CIF>» en certificados de representante y de sello.
   */
  nifRepresentado: string | null
  emisorCn: string | null
  numeroSerie: string
  /** SHA-256 del certificado DER, 64 hex mayúsculas. */
  huellaSha256: string
  validoDesde: Date
  validoHasta: Date
}

/** Material listo para custodia (se cifra COMPLETO en cert-store). */
export type MaterialCustodia =
  | { formato: 'pem'; keyPem: string; certPem: string }
  | { formato: 'pfx'; pfxBase64: string; passphrase: string }

export interface CertificadoAnalizado {
  metadatos: MetadatosCertificado
  material: MaterialCustodia
}

// ---------------------------------------------------------------------------
// Caducidad
// ---------------------------------------------------------------------------

/** Antelación con la que se avisa de la renovación (FNMT permite renovar con 60 días). */
export const DIAS_AVISO_CADUCIDAD = 60

export type EstadoCaducidad = 'valido' | 'caduca_pronto' | 'caducado'

export function estadoCaducidad(
  validoHasta: Date,
  ahora: Date = new Date()
): { estado: EstadoCaducidad; diasRestantes: number } {
  const ms = validoHasta.getTime() - ahora.getTime()
  const diasRestantes = Math.floor(ms / 86_400_000)
  if (ms <= 0) return { estado: 'caducado', diasRestantes }
  if (diasRestantes < DIAS_AVISO_CADUCIDAD) return { estado: 'caduca_pronto', diasRestantes }
  return { estado: 'valido', diasRestantes }
}

// ---------------------------------------------------------------------------
// Extracción de NIF de los atributos X.509 españoles
// ---------------------------------------------------------------------------

const OID_SERIAL_NUMBER = '2.5.4.5'
const OID_ORG_IDENTIFIER = '2.5.4.97'

/** «IDCES-12345678Z» / «VATES-B98407901» / «12345678Z» → NIF de 9, o null. */
export function nifDeAtributo(valor: string | null | undefined): string | null {
  if (!valor) return null
  const limpio = valor.trim().toUpperCase().replace(/^(IDCES|VATES)[-:]?/, '')
  return /^[A-Z0-9]{9}$/.test(limpio) ? limpio : null
}

type CampoX509 = { value?: unknown } | null | undefined

function textoCampo(campo: CampoX509): string | null {
  const v = campo && typeof campo === 'object' ? campo.value : null
  return typeof v === 'string' && v.length > 0 ? v : null
}

// ---------------------------------------------------------------------------
// Análisis del PKCS#12
// ---------------------------------------------------------------------------

function abrirPkcs12(pfx: Buffer, passphrase: string): forge.pkcs12.Pkcs12Pfx {
  let asn1: forge.asn1.Asn1
  try {
    asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString('binary')))
  } catch {
    throw new ErrorCertificado('PKCS12_INVALIDO', 'El fichero no es un PKCS#12 válido (.p12/.pfx)')
  }
  try {
    return forge.pkcs12.pkcs12FromAsn1(asn1, false, passphrase)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/password|mac/i.test(msg)) {
      throw new ErrorCertificado('PASSPHRASE_INCORRECTA', 'La contraseña del certificado no es correcta')
    }
    throw new ErrorCertificado('PKCS12_INVALIDO', 'El fichero no es un PKCS#12 válido o usa un cifrado no soportado')
  }
}

function metadatosDeCert(cert: forge.pki.Certificate): MetadatosCertificado {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  const huellaSha256 = createHash('sha256')
    .update(Buffer.from(der, 'binary'))
    .digest('hex')
    .toUpperCase()
  return {
    subjectCn:
      textoCampo(cert.subject.getField('CN')) ??
      textoCampo(cert.subject.getField({ type: OID_SERIAL_NUMBER })) ??
      '(sin CN)',
    nifCertificado: nifDeAtributo(textoCampo(cert.subject.getField({ type: OID_SERIAL_NUMBER }))),
    nifRepresentado: nifDeAtributo(textoCampo(cert.subject.getField({ type: OID_ORG_IDENTIFIER }))),
    emisorCn: textoCampo(cert.issuer.getField('CN')),
    numeroSerie: cert.serialNumber.toUpperCase(),
    huellaSha256,
    validoDesde: cert.validity.notBefore,
    validoHasta: cert.validity.notAfter,
  }
}

/** ¿La clave RSA corresponde al certificado? (mismo módulo n). */
function claveCorresponde(cert: forge.pki.Certificate, key: forge.pki.rsa.PrivateKey): boolean {
  const pub = cert.publicKey as Partial<forge.pki.rsa.PublicKey>
  return Boolean(pub?.n && key.n && pub.n.compareTo(key.n) === 0)
}

/**
 * Analiza un PKCS#12: verifica la contraseña, extrae metadatos y devuelve el
 * material normalizado y COMPROBADO (createSecureContext) para el mTLS.
 * No aplica política temporal: la caducidad la juzga quien llama con
 * `estadoCaducidad` (aquí solo se leen las fechas).
 */
export function analizarPkcs12(pfx: Buffer, passphrase: string): CertificadoAnalizado {
  const p12 = abrirPkcs12(pfx, passphrase)

  const bolsasCert = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []
  const certs = bolsasCert.map((b) => b.cert).filter((c): c is forge.pki.Certificate => Boolean(c))
  if (certs.length === 0) {
    throw new ErrorCertificado('SIN_CERTIFICADO', 'El PKCS#12 no contiene ningún certificado')
  }

  const bolsasClave = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ]
  if (bolsasClave.length === 0) {
    throw new ErrorCertificado('SIN_CLAVE', 'El PKCS#12 no contiene la clave privada')
  }

  const claveRsa = bolsasClave.find((b) => b.key)?.key as forge.pki.rsa.PrivateKey | undefined

  let hoja: forge.pki.Certificate
  let material: MaterialCustodia

  if (claveRsa?.n) {
    // Clave RSA parseada: normalizamos a PEM (PKCS#8 + cadena hoja-primero)
    const candidata = certs.find((c) => claveCorresponde(c, claveRsa))
    if (!candidata) {
      throw new ErrorCertificado(
        'CLAVE_NO_CORRESPONDE',
        'La clave privada del PKCS#12 no corresponde a ninguno de sus certificados'
      )
    }
    hoja = candidata
    const keyPem = forge.pki.privateKeyInfoToPem(
      forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(claveRsa))
    )
    const cadena = [hoja, ...certs.filter((c) => c !== hoja)]
    material = { formato: 'pem', keyPem, certPem: cadena.map((c) => forge.pki.certificateToPem(c)).join('') }
  } else {
    // Clave no-RSA (p. ej. EC): forge no la re-exporta; se custodia el PKCS#12
    // original y Node lo abrirá directamente (se comprueba justo debajo).
    hoja =
      certs.find((c) => !certs.some((o) => o !== c && o.issuer.hash === c.subject.hash)) ?? certs[0]
    material = { formato: 'pfx', pfxBase64: pfx.toString('base64'), passphrase }
  }

  // Prueba de fuego: ¿acepta Node (OpenSSL) este material para TLS cliente?
  try {
    if (material.formato === 'pem') {
      createSecureContext({ cert: material.certPem, key: material.keyPem })
    } else {
      createSecureContext({ pfx, passphrase })
    }
  } catch {
    throw new ErrorCertificado(
      'NO_UTILIZABLE',
      'El certificado se pudo leer pero el runtime TLS no lo acepta (algoritmo no soportado); expórtelo de nuevo en un formato moderno'
    )
  }

  return { metadatos: metadatosDeCert(hoja), material }
}

// ---------------------------------------------------------------------------
// Material de custodia ⇄ cliente AEAT
// ---------------------------------------------------------------------------

/** Serializa el material para cifrarlo como UN único sobre. */
export function serializarMaterial(material: MaterialCustodia): Buffer {
  return Buffer.from(JSON.stringify(material), 'utf8')
}

export function deserializarMaterial(claro: Buffer): MaterialCustodia {
  const m = JSON.parse(claro.toString('utf8')) as MaterialCustodia
  if (m.formato !== 'pem' && m.formato !== 'pfx') {
    throw new ErrorCertificado('PKCS12_INVALIDO', 'Material custodiado con formato desconocido')
  }
  return m
}

/** Convierte el material custodiado en el certificado que consume ClienteAeat (V09). */
export function materialParaCliente(material: MaterialCustodia): CertificadoCliente {
  if (material.formato === 'pem') {
    return { cert: material.certPem, key: material.keyPem }
  }
  return { pfx: Buffer.from(material.pfxBase64, 'base64'), passphrase: material.passphrase }
}
