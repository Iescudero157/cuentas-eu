// API v1 · Borradores de factura preparados por la IA (27-nov-2026).
//   GET  /api/v1/facturas/borradores — borradores pendientes (permiso kuentas:leer)
//   POST /api/v1/facturas/borradores — prepara uno (permiso kuentas:borradores)
// Un borrador NO es una factura: va a facturas_borrador_ia, sin número ni registro VERI*FACTU. El usuario lo abre
// en la app (Facturas → Nueva factura con el borrador cargado), lo revisa y lo guarda o emite él.
import { NextResponse } from 'next/server'
import { errorApi, leerJson, rutaApi } from '@/lib/api-v1/contexto'
import { validarBorrador, type ClienteBorrador } from '@/lib/api-v1/borrador'
import { borradorPublico } from '@/lib/api-v1/mapeo'
import { fechaHoyEspana } from '@/lib/invoices/numeracion'

export const dynamic = 'force-dynamic'
const MAX_PENDIENTES = 50

export const GET = rutaApi('/facturas/borradores', 'kuentas:leer', async ({ svc, userId }) => {
  const { data, error } = await svc
    .from('facturas_borrador_ia')
    .select('id, estado, datos, base, iva, irpf, total, creado_at')
    .eq('user_id', userId)
    .eq('estado', 'pendiente')
    .order('creado_at', { ascending: false })
    .limit(MAX_PENDIENTES)
  if (error) throw error
  return NextResponse.json({ borradores: (data ?? []).map(borradorPublico) })
})

export const POST = rutaApi('/facturas/borradores', 'kuentas:borradores', async ({ svc, userId, tokenId }, request) => {
  const entrada = (await leerJson(request)) as Record<string, unknown>
  let guardado: ClienteBorrador | null = null
  if (typeof entrada?.cliente_id === 'string' && entrada.cliente_id) {
    const { data: c } = await svc
      .from('clients')
      .select('id, name, nif, address, email')
      .eq('id', entrada.cliente_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!c) return errorApi(422, 'cliente', 'Cliente no encontrado en esta cuenta')
    guardado = { id: c.id, nombre: c.name, nif: c.nif ?? null, direccion: c.address ?? null, email: c.email ?? null }
  }
  const r = validarBorrador(entrada, guardado, fechaHoyEspana())
  if (!r.ok) return errorApi(422, r.error, r.mensaje)

  const { count } = await svc
    .from('facturas_borrador_ia')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('estado', 'pendiente')
  if ((count ?? 0) >= MAX_PENDIENTES) {
    return errorApi(422, 'demasiados_borradores', `Tienes ${MAX_PENDIENTES} borradores sin revisar: revísalos o descártalos en Kuentas`)
  }
  const b = r.borrador
  const { data, error } = await svc
    .from('facturas_borrador_ia')
    .insert({
      user_id: userId,
      token_id: tokenId,
      datos: {
        cliente: b.cliente,
        fecha_operacion: b.fecha_operacion,
        iva_tipo: b.iva_tipo,
        irpf_tipo: b.irpf_tipo,
        iva_incluido: b.iva_incluido,
        operacion_exenta: b.operacion_exenta,
        exencion_detalle: b.exencion_detalle,
        dias_vencimiento: b.dias_vencimiento,
        notas: b.notas,
        lineas: b.lineas,
      },
      base: b.importes.subtotal,
      iva: b.importes.iva,
      irpf: b.importes.irpf,
      total: b.importes.total,
    })
    .select('id, estado, datos, base, iva, irpf, total, creado_at')
    .single()
  if (error) throw error
  return NextResponse.json(
    {
      ...borradorPublico(data),
      estado_fiscal: 'borrador',
      simplificada: b.simplificada,
      aviso: 'Borrador sin emitir: revísalo y guárdalo o emítelo en Kuentas. Todavía no es una factura.',
    },
    { status: 201 }
  )
})
