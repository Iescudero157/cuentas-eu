// API v1 · Autenticación por token personal, permisos, límite de uso y registro de cada llamada (27-nov-2026).
// Cada token pertenece a un usuario: TODAS las consultas de las rutas v1 filtran por ctx.userId con la clave de
// servicio (la RLS no aplica a la service_role, así que el filtro por usuario es obligatorio en cada consulta).
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clienteServicio } from '../supabase/servicio.ts'
import { hashToken, type PermisoApi } from './tokens.ts'

export const LIMITE_POR_MINUTO = 60
export const LIMITE_POR_DIA = 1000

export interface ContextoApi {
  svc: SupabaseClient
  userId: string
  tokenId: string
  permisos: PermisoApi[]
}

export function errorApi(estado: number, error: string, mensaje: string, cabeceras?: Record<string, string>) {
  return NextResponse.json({ error, mensaje }, { status: estado, headers: cabeceras })
}

type Manejador = (ctx: ContextoApi, request: Request, params: Record<string, string>) => Promise<NextResponse>

/**
 * Envuelve una ruta v1: token → usuario, permiso, límites (60/min y 1.000/día por token) y registro.
 * `ruta` es la plantilla que se anota (sin ids), p. ej. '/facturas/{id}'.
 */
export function rutaApi(ruta: string, permiso: PermisoApi, manejar: Manejador) {
  return async (request: Request, segundo?: { params?: Promise<Record<string, string>> }) => {
    const t0 = Date.now()
    const svc = clienteServicio()
    if (!svc) return errorApi(503, 'no_disponible', 'La API no está configurada en este entorno')
    const cab = request.headers.get('authorization') ?? ''
    if (!cab.startsWith('Bearer kua_') || cab.length > 200) return errorApi(401, 'no_autorizado', 'Falta el token o no es válido')
    const { data: tok } = await svc
      .from('api_tokens')
      .select('id, user_id, permisos, revocado_at')
      .eq('hash', hashToken(cab.slice(7)))
      .maybeSingle()
    if (!tok || tok.revocado_at) return errorApi(401, 'no_autorizado', 'Token incorrecto o revocado')
    const ctx: ContextoApi = { svc, userId: tok.user_id, tokenId: tok.id, permisos: tok.permisos as PermisoApi[] }
    const metodo = request.method === 'POST' ? 'POST' : 'GET'
    const anotar = async (estado: number) => {
      await svc.from('api_registro').insert({ user_id: ctx.userId, token_id: ctx.tokenId, metodo, ruta, estado, ms: Date.now() - t0 })
      if (estado < 400) await svc.from('api_tokens').update({ ultimo_uso_at: new Date().toISOString() }).eq('id', ctx.tokenId)
    }

    const desde = (ms: number) => new Date(Date.now() - ms).toISOString()
    const [{ count: enMinuto }, { count: enDia }] = await Promise.all([
      svc.from('api_registro').select('id', { count: 'exact', head: true }).eq('token_id', ctx.tokenId).gte('creado_at', desde(60_000)),
      svc.from('api_registro').select('id', { count: 'exact', head: true }).eq('token_id', ctx.tokenId).gte('creado_at', desde(86_400_000)),
    ])
    if ((enMinuto ?? 0) >= LIMITE_POR_MINUTO) return errorApi(429, 'limite', `Más de ${LIMITE_POR_MINUTO} peticiones por minuto`, { 'retry-after': '60' })
    if ((enDia ?? 0) >= LIMITE_POR_DIA) return errorApi(429, 'limite', `Más de ${LIMITE_POR_DIA} peticiones en 24 horas`, { 'retry-after': '3600' })

    if (!ctx.permisos.includes(permiso)) {
      await anotar(403)
      return errorApi(403, 'sin_permiso', `Este token no tiene el permiso ${permiso}`)
    }
    let respuesta: NextResponse
    try {
      respuesta = await manejar(ctx, request, (await segundo?.params) ?? {})
    } catch (e) {
      if (e instanceof ErrorEntrada) respuesta = errorApi(400, 'peticion', e.message)
      else {
        console.error('API v1', ruta, e)
        respuesta = errorApi(500, 'interno', 'Error interno de Kuentas')
      }
    }
    await anotar(respuesta.status)
    return respuesta
  }
}

/** Lee el cuerpo JSON sin dejar que un cuerpo malformado o enorme tumbe la ruta. */
export async function leerJson(request: Request): Promise<unknown> {
  const t = await request.text()
  if (t.length > 100_000) throw new ErrorEntrada('El cuerpo es demasiado grande')
  try {
    return t ? JSON.parse(t) : {}
  } catch {
    throw new ErrorEntrada('Cuerpo JSON inválido')
  }
}
export class ErrorEntrada extends Error {}

export const fechaValida = (v: string | null) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v)
