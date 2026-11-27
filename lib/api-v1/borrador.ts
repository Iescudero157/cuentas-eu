// API v1 · Validación de los borradores de factura que prepara la IA (27-nov-2026).
// Mismas reglas que la app al crear una factura (app/api/invoices/route.ts y el formulario):
// IVA 21/10/4/0 %, causa de exención con el 0 %, solo NIF españoles, simplificada sin NIF hasta 400 €,
// fecha de operación no futura, importes al céntimo y «IVA incluido» exacto (lib/invoices/importes.ts).
// Un borrador NO es una factura: no lleva número ni registro VERI*FACTU (lo convierte el usuario en la app).
import { calcularImportes, type ImportesFactura } from '../invoices/importes.ts'
import { validarFechaOperacion } from '../invoices/numeracion.ts'
import {
  LIMITE_SIMPLIFICADA_GENERAL,
  normalizarNif,
  situacionNifCliente,
  validarExencion,
} from '../verifactu/factura-fiscal.ts'

export const MAX_LINEAS_BORRADOR = 50
const IVAS = [21, 10, 4, 0]
const IRPFS = [0, 7, 15]
const VENCIMIENTOS = [0, 15, 30, 60, 90]

export interface ClienteBorrador {
  id?: string | null
  nombre: string
  nif: string | null
  direccion: string | null
  email: string | null
}

export interface BorradorValidado {
  cliente: ClienteBorrador
  fecha_operacion: string | null
  iva_tipo: number
  irpf_tipo: number
  iva_incluido: boolean
  operacion_exenta: string | null
  exencion_detalle: string | null
  dias_vencimiento: number
  notas: string | null
  /** Líneas tal como llegaron (con IVA incluido si iva_incluido): la app las vuelve a calcular igual. */
  lineas: { description: string; quantity: number; unitPrice: number }[]
  importes: ImportesFactura
  simplificada: boolean
}

export type ResultadoBorrador = { ok: true; borrador: BorradorValidado } | { ok: false; error: string; mensaje: string }

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.replace(/[\u0000-\u001F]+/g, ' ').trim()
  return t === '' ? null : t.slice(0, max)
}
const mal = (error: string, mensaje: string): ResultadoBorrador => ({ ok: false, error, mensaje })

/**
 * Valida la entrada de POST /api/v1/facturas/borradores. `clienteGuardado` es el cliente de la cuenta si la
 * petición trae `cliente_id` (lo busca la ruta, filtrando por el usuario); `hoy` en hora de España.
 */
export function validarBorrador(entrada: unknown, clienteGuardado: ClienteBorrador | null, hoy: string): ResultadoBorrador {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) return mal('cuerpo', 'El cuerpo debe ser un objeto JSON')
  const e = entrada as Record<string, unknown>

  let cliente: ClienteBorrador
  if (clienteGuardado) cliente = clienteGuardado
  else {
    const c = (typeof e.cliente === 'object' && e.cliente !== null ? e.cliente : {}) as Record<string, unknown>
    const nombre = texto(c.nombre, 160)
    if (!nombre || nombre.length < 2) return mal('cliente', 'Indica cliente_id o el nombre del cliente')
    cliente = { nombre, nif: texto(c.nif, 20), direccion: texto(c.direccion, 300), email: texto(c.email, 160) }
  }
  const sitNif = situacionNifCliente(cliente.nif)
  if (sitNif === 'invalido') {
    return mal('nif', 'Ese NIF no es un NIF español válido. Kuentas todavía no admite documentos extranjeros (NIF-IVA, pasaporte…).')
  }
  cliente = { ...cliente, nif: sitNif === 'valido' ? normalizarNif(cliente.nif) : null }
  if (cliente.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) return mal('email', 'El correo del cliente no es válido')

  const iva = e.iva_tipo === undefined ? 21 : Number(e.iva_tipo)
  const irpf = e.irpf_tipo === undefined ? 15 : Number(e.irpf_tipo)
  if (!IVAS.includes(iva)) return mal('iva', 'El IVA debe ser 21, 10, 4 o 0 %')
  if (!IRPFS.includes(irpf)) return mal('irpf', 'La retención de IRPF debe ser 0, 7 o 15 %')
  const exencion = validarExencion(iva, e.causa_exencion, e.detalle_exencion)
  if (!exencion.ok) return mal('exencion', exencion.error)

  const fop = validarFechaOperacion(hoy, e.fecha_operacion, hoy)
  if (!fop.ok) return mal('fecha_operacion', fop.error)

  const dias = e.dias_vencimiento === undefined ? 30 : Number(e.dias_vencimiento)
  if (!VENCIMIENTOS.includes(dias)) return mal('vencimiento', 'dias_vencimiento debe ser 0, 15, 30, 60 o 90')

  if (!Array.isArray(e.lineas) || e.lineas.length < 1 || e.lineas.length > MAX_LINEAS_BORRADOR) {
    return mal('lineas', `Entre 1 y ${MAX_LINEAS_BORRADOR} líneas`)
  }
  const lineas = []
  for (const bruta of e.lineas) {
    const l = (typeof bruta === 'object' && bruta !== null ? bruta : {}) as Record<string, unknown>
    const concepto = texto(l.concepto, 300)
    const cantidad = Number(l.cantidad)
    const precio = Number(l.precio_unitario)
    if (!concepto || concepto.length < 2) return mal('linea', 'Cada línea necesita un concepto')
    if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 100000) return mal('linea', 'La cantidad debe ser mayor que 0')
    if (!Number.isFinite(precio) || precio < 0 || precio > 1000000) return mal('linea', 'El precio unitario no puede ser negativo')
    lineas.push({ description: concepto, quantity: cantidad, unitPrice: precio })
  }
  const ivaIncluido = e.iva_incluido === true
  const importes = calcularImportes(lineas, iva, irpf, ivaIncluido)
  const simplificada = !cliente.nif
  if (simplificada && importes.total > LIMITE_SIMPLIFICADA_GENERAL) {
    return mal('simplificada', `Sin NIF del cliente el total no puede pasar de ${LIMITE_SIMPLIFICADA_GENERAL} €: añade el NIF del cliente.`)
  }
  return {
    ok: true,
    borrador: {
      cliente,
      fecha_operacion: fop.valor,
      iva_tipo: iva,
      irpf_tipo: irpf,
      iva_incluido: ivaIncluido,
      operacion_exenta: exencion.operacion_exenta,
      exencion_detalle: exencion.exencion_detalle,
      dias_vencimiento: dias,
      notas: texto(e.notas, 1000),
      lineas,
      importes,
      simplificada,
    },
  }
}
