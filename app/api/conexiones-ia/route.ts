// Ajustes → Conexiones con IA (sesión del usuario).
//   GET  /api/conexiones-ia            → conexiones (sin hashes) y los borradores de la IA pendientes de revisar
//   POST /api/conexiones-ia { id }     → revoca esa conexión (rpc api_token_revocar, solo las propias)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const [{ data: conexiones }, { data: borradores }] = await Promise.all([
    supabase
      .from('api_tokens')
      .select('id, nombre, origen, prefijo, permisos, creado_at, ultimo_uso_at, revocado_at')
      .eq('user_id', user.id)
      .order('creado_at', { ascending: false })
      .limit(50),
    supabase
      .from('facturas_borrador_ia')
      .select('id, datos, total, creado_at')
      .eq('user_id', user.id)
      .eq('estado', 'pendiente')
      .order('creado_at', { ascending: false })
      .limit(20),
  ])
  return NextResponse.json({
    conexiones: conexiones ?? [],
    borradores: (borradores ?? []).map((b) => ({ id: b.id, cliente: b.datos?.cliente?.nombre ?? '', total: Number(b.total), creado: b.creado_at })),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  let id = ''
  try {
    id = String(((await request.json()) as { id?: unknown }).id ?? '')
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 })
  }
  if (!UUID.test(id)) return NextResponse.json({ error: 'id no válido' }, { status: 400 })
  const { data, error } = await supabase.rpc('api_token_revocar', { p_id: id })
  if (error) return NextResponse.json({ error: 'No se pudo revocar' }, { status: 500 })
  return NextResponse.json({ ok: data === true })
}
