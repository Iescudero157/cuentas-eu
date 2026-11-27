// API v1 · GET /api/v1/clientes (kuentas:leer) y POST /api/v1/clientes (kuentas:borradores).
import { NextResponse } from 'next/server'
import { errorApi, leerJson, rutaApi } from '@/lib/api-v1/contexto'
import { normalizarNif, situacionNifCliente } from '@/lib/verifactu/factura-fiscal'

export const dynamic = 'force-dynamic'
const publico = (c: Record<string, any>) => ({ id: c.id, nombre: c.name, nif: c.nif ?? null, email: c.email ?? null, direccion: c.address ?? null })

export const GET = rutaApi('/clientes', 'kuentas:leer', async ({ svc, userId }, request) => {
  const q = new URL(request.url).searchParams
  const buscar = (q.get('buscar') ?? '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 80)
  const limite = Math.min(Math.max(Number(q.get('limite') ?? 25) || 25, 1), 100)
  let consulta = svc.from('clients').select('id, name, nif, email, address').eq('user_id', userId)
  if (buscar) consulta = consulta.or(`name.ilike.%${buscar}%,nif.ilike.%${buscar}%`)
  const { data, error } = await consulta.order('name').limit(limite)
  if (error) throw error
  return NextResponse.json({ clientes: (data ?? []).map(publico) })
})

export const POST = rutaApi('/clientes', 'kuentas:borradores', async ({ svc, userId }, request) => {
  const b = (await leerJson(request)) as Record<string, unknown>
  const nombre = typeof b?.nombre === 'string' ? b.nombre.trim().slice(0, 160) : ''
  if (nombre.length < 2) return errorApi(422, 'nombre', 'Falta el nombre del cliente')
  const nif = typeof b.nif === 'string' ? b.nif : ''
  const sit = situacionNifCliente(nif)
  if (sit === 'invalido') return errorApi(422, 'nif', 'Ese NIF no es un NIF español válido. Kuentas todavía no admite documentos extranjeros.')
  const email = typeof b.email === 'string' && b.email.trim() ? b.email.trim().slice(0, 160) : null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorApi(422, 'email', 'El correo no es válido')
  const { data, error } = await svc
    .from('clients')
    .insert({
      user_id: userId,
      name: nombre,
      nif: sit === 'valido' ? normalizarNif(nif) : null,
      email,
      address: typeof b.direccion === 'string' && b.direccion.trim() ? b.direccion.trim().slice(0, 300) : null,
    })
    .select('id, name, nif, email, address')
    .single()
  if (error) throw error
  return NextResponse.json(publico(data), { status: 201 })
})
