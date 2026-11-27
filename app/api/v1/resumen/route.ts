// API v1 · GET /api/v1/resumen?desde&hasta — suma orientativa de lo registrado (permiso kuentas:leer).
import { NextResponse } from 'next/server'
import { errorApi, rutaApi } from '@/lib/api-v1/contexto'
import { redondear } from '@/lib/invoices/importes'

export const dynamic = 'force-dynamic'
const FECHA = /^\d{4}-\d{2}-\d{2}$/

export const GET = rutaApi('/resumen', 'kuentas:leer', async ({ svc, userId }, request) => {
  const q = new URL(request.url).searchParams
  const desde = q.get('desde') ?? ''
  const hasta = q.get('hasta') ?? ''
  if (!FECHA.test(desde) || !FECHA.test(hasta) || desde > hasta) {
    return errorApi(400, 'fechas', 'desde y hasta (AAAA-MM-DD) son obligatorias y desde no puede ser posterior a hasta')
  }
  const [{ data: fs, error: e1 }, { data: gs, error: e2 }] = await Promise.all([
    svc.from('invoices').select('subtotal, iva, irpf, total, status, verifactu_estado').eq('user_id', userId)
      .gte('date', desde).lte('date', hasta).neq('verifactu_estado', 'anulada').limit(10000),
    svc.from('transactions').select('amount').eq('user_id', userId).eq('type', 'gasto')
      .gte('date', desde).lte('date', hasta).limit(10000),
  ])
  if (e1) throw e1
  if (e2) throw e2
  const facturas = (fs ?? []) as Record<string, any>[]
  const gastos = (gs ?? []) as Record<string, any>[]
  const suma = (k: string, filtro: (f: Record<string, any>) => boolean = () => true) =>
    redondear(facturas.filter(filtro).reduce((s, f) => s + Number(f[k] ?? 0), 0))
  return NextResponse.json({
    desde,
    hasta,
    facturado: { n: facturas.length, base: suma('subtotal'), iva: suma('iva'), irpf: suma('irpf'), total: suma('total') },
    cobrado: suma('total', (f) => f.status === 'cobrada'),
    pendiente_de_cobro: suma('total', (f) => f.status !== 'cobrada'),
    gastos: { n: gastos.length, total: redondear(gastos.reduce((s, g) => s + Number(g.amount ?? 0), 0)) },
    aviso: 'Suma orientativa de lo registrado en Kuentas (sin facturas anuladas); no sustituye a las declaraciones ni a tu asesor.',
  })
})
