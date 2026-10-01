// ---------------------------------------------------------------------------
// V11 · Cifrado en reposo del material de certificados (custodia).
//
// Sobre autenticado AES-256-GCM con la KEK (key-encryption key) en variable de
// entorno — NUNCA en la base de datos: un volcado de BD no expone claves
// privadas, y un compromiso de la KEK sin la BD tampoco.
//
// Formato del sobre:  v1.<kekId>.<iv b64>.<ct b64>.<tag b64>
//  * kekId = primeros 8 hex de SHA-256(KEK): identifica con qué clave se
//    cifró y permite rotación sin recifrar en bloque (la KEK anterior se
//    mantiene en VERIFACTU_CERT_KEK_ANTERIOR_BASE64 mientras conviven sobres).
//  * AAD = contexto lógico del dato (tabla:id:user): un sobre copiado a otra
//    fila/tenant por un atacante con acceso de escritura a la BD NO descifra.
//
// PROHIBIDO registrar en logs tanto el material en claro como la KEK; los
// errores de este módulo solo llevan mensajes operativos, jamás contenido.
// ---------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const VERSION = 'v1'
const ALG = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16
const KEK_BYTES = 32

export class ErrorCifrado extends Error {
  readonly codigo:
    | 'KEK_NO_CONFIGURADA'
    | 'KEK_INVALIDA'
    | 'SOBRE_INVALIDO'
    | 'KEK_DESCONOCIDA'
    | 'DESCIFRADO_FALLIDO'
  constructor(codigo: ErrorCifrado['codigo'], mensaje: string) {
    super(mensaje)
    this.name = 'ErrorCifrado'
    this.codigo = codigo
  }
}

export interface ClaveCifrado {
  /** Identificador público de la clave (8 hex de SHA-256 de la KEK). */
  id: string
  clave: Buffer
}

export function idDeClave(clave: Buffer): string {
  return createHash('sha256').update(clave).digest('hex').slice(0, 8)
}

function claveDesdeBase64(b64: string, variable: string): ClaveCifrado {
  let clave: Buffer
  try {
    clave = Buffer.from(b64, 'base64')
  } catch {
    throw new ErrorCifrado('KEK_INVALIDA', `${variable} no es base64 válido`)
  }
  if (clave.length !== KEK_BYTES) {
    throw new ErrorCifrado(
      'KEK_INVALIDA',
      `${variable} debe ser de exactamente ${KEK_BYTES} bytes en base64 (tiene ${clave.length}); genérela con: openssl rand -base64 32`
    )
  }
  return { id: idDeClave(clave), clave }
}

export interface JuegoClaves {
  /** Clave con la que se cifra todo sobre nuevo. */
  actual: ClaveCifrado
  /** Claves aceptadas al descifrar (actual + anteriores en rotación). */
  todas: ClaveCifrado[]
}

/**
 * KEK desde el entorno: `VERIFACTU_CERT_KEK_BASE64` (obligatoria para la
 * custodia; 32 bytes en base64) y, durante una rotación,
 * `VERIFACTU_CERT_KEK_ANTERIOR_BASE64` para seguir descifrando sobres viejos.
 * Devuelve null si la custodia no está configurada.
 */
export function clavesDesdeEnv(env: Record<string, string | undefined> = process.env): JuegoClaves | null {
  if (!env.VERIFACTU_CERT_KEK_BASE64) return null
  const actual = claveDesdeBase64(env.VERIFACTU_CERT_KEK_BASE64, 'VERIFACTU_CERT_KEK_BASE64')
  const todas = [actual]
  if (env.VERIFACTU_CERT_KEK_ANTERIOR_BASE64) {
    todas.push(claveDesdeBase64(env.VERIFACTU_CERT_KEK_ANTERIOR_BASE64, 'VERIFACTU_CERT_KEK_ANTERIOR_BASE64'))
  }
  return { actual, todas }
}

/** Cifra `claro` ligándolo al contexto `aad`. Devuelve el sobre serializado. */
export function cifrar(claro: Buffer, aad: string, clave: ClaveCifrado): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALG, clave.clave, iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ct = Buffer.concat([cipher.update(claro), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, clave.id, iv.toString('base64'), ct.toString('base64'), tag.toString('base64')].join('.')
}

/**
 * Descifra un sobre creado con `cifrar`. El `aad` debe ser EXACTAMENTE el del
 * cifrado (mismo id de fila y tenant): si no coincide, o el sobre fue
 * manipulado, falla con DESCIFRADO_FALLIDO.
 */
export function descifrar(sobre: string, aad: string, claves: readonly ClaveCifrado[]): Buffer {
  const partes = sobre.split('.')
  if (partes.length !== 5 || partes[0] !== VERSION) {
    throw new ErrorCifrado('SOBRE_INVALIDO', 'Sobre de cifrado con formato desconocido')
  }
  const [, kekId, ivB64, ctB64, tagB64] = partes
  const clave = claves.find((c) => c.id === kekId)
  if (!clave) {
    throw new ErrorCifrado(
      'KEK_DESCONOCIDA',
      `El sobre fue cifrado con la KEK «${kekId}», que no está en el entorno (¿rotación sin VERIFACTU_CERT_KEK_ANTERIOR_BASE64?)`
    )
  }
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new ErrorCifrado('SOBRE_INVALIDO', 'Sobre de cifrado corrupto (iv/tag)')
  }
  try {
    const decipher = createDecipheriv(ALG, clave.clave, iv, { authTagLength: TAG_BYTES })
    decipher.setAAD(Buffer.from(aad, 'utf8'))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()])
  } catch {
    // Nunca propagar detalle criptográfico ni contenido
    throw new ErrorCifrado(
      'DESCIFRADO_FALLIDO',
      'No se pudo descifrar el material (sobre manipulado o contexto AAD incorrecto)'
    )
  }
}
