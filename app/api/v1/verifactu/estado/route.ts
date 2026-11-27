// API v1 · GET /api/v1/verifactu/estado — módulo VERI*FACTU y remisión (permiso kuentas:leer).
import { NextResponse } from 'next/server'
import { rutaApi } from '@/lib/api-v1/contexto'

export const dynamic = 'force-dynamic'

export const GET = rutaApi('/verifactu/estado', 'kuentas:leer', async ({ svc, userId }) => {
  const contar = (estados: string[]) =>
    svc.from('sif_registros').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('estado_remision', estados)
  const [{ data: cfg }, aceptados, pendientes, rechazados, { data: ultimo }] = await Promise.all([
    svc.from('sif_config').select('activo, entorno_aeat').eq('user_id', userId).maybeSingle(),
    contar(['accepted', 'accepted_with_errors']),
    contar(['generated', 'queued', 'sending']),
    contar(['rejected']),
    svc.from('sif_outbox').select('ultimo_intento_at').eq('user_id', userId).not('ultimo_intento_at', 'is', null)
      .order('ultimo_intento_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  return NextResponse.json({
    activo: cfg?.activo === true,
    entorno: cfg ? cfg.entorno_aeat : null,
    registros: { aceptados: aceptados.count ?? 0, pendientes: pendientes.count ?? 0, rechazados: rechazados.count ?? 0 },
    ultimo_envio: ultimo?.ultimo_intento_at ?? null,
  })
})
