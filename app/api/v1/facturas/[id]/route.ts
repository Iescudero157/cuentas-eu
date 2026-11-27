// API v1 · GET /api/v1/facturas/{id} — detalle con líneas y estado VERI*FACTU (permiso kuentas:leer).
import { NextResponse } from 'next/server'
import { errorApi, rutaApi } from '@/lib/api-v1/contexto'
import { COLUMNAS_FACTURA, estadoEnvio, facturaResumen } from '@/lib/api-v1/mapeo'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const GET = rutaApi('/facturas/{id}', 'kuentas:leer', async ({ svc, userId }, _req, params) => {
  const id = params.id ?? ''
  if (!UUID.test(id)) return errorApi(404, 'no_encontrada', 'No existe o no es de esta cuenta')
  const { data: f } = await svc
    .from('invoices')
    .select(`${COLUMNAS_FACTURA}, items, iva_rate, irpf_rate, due_date, payment_method, tipo_factura`)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!f) return errorApi(404, 'no_encontrada', 'No existe o no es de esta cuenta')
  const { data: reg } = await svc
    .from('sif_registros')
    .select('estado_remision, csv_aeat')
    .eq('invoice_id', id)
    .eq('user_id', userId)
    .eq('tipo_registro', 'alta')
    .order('correlativo', { ascending: false })
    .limit(1)
    .maybeSingle()
  const items = Array.isArray(f.items) ? f.items : []
  return NextResponse.json({
    ...facturaResumen(f),
    tipo_factura: f.tipo_factura ?? null,
    iva_tipo: f.iva_rate,
    irpf_tipo: f.irpf_rate,
    lineas: items.map((l: Record<string, unknown>) => ({
      concepto: l.description, cantidad: Number(l.quantity), precio_unitario: Number(l.unitPrice), total: Number(l.total),
    })),
    vencimiento: f.due_date ?? null,
    forma_pago: f.payment_method ?? null,
    verifactu: reg ? { estado_envio: estadoEnvio(reg.estado_remision), csv: reg.csv_aeat ?? null } : null,
  })
})
