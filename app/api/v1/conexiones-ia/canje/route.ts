// API v1 · POST /api/v1/conexiones-ia/canje — SOLO para el conector MCP (servidor a servidor).
// El conector manda el código de un solo uso que /conectar-ia le dio al usuario y recibe un token personal
// (origen 'mcp') con los permisos que el usuario concedió. Protegido con MCP_CONECTOR_SECRET (≥ 32 caracteres).
import { NextResponse } from 'next/server'
import { clienteServicio } from '@/lib/supabase/servicio'
import { generarToken, hashToken, secretoValido } from '@/lib/api-v1/tokens'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!secretoValido(request.headers.get('authorization'), process.env.MCP_CONECTOR_SECRET)) {
    return NextResponse.json({ error: 'no_autorizado', mensaje: 'Secreto del conector incorrecto' }, { status: 401 })
  }
  const svc = clienteServicio()
  if (!svc) return NextResponse.json({ error: 'no_disponible', mensaje: 'Sin configurar' }, { status: 503 })
  let codigo = ''
  try {
    codigo = String(((await request.json()) as { codigo?: unknown }).codigo ?? '')
  } catch {
    return NextResponse.json({ error: 'peticion', mensaje: 'Cuerpo JSON inválido' }, { status: 400 })
  }
  if (codigo.length < 20 || codigo.length > 100) return NextResponse.json({ error: 'codigo_invalido', mensaje: 'Código no válido' }, { status: 400 })

  // Se marca usado en la misma sentencia que lo comprueba: un código solo se canjea una vez.
  const { data: c } = await svc
    .from('api_codigos_conexion')
    .update({ usado_at: new Date().toISOString() })
    .eq('hash', hashToken(codigo))
    .is('usado_at', null)
    .gt('caduca_at', new Date().toISOString())
    .select('user_id, permisos, cliente')
    .maybeSingle()
  if (!c) return NextResponse.json({ error: 'codigo_invalido', mensaje: 'Código caducado o ya usado' }, { status: 400 })

  const t = generarToken()
  const { error } = await svc.from('api_tokens').insert({
    user_id: c.user_id,
    nombre: `Conector MCP · ${c.cliente}`.slice(0, 120),
    origen: 'mcp',
    hash: t.hash,
    prefijo: t.prefijo,
    permisos: c.permisos,
  })
  if (error) {
    console.error('canje: no se pudo crear el token', error)
    return NextResponse.json({ error: 'interno', mensaje: 'No se pudo crear la conexión' }, { status: 500 })
  }
  const { data: p } = await svc.from('profiles').select('name, email').eq('id', c.user_id).maybeSingle()
  return NextResponse.json({ usuario_id: c.user_id, email: p?.email ?? null, nombre: p?.name ?? null, permisos: c.permisos, token_api: t.token })
}
