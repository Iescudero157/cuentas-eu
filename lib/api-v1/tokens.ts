// API v1 · Tokens personales (kua_…) y códigos de conexión (27-nov-2026).
// El token se enseña una sola vez; en la base de datos solo queda su SHA-256 (api_tokens.hash).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const PERMISOS_API = ['kuentas:leer', 'kuentas:borradores'] as const
export type PermisoApi = (typeof PERMISOS_API)[number]

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function generarToken(): { token: string; hash: string; prefijo: string } {
  const token = 'kua_' + randomBytes(24).toString('base64url')
  return { token, hash: hashToken(token), prefijo: token.slice(0, 8) }
}

export function generarCodigo(): { codigo: string; hash: string } {
  const codigo = randomBytes(24).toString('base64url')
  return { codigo, hash: hashToken(codigo) }
}

/** Permisos válidos de una lista pedida; `kuentas:leer` siempre va incluido. */
export function normalizarPermisos(pedidos: unknown): PermisoApi[] {
  const lista = Array.isArray(pedidos) ? pedidos : typeof pedidos === 'string' ? pedidos.split(/[\s,]+/) : []
  const set = new Set<PermisoApi>(['kuentas:leer'])
  for (const p of lista) if ((PERMISOS_API as readonly string[]).includes(p)) set.add(p as PermisoApi)
  return PERMISOS_API.filter((p) => set.has(p))
}

/** Comparación en tiempo constante del secreto compartido con el conector MCP. */
export function secretoValido(cabecera: string | null, secreto: string | undefined): boolean {
  if (!secreto || secreto.length < 32 || !cabecera) return false
  const a = Buffer.from(cabecera)
  const b = Buffer.from(`Bearer ${secreto}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Dónde puede volver /conectar-ia con el código: solo a las URL de callback del conector que estén en
 * MCP_CALLBACK_URLS (separadas por comas). Así nadie puede usar la pantalla para llevarse un código.
 */
export function vueltaPermitida(vuelta: string, permitidas: string | undefined): boolean {
  try {
    const u = new URL(vuelta)
    const lista = (permitidas ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    return lista.some((p) => {
      const q = new URL(p)
      return q.origin === u.origin && q.pathname === u.pathname
    })
  } catch {
    return false
  }
}
