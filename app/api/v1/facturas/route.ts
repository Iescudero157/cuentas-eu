// API v1 · GET /api/v1/facturas — lista de facturas de la cuenta (permiso kuentas:leer).
import { NextResponse } from 'next/server'
import { errorApi, fechaValida, rutaApi } from '@/lib/api-v1/contexto'
import { COLUMNAS_FACTURA, facturaResumen } from '@/lib/api-v1/mapeo'

export const dynamic = 'force-dynamic'
const COBROS = new Set(['pendiente', 'cobrada', 'vencida'])
const FISCALES = new Set(['sin_verifactu', 'emitida', 'rectificada', 'anulada'])

export const GET = rutaApi('/facturas', 'kuentas:leer', async ({ svc, userId }, request) => {
  const q = new URL(request.url).searchParams
  const desde = q.get('desde'), hasta = q.get('hasta'), cobro = q.get('estado_cobro'), fiscal = q.get('estado_fiscal')
  const cliente = (q.get('cliente') ?? '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 80)
  if (!fechaValida(desde) || !fechaValida(hasta)) return errorApi(400, 'fecha', 'Fechas en formato AAAA-MM-DD')
  if (cobro && !COBROS.has(cobro)) return errorApi(400, 'estado_cobro', 'estado_cobro: pendiente, cobrada o vencida')
  if (fiscal && !FISCALES.has(fiscal)) return errorApi(400, 'estado_fiscal', 'estado_fiscal: sin_verifactu, emitida, rectificada o anulada')
  const limite = Math.min(Math.max(Number(q.get('limite') ?? 25) || 25, 1), 100)
  const desplaz = Math.max(Number(q.get('cursor') ?? 0) || 0, 0)

  let consulta = svc.from('invoices').select(COLUMNAS_FACTURA).eq('user_id', userId)
  if (desde) consulta = consulta.gte('date', desde)
  if (hasta) consulta = consulta.lte('date', hasta)
  if (cobro) consulta = consulta.eq('status', cobro)
  if (fiscal) consulta = fiscal === 'sin_verifactu' ? consulta.eq('verifactu_estado', 'borrador') : consulta.eq('verifactu_estado', fiscal)
  if (cliente) consulta = consulta.or(`client_name.ilike.%${cliente}%,client_nif.ilike.%${cliente}%`)
  const { data, error } = await consulta
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(desplaz, desplaz + limite)
  if (error) throw error
  const filas = data ?? []
  return NextResponse.json({
    facturas: filas.slice(0, limite).map(facturaResumen),
    siguiente: filas.length > limite ? String(desplaz + limite) : null,
  })
})
