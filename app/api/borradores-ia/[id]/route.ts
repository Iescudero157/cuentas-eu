// Borradores preparados por la IA, desde la app (sesión del usuario; la RLS solo deja ver los propios).
//   GET  /api/borradores-ia/{id}  → datos para cargar el borrador en «Nueva factura»
//   POST /api/borradores-ia/{id}  → { accion: 'convertido', invoice_id } o { accion: 'descartado' }
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data } = await supabase
    .from('facturas_borrador_ia')
    .select('id, estado, datos, base, iva, irpf, total, creado_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ borrador: data })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  let cuerpo: { accion?: string; invoice_id?: string } = {}
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 })
  }
  if (cuerpo.accion !== 'convertido' && cuerpo.accion !== 'descartado') {
    return NextResponse.json({ error: 'accion: convertido o descartado' }, { status: 400 })
  }
  const invoice = cuerpo.accion === 'convertido' && cuerpo.invoice_id && UUID.test(cuerpo.invoice_id) ? cuerpo.invoice_id : null
  const { data, error } = await supabase.rpc('borrador_ia_cerrar', { p_id: id, p_estado: cuerpo.accion, p_invoice: invoice })
  if (error) return NextResponse.json({ error: 'No se pudo actualizar el borrador' }, { status: 500 })
  return NextResponse.json({ ok: data === true })
}
