// ---------------------------------------------------------------------------
// V24 · Utilidades de seguridad HTTP del módulo Verifactu.
//
// 1) Autenticación de los endpoints internos de operación (crons) con
//    comparación en tiempo constante: `authHeader !== "Bearer …"` permite en
//    teoría medir cuántos caracteres coinciden (timing attack). Se comparan
//    digests SHA-256 con `timingSafeEqual`, que además iguala longitudes.
//
// 2) Limitador de tasa en memoria (ventana fija) para las rutas sensibles del
//    módulo (subida de certificado, export, subsanación…). Es best-effort:
//    en Vercel cada instancia serverless tiene su propia memoria, así que el
//    límite real puede ser N × instancias. Suficiente contra abuso casual y
//    contra bucles accidentales del propio frontend; un rate limit global
//    exigiría infraestructura de pago (KV/Upstash) — decisión anotada en
//    docs/verifactu/SEGURIDAD.md y pendiente de Iván si el volumen lo pide.
// ---------------------------------------------------------------------------

import { createHash, timingSafeEqual } from 'node:crypto'

/** Compara dos secretos en tiempo constante (vía digest, admite longitudes distintas). */
export function secretosIguales(a: string, b: string): boolean {
  const da = createHash('sha256').update(a, 'utf8').digest()
  const db = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(da, db)
}

/**
 * Autoriza una petición de cron/operación interna con `Authorization: Bearer
 * <CRON_SECRET>`. Devuelve false si el secreto no está configurado (fail
 * closed), si falta la cabecera o si no coincide (comparación timing-safe).
 */
export function autorizacionCronValida(
  request: Request,
  secreto: string | undefined = process.env.CRON_SECRET
): boolean {
  if (!secreto) return false
  const cabecera = request.headers.get('authorization')
  if (!cabecera || !cabecera.startsWith('Bearer ')) return false
  return secretosIguales(cabecera.slice('Bearer '.length), secreto)
}

// --- Limitador de tasa (ventana fija, por instancia) -----------------------

interface VentanaTasa {
  inicio: number
  cuenta: number
}

/** Máximo de claves retenidas; al superarlo se purgan las ventanas caducadas
 *  y, si no basta, se descartan las más antiguas (evita crecer sin límite). */
const MAX_CLAVES = 5000

const ventanas = new Map<string, VentanaTasa>()

export interface ResultadoTasa {
  permitido: boolean
  /** Segundos hasta que la ventana se reinicia (para Retry-After). */
  reintentarEnSegundos: number
}

/**
 * Ventana fija por clave: permite `max` peticiones por `ventanaMs`. La clave
 * debe incluir la ruta y la identidad (p. ej. `cert:POST:<user_id>`): así un
 * tenant no puede agotar el cupo de otro.
 */
export function limitarTasa(
  clave: string,
  max: number,
  ventanaMs: number,
  ahora: number = Date.now()
): ResultadoTasa {
  const actual = ventanas.get(clave)
  if (!actual || ahora - actual.inicio >= ventanaMs) {
    if (ventanas.size >= MAX_CLAVES) purgar(ahora, ventanaMs)
    // Map conserva orden de inserción: reinsertar deja la clave "fresca".
    ventanas.delete(clave)
    ventanas.set(clave, { inicio: ahora, cuenta: 1 })
    return { permitido: true, reintentarEnSegundos: 0 }
  }
  actual.cuenta += 1
  const restanteMs = ventanaMs - (ahora - actual.inicio)
  if (actual.cuenta > max) {
    return { permitido: false, reintentarEnSegundos: Math.max(1, Math.ceil(restanteMs / 1000)) }
  }
  return { permitido: true, reintentarEnSegundos: 0 }
}

function purgar(ahora: number, ventanaMs: number): void {
  for (const [clave, v] of ventanas) {
    if (ahora - v.inicio >= ventanaMs) ventanas.delete(clave)
  }
  // Si todas siguen vivas, descarta las más antiguas (primeras del Map).
  while (ventanas.size >= MAX_CLAVES) {
    const primera = ventanas.keys().next()
    if (primera.done) break
    ventanas.delete(primera.value)
  }
}

/** Respuesta 429 homogénea para las rutas del módulo. */
export function respuesta429(resultado: ResultadoTasa): Response {
  return new Response(
    JSON.stringify({ error: 'Demasiadas peticiones, inténtelo de nuevo en unos segundos' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(resultado.reintentarEnSegundos),
      },
    }
  )
}

/**
 * Rechazo temprano de cuerpos grandes ANTES de `request.json()` (que
 * bufferiza el cuerpo entero en memoria). Best-effort: sin Content-Length
 * (chunked) no se puede saber a priori; Vercel corta igualmente los cuerpos
 * de más de ~4,5 MB a nivel de plataforma.
 */
export function cuerpoExcedeLimite(request: Request, maxBytes: number): boolean {
  const cl = request.headers.get('content-length')
  if (!cl) return false
  const n = Number(cl)
  return Number.isFinite(n) && n > maxBytes
}

/** Clave de tasa por IP para rutas sin sesión (mejor esfuerzo tras el proxy de Vercel). */
export function claveIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  return (xff ? xff.split(',')[0].trim() : '') || 'sin-ip'
}

/** Solo para tests: vacía el estado del limitador. */
export function reiniciarLimitadorParaTests(): void {
  ventanas.clear()
}
