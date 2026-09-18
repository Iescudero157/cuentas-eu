// ---------------------------------------------------------------------------
// V09 · Cliente del servicio web AEAT «Sistemas Informáticos de Facturación»
// (operación RegFactuSistemaFacturacion, modalidad VERI*FACTU).
//
// Fuentes oficiales (descargadas de la sede AEAT, ver docs/verifactu/xsd/):
//  - SistemaFacturacion.wsdl → binding SOAP 1.1 document/literal, SOAPAction
//    vacío y endpoints por entorno/certificado (servicio sfVerifactu).
//  - SuministroLR.xsd / SuministroInformacion.xsd → mensaje de envío.
//  - RespuestaSuministro.xsd → respuesta (CSV, TiempoEsperaEnvio, estados).
// Protocolo: SOAP sobre HTTPS con autenticación mutua TLS (art. 5 Orden
// HAC/1177/2024). El certificado NO existe todavía en Kuentas: se inyecta
// por configuración (`CertificadoCliente`); su custodia se resuelve en V11.
//
// Este cliente hace UN envío y parsea UNA respuesta. La cadencia (respetar
// TiempoEsperaEnvio, acumular hasta 1000, reintentos con Incidencia=S) la
// gobierna el worker de la cola (V10) con los datos que aquí se devuelven.
// ---------------------------------------------------------------------------

import { request as httpsRequest, type RequestOptions } from 'node:https'

import { xmlRegFactuSistemaFacturacion, type CabeceraRemision } from './registro-alta.ts'
import {
  parsearXml,
  type ElementoXml,
  hijo,
  hijosDe,
  textoDe,
  textoObligatorio,
  ErrorXml,
} from './xml-ligero.ts'

// ---------------------------------------------------------------------------
// Entornos y endpoints (literales del WSDL oficial, servicio sfVerifactu)
// ---------------------------------------------------------------------------

export type EntornoAeat = 'produccion' | 'pruebas'
export type TipoCertificado = 'normal' | 'sello'

/** Endpoints VERI*FACTU del WSDL oficial (`wsdl:service name="sfVerifactu"`). */
export const ENDPOINTS_VERIFACTU: Readonly<Record<EntornoAeat, Readonly<Record<TipoCertificado, string>>>> = {
  produccion: {
    normal: 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    sello: 'https://www10.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
  },
  pruebas: {
    normal: 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    sello: 'https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
  },
}

/** Endpoints de remisión bajo requerimiento (modo no-VERI*FACTU, V14). */
export const ENDPOINTS_REQUERIMIENTO: Readonly<Record<EntornoAeat, Readonly<Record<TipoCertificado, string>>>> = {
  produccion: {
    normal: 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/RequerimientoSOAP',
    sello: 'https://www10.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/RequerimientoSOAP',
  },
  pruebas: {
    normal: 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/RequerimientoSOAP',
    sello: 'https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/RequerimientoSOAP',
  },
}

// ---------------------------------------------------------------------------
// Configuración y certificado inyectable
// ---------------------------------------------------------------------------

/**
 * Material del certificado cliente para el mTLS. Se acepta PKCS#12 (`pfx`,
 * el formato en que FNMT/Camerfirma entregan los certificados) o el par
 * PEM `cert`+`key`. NUNCA se persiste ni se registra en logs desde aquí;
 * la custodia cifrada es responsabilidad de V11.
 */
export interface CertificadoCliente {
  pfx?: Buffer
  passphrase?: string
  cert?: string | Buffer
  key?: string | Buffer
  /** CA(s) EXTRA en las que confiar además de las del sistema (solo tests/mock). */
  ca?: string | Buffer | Array<string | Buffer>
}

export interface ConfigClienteAeat {
  entorno: EntornoAeat
  /** Tipo de certificado: decide host www1/prewww1 (normal) o www10/prewww10 (sello). */
  tipoCertificado?: TipoCertificado
  certificado: CertificadoCliente
  /** Sustituye el endpoint del WSDL (mock de tests o futuro verifactu-gateway). */
  urlOverride?: string
  /** Tiempo máximo de la petición HTTP completa. Por defecto 30 000 ms. */
  timeoutMs?: number
}

const TIMEOUT_MS_DEFECTO = 30_000

export function tieneMaterial(cert: CertificadoCliente): boolean {
  return Boolean(cert.pfx || (cert.cert && cert.key))
}

/**
 * Lee el certificado de las variables de entorno (diseño V09; los valores
 * reales los cargará Iván/V11): `VERIFACTU_CERT_PFX_BASE64` (+
 * `VERIFACTU_CERT_PFX_PASSWORD`) o `VERIFACTU_CERT_PEM_BASE64` +
 * `VERIFACTU_CERT_KEY_PEM_BASE64`. Devuelve null si no hay certificado.
 */
export function certificadoDesdeEnv(env: Record<string, string | undefined> = process.env): CertificadoCliente | null {
  if (env.VERIFACTU_CERT_PFX_BASE64) {
    return {
      pfx: Buffer.from(env.VERIFACTU_CERT_PFX_BASE64, 'base64'),
      passphrase: env.VERIFACTU_CERT_PFX_PASSWORD,
    }
  }
  if (env.VERIFACTU_CERT_PEM_BASE64 && env.VERIFACTU_CERT_KEY_PEM_BASE64) {
    return {
      cert: Buffer.from(env.VERIFACTU_CERT_PEM_BASE64, 'base64'),
      key: Buffer.from(env.VERIFACTU_CERT_KEY_PEM_BASE64, 'base64'),
    }
  }
  return null
}

/**
 * Construye la configuración completa desde el entorno: `VERIFACTU_ENTORNO`
 * (`pruebas` por defecto: producción exige opt-in explícito),
 * `VERIFACTU_CERT_TIPO`, `VERIFACTU_URL_OVERRIDE`, `VERIFACTU_TIMEOUT_MS`.
 * Lanza si falta el certificado (mensaje claro para el operador).
 */
export function configDesdeEnv(env: Record<string, string | undefined> = process.env): ConfigClienteAeat {
  const entorno = env.VERIFACTU_ENTORNO ?? 'pruebas'
  if (entorno !== 'pruebas' && entorno !== 'produccion') {
    throw new Error(`VERIFACTU_ENTORNO inválido «${entorno}» (use «pruebas» o «produccion»)`)
  }
  const tipo = env.VERIFACTU_CERT_TIPO ?? 'normal'
  if (tipo !== 'normal' && tipo !== 'sello') {
    throw new Error(`VERIFACTU_CERT_TIPO inválido «${tipo}» (use «normal» o «sello»)`)
  }
  const certificado = certificadoDesdeEnv(env)
  if (!certificado) {
    throw new Error(
      'Certificado VERI*FACTU no configurado: defina VERIFACTU_CERT_PFX_BASE64 ' +
        '(+ VERIFACTU_CERT_PFX_PASSWORD) o VERIFACTU_CERT_PEM_BASE64 + VERIFACTU_CERT_KEY_PEM_BASE64'
    )
  }
  const timeoutMs = env.VERIFACTU_TIMEOUT_MS ? Number(env.VERIFACTU_TIMEOUT_MS) : undefined
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    throw new Error(`VERIFACTU_TIMEOUT_MS inválido «${env.VERIFACTU_TIMEOUT_MS}»`)
  }
  return {
    entorno,
    tipoCertificado: tipo,
    certificado,
    urlOverride: env.VERIFACTU_URL_OVERRIDE,
    timeoutMs,
  }
}

// ---------------------------------------------------------------------------
// Errores tipados
// ---------------------------------------------------------------------------

/** Fallo de red/TLS/timeout: NO llegó respuesta de la AEAT → reintentable. */
export class ErrorTransporteAeat extends Error {
  readonly reintentable = true
  readonly causa?: unknown
  constructor(mensaje: string, causa?: unknown) {
    super(`Transporte AEAT: ${mensaje}`)
    this.name = 'ErrorTransporteAeat'
    this.causa = causa
  }
}

/** Respuesta HTTP sin cuerpo SOAP interpretable (5xx pasarela, HTML de error…). */
export class ErrorHttpAeat extends Error {
  readonly reintentable: boolean
  readonly status: number
  readonly cuerpo: string
  constructor(status: number, cuerpo: string) {
    super(`HTTP ${status} de la AEAT sin respuesta SOAP interpretable`)
    this.name = 'ErrorHttpAeat'
    this.status = status
    this.cuerpo = cuerpo
    this.reintentable = status >= 500 || status === 429
  }
}

/** SOAP Fault de la AEAT (estructura inválida, certificado sin permisos…). */
export class ErrorSoapAeat extends Error {
  readonly reintentable = false
  readonly faultCode: string
  readonly faultString: string
  readonly detalle?: string
  constructor(faultCode: string, faultString: string, detalle?: string) {
    super(`SOAP Fault AEAT [${faultCode}]: ${faultString}`)
    this.name = 'ErrorSoapAeat'
    this.faultCode = faultCode
    this.faultString = faultString
    this.detalle = detalle
  }
}

/** El cuerpo devuelto no cumple RespuestaSuministro.xsd. */
export class ErrorRespuestaAeat extends Error {
  readonly cuerpo?: string
  constructor(mensaje: string, cuerpo?: string) {
    super(`Respuesta AEAT inesperada: ${mensaje}`)
    this.name = 'ErrorRespuestaAeat'
    this.cuerpo = cuerpo
  }
}

// ---------------------------------------------------------------------------
// Tipos de la respuesta parseada (RespuestaSuministro.xsd al completo)
// ---------------------------------------------------------------------------

export type EstadoEnvio = 'Correcto' | 'ParcialmenteCorrecto' | 'Incorrecto'
export type EstadoRegistro = 'Correcto' | 'AceptadoConErrores' | 'Incorrecto'
export type EstadoRegistroDuplicado = 'Correcta' | 'AceptadaConErrores' | 'Anulada'

export interface RespuestaLinea {
  idFactura: {
    idEmisorFactura: string
    numSerieFactura: string
    fechaExpedicionFactura: string
  }
  operacion: {
    tipoOperacion: 'Alta' | 'Anulacion'
    subsanacion?: 'S' | 'N'
    rechazoPrevio?: 'S' | 'N' | 'X'
    sinRegistroPrevio?: 'S' | 'N'
  }
  refExterna?: string
  estadoRegistro: EstadoRegistro
  codigoErrorRegistro?: number
  descripcionErrorRegistro?: string
  /** Solo si el rechazo es por duplicado: estado del registro ya almacenado. */
  registroDuplicado?: {
    idPeticionRegistroDuplicado: string
    estadoRegistroDuplicado: EstadoRegistroDuplicado
    codigoErrorRegistro?: number
    descripcionErrorRegistro?: string
  }
}

export interface RespuestaRegFactu {
  /** Código Seguro de Verificación del envío. Solo si el envío no fue rechazado. */
  csv?: string
  datosPresentacion?: { nifPresentador: string; timestampPresentacion: string }
  /** Eco de la cabecera remitida. */
  cabecera: { obligadoEmision: { nombreRazon: string; nif: string } }
  /** Segundos que hay que esperar antes del siguiente envío (art. 16 Orden). */
  tiempoEsperaEnvio: number
  estadoEnvio: EstadoEnvio
  lineas: RespuestaLinea[]
}

/**
 * Estado interno V07/V10 (§5.5 SPEC) que corresponde a cada línea:
 * `accepted` (Correcto), `accepted_with_errors` (AceptadoConErrores) o
 * `rejected` (Incorrecto).
 */
export function estadoInternoLinea(linea: RespuestaLinea): 'accepted' | 'accepted_with_errors' | 'rejected' {
  switch (linea.estadoRegistro) {
    case 'Correcto':
      return 'accepted'
    case 'AceptadoConErrores':
      return 'accepted_with_errors'
    case 'Incorrecto':
      return 'rejected'
  }
}

/**
 * Tratamiento idempotente del rechazo por duplicado (§5.4 SPEC): si el
 * registro se rechazó por estar YA almacenado, devuelve el estado interno
 * equivalente al almacenado (el reenvío se da por completado); null si la
 * línea no es un duplicado o el registro almacenado está Anulada.
 */
export function estadoSiDuplicado(linea: RespuestaLinea): 'accepted' | 'accepted_with_errors' | null {
  if (linea.estadoRegistro !== 'Incorrecto' || !linea.registroDuplicado) return null
  switch (linea.registroDuplicado.estadoRegistroDuplicado) {
    case 'Correcta':
      return 'accepted'
    case 'AceptadaConErrores':
      return 'accepted_with_errors'
    case 'Anulada':
      return null
  }
}

// ---------------------------------------------------------------------------
// Envoltura SOAP 1.1 (binding document/literal del WSDL, SOAPAction vacío)
// ---------------------------------------------------------------------------

export const NS_SOAP_ENV = 'http://schemas.xmlsoap.org/soap/envelope/'

/** Envuelve un cuerpo XML (RegFactuSistemaFacturacion) en un Envelope SOAP 1.1. */
export function envolverSoap(cuerpoXml: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<soapenv:Envelope xmlns:soapenv="${NS_SOAP_ENV}">\n` +
    `<soapenv:Header/>\n` +
    `<soapenv:Body>\n` +
    `${cuerpoXml}\n` +
    `</soapenv:Body>\n` +
    `</soapenv:Envelope>`
  )
}

// ---------------------------------------------------------------------------
// Transporte HTTP con mTLS (inyectable para tests y para un futuro gateway)
// ---------------------------------------------------------------------------

export interface PeticionHttp {
  url: string
  cuerpo: string
  cabeceras: Record<string, string>
  timeoutMs: number
  certificado: CertificadoCliente
}

export interface RespuestaHttp {
  status: number
  cuerpo: string
}

export type TransporteHttp = (peticion: PeticionHttp) => Promise<RespuestaHttp>

/**
 * Transporte por defecto: `node:https` con certificado cliente (mTLS) y
 * TLS ≥ 1.2. `ca` solo añade confianza extra (tests); en producción se usan
 * las CA del sistema y `rejectUnauthorized` queda activo.
 */
export const transporteHttpsNode: TransporteHttp = (p) =>
  new Promise<RespuestaHttp>((resolve, reject) => {
    let u: URL
    try {
      u = new URL(p.url)
    } catch {
      reject(new ErrorTransporteAeat(`URL inválida «${p.url}»`))
      return
    }
    const datos = Buffer.from(p.cuerpo, 'utf8')
    const opciones: RequestOptions = {
      protocol: u.protocol,
      host: u.hostname,
      port: u.port ? Number(u.port) : 443,
      path: `${u.pathname}${u.search}`,
      method: 'POST',
      headers: { ...p.cabeceras, 'Content-Length': String(datos.byteLength) },
      minVersion: 'TLSv1.2',
      pfx: p.certificado.pfx,
      passphrase: p.certificado.passphrase,
      cert: p.certificado.cert,
      key: p.certificado.key,
      ca: p.certificado.ca,
      timeout: p.timeoutMs,
    }
    const req = httpsRequest(opciones, (res) => {
      const trozos: Buffer[] = []
      res.on('data', (t: Buffer) => trozos.push(t))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, cuerpo: Buffer.concat(trozos).toString('utf8') }))
      res.on('error', (e) => reject(new ErrorTransporteAeat(`error leyendo la respuesta: ${e.message}`, e)))
    })
    req.on('timeout', () => {
      req.destroy(new Error(`timeout de ${p.timeoutMs} ms agotado`))
    })
    req.on('error', (e) => reject(new ErrorTransporteAeat(e.message, e)))
    req.end(datos)
  })

// ---------------------------------------------------------------------------
// Parseo completo de la respuesta (RespuestaSuministro.xsd)
// ---------------------------------------------------------------------------

function exigirEnum<T extends string>(valor: string, permitidos: readonly T[], contexto: string): T {
  if ((permitidos as readonly string[]).includes(valor)) return valor as T
  throw new ErrorRespuestaAeat(`valor «${valor}» no permitido en ${contexto} (esperado: ${permitidos.join(' | ')})`)
}

function parsearEnteroOpcional(el: ElementoXml, nombre: string, contexto: string): number | undefined {
  const t = textoDe(el, nombre)
  if (t === null || t === '') return undefined
  const n = Number(t)
  if (!Number.isInteger(n)) throw new ErrorRespuestaAeat(`«${nombre}» no es un entero en ${contexto}: «${t}»`)
  return n
}

function parsearLinea(el: ElementoXml, indice: number): RespuestaLinea {
  const ctx = `RespuestaLinea[${indice}]`
  const idFacturaEl = hijo(el, 'IDFactura')
  if (!idFacturaEl) throw new ErrorRespuestaAeat(`falta IDFactura en ${ctx}`)
  const operacionEl = hijo(el, 'Operacion')
  if (!operacionEl) throw new ErrorRespuestaAeat(`falta Operacion en ${ctx}`)

  const linea: RespuestaLinea = {
    idFactura: {
      idEmisorFactura: textoObligatorio(idFacturaEl, 'IDEmisorFactura', ctx),
      numSerieFactura: textoObligatorio(idFacturaEl, 'NumSerieFactura', ctx),
      fechaExpedicionFactura: textoObligatorio(idFacturaEl, 'FechaExpedicionFactura', ctx),
    },
    operacion: {
      tipoOperacion: exigirEnum(textoObligatorio(operacionEl, 'TipoOperacion', ctx), ['Alta', 'Anulacion'], `${ctx}.TipoOperacion`),
    },
    estadoRegistro: exigirEnum(
      textoObligatorio(el, 'EstadoRegistro', ctx),
      ['Correcto', 'AceptadoConErrores', 'Incorrecto'],
      `${ctx}.EstadoRegistro`
    ),
  }

  const subsanacion = textoDe(operacionEl, 'Subsanacion')
  if (subsanacion) linea.operacion.subsanacion = exigirEnum(subsanacion, ['S', 'N'] as const, `${ctx}.Subsanacion`)
  const rechazoPrevio = textoDe(operacionEl, 'RechazoPrevio')
  if (rechazoPrevio) linea.operacion.rechazoPrevio = exigirEnum(rechazoPrevio, ['S', 'N', 'X'] as const, `${ctx}.RechazoPrevio`)
  const sinRegistroPrevio = textoDe(operacionEl, 'SinRegistroPrevio')
  if (sinRegistroPrevio) linea.operacion.sinRegistroPrevio = exigirEnum(sinRegistroPrevio, ['S', 'N'] as const, `${ctx}.SinRegistroPrevio`)

  const refExterna = textoDe(el, 'RefExterna')
  if (refExterna) linea.refExterna = refExterna
  const codigo = parsearEnteroOpcional(el, 'CodigoErrorRegistro', ctx)
  if (codigo !== undefined) linea.codigoErrorRegistro = codigo
  const descripcion = textoDe(el, 'DescripcionErrorRegistro')
  if (descripcion) linea.descripcionErrorRegistro = descripcion

  const dupEl = hijo(el, 'RegistroDuplicado')
  if (dupEl) {
    linea.registroDuplicado = {
      idPeticionRegistroDuplicado: textoObligatorio(dupEl, 'IdPeticionRegistroDuplicado', `${ctx}.RegistroDuplicado`),
      estadoRegistroDuplicado: exigirEnum(
        textoObligatorio(dupEl, 'EstadoRegistroDuplicado', `${ctx}.RegistroDuplicado`),
        ['Correcta', 'AceptadaConErrores', 'Anulada'],
        `${ctx}.EstadoRegistroDuplicado`
      ),
    }
    const codigoDup = parsearEnteroOpcional(dupEl, 'CodigoErrorRegistro', `${ctx}.RegistroDuplicado`)
    if (codigoDup !== undefined) linea.registroDuplicado.codigoErrorRegistro = codigoDup
    const descripcionDup = textoDe(dupEl, 'DescripcionErrorRegistro')
    if (descripcionDup) linea.registroDuplicado.descripcionErrorRegistro = descripcionDup
  }

  return linea
}

/**
 * Parsea el Envelope SOAP devuelto por la AEAT. Si contiene un `Fault` lanza
 * `ErrorSoapAeat`; si contiene `RespuestaRegFactuSistemaFacturacion` devuelve
 * la respuesta completa tipada; en cualquier otro caso `ErrorRespuestaAeat`.
 */
export function parsearRespuestaSoap(xml: string): RespuestaRegFactu {
  let raiz: ElementoXml
  try {
    raiz = parsearXml(xml)
  } catch (e) {
    throw new ErrorRespuestaAeat(e instanceof ErrorXml ? e.message : String(e), xml)
  }
  if (raiz.nombre !== 'Envelope') {
    throw new ErrorRespuestaAeat(`raíz «${raiz.nombre}» (se esperaba un Envelope SOAP)`, xml)
  }
  const body = hijo(raiz, 'Body')
  if (!body) throw new ErrorRespuestaAeat('Envelope sin Body', xml)

  const fault = hijo(body, 'Fault')
  if (fault) {
    const detalleEl = hijo(fault, 'detail')
    throw new ErrorSoapAeat(
      textoDe(fault, 'faultcode') ?? '(sin faultcode)',
      textoDe(fault, 'faultstring') ?? '(sin faultstring)',
      detalleEl ? detalleEl.texto.trim() || undefined : undefined
    )
  }

  const resp = hijo(body, 'RespuestaRegFactuSistemaFacturacion')
  if (!resp) {
    const nombres = body.hijos.map((h) => h.nombre).join(', ') || '(vacío)'
    throw new ErrorRespuestaAeat(`Body sin RespuestaRegFactuSistemaFacturacion (contiene: ${nombres})`, xml)
  }

  const cabeceraEl = hijo(resp, 'Cabecera')
  if (!cabeceraEl) throw new ErrorRespuestaAeat('falta Cabecera en la respuesta', xml)
  const obligadoEl = hijo(cabeceraEl, 'ObligadoEmision')
  if (!obligadoEl) throw new ErrorRespuestaAeat('falta Cabecera.ObligadoEmision en la respuesta', xml)

  const tiempoTexto = textoObligatorio(resp, 'TiempoEsperaEnvio', 'la respuesta')
  if (!/^\d{1,4}$/.test(tiempoTexto)) {
    throw new ErrorRespuestaAeat(`TiempoEsperaEnvio inválido «${tiempoTexto}» (Tipo6Type: 0-4 dígitos)`)
  }

  const respuesta: RespuestaRegFactu = {
    cabecera: {
      obligadoEmision: {
        nombreRazon: textoObligatorio(obligadoEl, 'NombreRazon', 'Cabecera.ObligadoEmision'),
        nif: textoObligatorio(obligadoEl, 'NIF', 'Cabecera.ObligadoEmision'),
      },
    },
    tiempoEsperaEnvio: Number(tiempoTexto),
    estadoEnvio: exigirEnum(
      textoObligatorio(resp, 'EstadoEnvio', 'la respuesta'),
      ['Correcto', 'ParcialmenteCorrecto', 'Incorrecto'],
      'EstadoEnvio'
    ),
    lineas: hijosDe(resp, 'RespuestaLinea').map(parsearLinea),
  }

  const csv = textoDe(resp, 'CSV')
  if (csv) respuesta.csv = csv
  const presentacionEl = hijo(resp, 'DatosPresentacion')
  if (presentacionEl) {
    respuesta.datosPresentacion = {
      nifPresentador: textoObligatorio(presentacionEl, 'NIFPresentador', 'DatosPresentacion'),
      timestampPresentacion: textoObligatorio(presentacionEl, 'TimestampPresentacion', 'DatosPresentacion'),
    }
  }
  return respuesta
}

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

export class ClienteAeat {
  private readonly config: ConfigClienteAeat
  private readonly transporte: TransporteHttp

  constructor(config: ConfigClienteAeat, transporte: TransporteHttp = transporteHttpsNode) {
    if (!tieneMaterial(config.certificado)) {
      throw new Error(
        'ClienteAeat: falta el material del certificado cliente (pfx o cert+key). ' +
          'El servicio AEAT exige autenticación mutua TLS (art. 5 Orden HAC/1177/2024).'
      )
    }
    this.config = config
    this.transporte = transporte
  }

  /** Endpoint efectivo de remisión (WSDL, salvo `urlOverride`). */
  urlRemision(): string {
    return this.config.urlOverride ?? ENDPOINTS_VERIFACTU[this.config.entorno][this.config.tipoCertificado ?? 'normal']
  }

  /**
   * Construye el mensaje `RegFactuSistemaFacturacion` a partir de la cabecera
   * y de 1..1000 fragmentos `sf:RegistroAlta`/`sf:RegistroAnulacion` ya
   * serializados (los reconstruye V07 desde `sif_registros`) y lo remite.
   */
  async enviarRegistros(cabecera: CabeceraRemision, registrosXml: readonly string[]): Promise<RespuestaRegFactu> {
    return this.enviarCuerpoXml(xmlRegFactuSistemaFacturacion(cabecera, registrosXml))
  }

  /** Remite un mensaje `RegFactuSistemaFacturacion` ya construido. */
  async enviarCuerpoXml(cuerpoXml: string): Promise<RespuestaRegFactu> {
    const respuesta = await this.transporte({
      url: this.urlRemision(),
      cuerpo: envolverSoap(cuerpoXml),
      cabeceras: {
        // Binding SOAP 1.1 document/literal del WSDL: SOAPAction vacío.
        'Content-Type': 'text/xml; charset=UTF-8',
        SOAPAction: '""',
        Accept: 'text/xml',
      },
      timeoutMs: this.config.timeoutMs ?? TIMEOUT_MS_DEFECTO,
      certificado: this.config.certificado,
    })

    // Un Fault SOAP puede venir con HTTP 500: se intenta parsear SIEMPRE el
    // cuerpo y solo si no es SOAP interpretable se degrada a ErrorHttpAeat.
    try {
      return parsearRespuestaSoap(respuesta.cuerpo)
    } catch (e) {
      if (e instanceof ErrorSoapAeat) throw e
      if (respuesta.status !== 200) throw new ErrorHttpAeat(respuesta.status, respuesta.cuerpo)
      throw e
    }
  }
}

/** Cliente listo a partir de las variables de entorno (ver `configDesdeEnv`). */
export function clienteDesdeEnv(env: Record<string, string | undefined> = process.env): ClienteAeat {
  return new ClienteAeat(configDesdeEnv(env))
}
