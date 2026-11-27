// /conectar-ia — pantalla de consentimiento del conector MCP de Kuentas (27-nov-2026).
// Llega desde el conector (mcp.kuentas.eu/authorize) con ?estado&cliente&permisos&vuelta. Con sesión iniciada,
// el usuario ve qué podrá hacer la IA y decide; el formulario va a /api/conexiones-ia/autorizar.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizarPermisos, vueltaPermitida } from '@/lib/api-v1/tokens'

export const dynamic = 'force-dynamic'

type Params = Promise<Record<string, string | string[] | undefined>>

export default async function ConectarIaPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams
  const uno = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? ''
  const vuelta = uno('vuelta')
  const estado = uno('estado').slice(0, 100)
  const cliente = (uno('cliente') || 'Asistente de IA').slice(0, 120)
  const permisos = normalizarPermisos(uno('permisos'))

  if (!vueltaPermitida(vuelta, process.env.MCP_CALLBACK_URLS)) {
    return (
      <main className="max-w-lg mx-auto p-8">
        <h1 className="text-xl font-bold mb-2">Conexión no reconocida</h1>
        <p>Este enlace no viene del conector oficial de Kuentas. Vuelve a conectar desde tu asistente de IA.</p>
      </main>
    )
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const aqui = `/conectar-ia?${new URLSearchParams({ estado, cliente, permisos: permisos.join(' '), vuelta }).toString()}`
    redirect(`/login?redirect=${encodeURIComponent(aqui)}`)
  }
  const pideBorradores = permisos.includes('kuentas:borradores')

  return (
    <main className="max-w-lg mx-auto p-6 sm:p-8">
      <h1 className="text-2xl font-bold mb-1">Conectar con tu asistente de IA</h1>
      <p className="text-gray-600 mb-6">
        <strong>{cliente}</strong> quiere acceder a tu cuenta de Kuentas ({user.email}).
      </p>
      <div className="rounded-xl border p-4 mb-4">
        <p className="font-semibold mb-2">Podrá:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Ver tu perfil, tus facturas, clientes y resúmenes, y el estado de VERI*FACTU.</li>
          {pideBorradores && <li>Si lo marcas abajo: crear clientes y <strong>borradores</strong> de factura.</li>}
        </ul>
        <p className="font-semibold mt-4 mb-2">No podrá:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Emitir, enviar, anular, rectificar ni borrar facturas: eso lo haces tú en Kuentas.</li>
          <li>Cambiar tus ajustes, tu plan ni tu certificado digital.</li>
        </ul>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Lo que la IA lea de Kuentas (por ejemplo, nombres y NIF de tus clientes o importes) pasará al asistente que usas y se
        tratará según sus condiciones. Puedes revocar esta conexión cuando quieras en Ajustes → Conexiones con IA.
      </p>
      <form method="post" action="/api/conexiones-ia/autorizar" className="space-y-4">
        <input type="hidden" name="vuelta" value={vuelta} />
        <input type="hidden" name="estado" value={estado} />
        <input type="hidden" name="cliente" value={cliente} />
        <input type="hidden" name="permisos" value={permisos.join(' ')} />
        {pideBorradores && (
          <label className="flex gap-2 items-start text-sm">
            <input type="checkbox" name="borradores" value="1" className="mt-1" />
            <span>Permitir que prepare <strong>borradores</strong> de factura y dé de alta clientes.</span>
          </label>
        )}
        <div className="flex gap-3">
          <button name="decision" value="permitir" className="px-4 py-2 rounded-lg bg-brand-blue text-white font-semibold">Permitir</button>
          <button name="decision" value="denegar" className="px-4 py-2 rounded-lg border">Cancelar</button>
        </div>
      </form>
    </main>
  )
}
