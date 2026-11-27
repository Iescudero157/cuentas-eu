// POST /api/conexiones-ia/autorizar — respuesta del formulario de /conectar-ia (usuario con sesión).
// Crea un código de un solo uso (2 minutos) y vuelve al conector MCP, solo a las URL de MCP_CALLBACK_URLS.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clienteServicio } from '@/lib/supabase/servicio'
import { generarCodigo, normalizarPermisos, vueltaPermitida } from '@/lib/api-v1/tokens'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const form = await request.formData()
  const vuelta = String(form.get('vuelta') ?? '')
  const estado = String(form.get('estado') ?? '').slice(0, 100)
  if (!vueltaPermitida(vuelta, process.env.MCP_CALLBACK_URLS)) {
    return NextResponse.json({ error: 'vuelta_no_permitida', mensaje: 'Este conector no está autorizado en Kuentas' }, { status: 400 })
  }
  const destino = new URL(vuelta)
  destino.searchParams.set('estado', estado)
  if (form.get('decision') !== 'permitir') {
    destino.searchParams.set('error', 'access_denied')
    return NextResponse.redirect(destino, 303)
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'no_autorizado', mensaje: 'Inicia sesión en Kuentas' }, { status: 401 })

  const pedidos = normalizarPermisos(String(form.get('permisos') ?? ''))
  const permisos = pedidos.filter((p) => p === 'kuentas:leer' || form.get('borradores') === '1')
  const svc = clienteServicio()
  if (!svc) return NextResponse.json({ error: 'no_disponible', mensaje: 'Sin configurar' }, { status: 503 })
  const { codigo, hash } = generarCodigo()
  const { error } = await svc.from('api_codigos_conexion').insert({
    hash,
    user_id: user.id,
    permisos,
    cliente: String(form.get('cliente') ?? 'Asistente de IA').slice(0, 120),
    caduca_at: new Date(Date.now() + 120_000).toISOString(),
  })
  if (error) {
    console.error('autorizar: no se pudo crear el código', error)
    return NextResponse.json({ error: 'interno', mensaje: 'No se pudo completar la conexión' }, { status: 500 })
  }
  destino.searchParams.set('codigo', codigo)
  return NextResponse.redirect(destino, 303)
}
