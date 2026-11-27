// API v1 · GET /api/v1/perfil — datos del emisor y plan (permiso kuentas:leer).
import { NextResponse } from 'next/server'
import { rutaApi } from '@/lib/api-v1/contexto'
import { planEfectivo } from '@/lib/plan'

export const dynamic = 'force-dynamic'

export const GET = rutaApi('/perfil', 'kuentas:leer', async ({ svc, userId }) => {
  const [{ data: p }, { data: sif }] = await Promise.all([
    svc.from('profiles').select('*').eq('id', userId).maybeSingle(),
    svc.from('sif_config').select('activo').eq('user_id', userId).maybeSingle(),
  ])
  return NextResponse.json({
    nombre: p?.name ?? null,
    nif: p?.nif ?? null,
    plan: planEfectivo(p),
    verifactu_activo: sif?.activo === true,
    iva_por_defecto: p?.tipo_iva ?? 21,
    irpf_por_defecto: p?.retencion_irpf ?? 15,
  })
})
