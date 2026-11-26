// Factura automática de un cobro del TPV central (www.ivanescudero.com/tpv) con el motor VERI*FACTU
// (Iván, 25-nov-2026: «generar una factura cada vez que se cobre»).
//
// Lógica pura, sin red ni base de datos, para poder probarla: validación de la petición del TPV,
// importes con el IVA incluido, clase de factura (completa o simplificada) y fila de `invoices`.
// La usa app/api/tpv/factura/route.ts. La numeración fiscal y la serie (F completas, S simplificadas)
// las pone sif_emitir_factura al emitir; el número que se guarda antes es provisional.

import { normalizarNif, situacionNifCliente } from '../verifactu/factura-fiscal.ts'
import { fechaHoyEspana } from '../invoices/numeracion.ts'

export const EMPRESAS_TPV = ['milbrotes', 'mercadonet'] as const
export type EmpresaTpv = (typeof EMPRESAS_TPV)[number]

/**
 * NIF del obligado de cada empresa del TPV. La ruta busca con él su cuenta de Kuentas en `sif_config`
 * (VERI*FACTU activo) cuando no hay TPV_FACTURAS_USUARIO_* en Vercel.
 */
export const NIF_EMPRESA_TPV: Readonly<Record<EmpresaTpv, string>> = Object.freeze({
  milbrotes: 'B05772710',
  mercadonet: 'B98407901',
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Cuenta de Kuentas que factura los cobros de una empresa. Manda el id fijado en Vercel; si no lo hay,
 * la única configuración VERI*FACTU activa con el NIF de la empresa. Con cero o más de una, null: no se
 * adivina a quién facturar.
 */
export function usuarioFacturador(idFijado: string | undefined, activasConNif: readonly { user_id: string }[]): string | null {
  const fijo = (idFijado ?? '').trim()
  if (fijo !== '') return UUID.test(fijo) ? fijo : null
  return activasConNif.length === 1 && UUID.test(activasConNif[0].user_id) ? activasConNif[0].user_id : null
}

export const PASARELAS_TPV = ['stripe', 'bbva', 'redsys_mercadonet'] as const
export type PasarelaTpv = (typeof PASARELAS_TPV)[number]

/** Factura simplificada hasta 400 € con el IVA incluido (art. 4.1.a RD 1619/2012). */
export const LIMITE_SIMPLIFICADA_CENT = 40000
/** Los precios de la web llevan el IVA incluido (Iván, 25-nov-2026); tipo general. */
export const TIPO_IVA = 21

export interface ClienteTpv {
  nombre?: string
  nif?: string
  email?: string
  direccion?: string
}

export interface PeticionFacturaTpv {
  empresa: EmpresaTpv
  /** Número de pedido del TPV (el mismo de Redsys o Stripe). */
  pedido: string
  pasarela: PasarelaTpv
  /** tarjeta, bizum, paypal... (solo informativo). */
  metodo?: string
  /** Fecha del cobro, `aaaa-mm-dd` (hora de España). */
  fecha: string
  /** Total cobrado, en céntimos, con el IVA incluido. */
  importe_cent: number
  concepto: string
  cliente?: ClienteTpv
}

export type ResultadoValidacion =
  | { ok: true; peticion: PeticionFacturaTpv }
  | { ok: false; error: string }

const TOPE_CENT = 10_000_000 // 100.000 €: por encima, algo va mal

function texto(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : undefined
}

export function validarPeticion(body: unknown): ResultadoValidacion {
  if (!body || typeof body !== 'object') return { ok: false, error: 'El cuerpo debe ser un objeto JSON' }
  const b = body as Record<string, unknown>
  const empresa = String(b.empresa ?? '').toLowerCase()
  if (!(EMPRESAS_TPV as readonly string[]).includes(empresa)) return { ok: false, error: 'empresa desconocida' }
  const pasarela = String(b.pasarela ?? '').toLowerCase()
  if (!(PASARELAS_TPV as readonly string[]).includes(pasarela)) return { ok: false, error: 'pasarela desconocida' }
  const pedido = String(b.pedido ?? '')
  if (!/^[0-9A-Za-z]{4,12}$/.test(pedido)) return { ok: false, error: 'pedido no válido' }
  const fecha = String(b.fecha ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha + 'T00:00:00Z'))) {
    return { ok: false, error: 'fecha no válida (aaaa-mm-dd)' }
  }
  const importe = b.importe_cent
  if (typeof importe !== 'number' || !Number.isInteger(importe) || importe <= 0 || importe > TOPE_CENT) {
    return { ok: false, error: 'importe_cent debe ser un entero positivo en céntimos' }
  }
  const concepto = texto(b.concepto, 500)
  if (!concepto) return { ok: false, error: 'falta el concepto' }
  const c = (b.cliente && typeof b.cliente === 'object' ? b.cliente : {}) as Record<string, unknown>
  const cliente: ClienteTpv = {
    nombre: texto(c.nombre, 200),
    nif: texto(c.nif, 20),
    email: texto(c.email, 200),
    direccion: texto(c.direccion, 300),
  }
  return {
    ok: true,
    peticion: {
      empresa: empresa as EmpresaTpv,
      pedido,
      pasarela: pasarela as PasarelaTpv,
      metodo: texto(b.metodo, 30),
      fecha,
      importe_cent: importe,
      concepto,
      cliente,
    },
  }
}

/** Base y cuota a partir del total con el IVA incluido, en céntimos (la cuota cuadra el total). */
export function importesIvaIncluido(totalCent: number, tipo: number = TIPO_IVA) {
  const baseCent = Math.round((totalCent * 100) / (100 + tipo))
  return { baseCent, cuotaCent: totalCent - baseCent, totalCent }
}

export type ClaseFactura = 'completa' | 'simplificada'

/**
 * Completa si el cliente da nombre y un NIF español válido. Si no, simplificada hasta 400 €.
 * Más de 400 € sin esos datos no se emite sola: hay que hacerla a mano con los datos del cliente
 * (nunca se inventan datos de un destinatario).
 */
export function claseFactura(p: PeticionFacturaTpv): { clase: ClaseFactura } | { error: 'datos_cliente_necesarios' } {
  const nif = p.cliente?.nif
  if (p.cliente?.nombre && nif && situacionNifCliente(nif) === 'valido') return { clase: 'completa' }
  if (p.importe_cent <= LIMITE_SIMPLIFICADA_CENT) return { clase: 'simplificada' }
  return { error: 'datos_cliente_necesarios' }
}

/** Marca con la que empieza `invoices.notes`: un pedido del TPV = una factura. */
export function marcaPedido(pedido: string): string {
  return `[TPV ${pedido}]`
}

const NOMBRE_PASARELA: Record<PasarelaTpv, string> = {
  stripe: 'Stripe',
  bbva: 'TPV virtual de BBVA',
  redsys_mercadonet: 'TPV virtual de MERCADONET (Redsys)',
}

/** Fila de `invoices` (en borrador) para emitirla después con emitirFactura(). */
// Se expide hoy (hora de España); si el cobro es de otro día (cola de reintento), su fecha va como fecha de
// la operación (art. 6.1.k RD 1619/2012), nunca como fecha de expedición atrasada (26-nov-2026).
export function filaInvoice(p: PeticionFacturaTpv, userId: string, clase: ClaseFactura, hoy: string = fechaHoyEspana()) {
  const { baseCent, cuotaCent, totalCent } = importesIvaIncluido(p.importe_cent)
  const eur = (cent: number) => cent / 100
  const completa = clase === 'completa'
  return {
    user_id: userId,
    number: `TPV-${p.pedido}`,
    client_name: completa ? (p.cliente?.nombre as string) : p.cliente?.nombre || 'Consumidor final',
    client_nif: completa ? normalizarNif(p.cliente?.nif as string) : null,
    client_address: p.cliente?.direccion ?? null,
    client_email: p.cliente?.email ?? null,
    items: [{ description: p.concepto, quantity: 1, unitPrice: eur(baseCent), total: eur(baseCent) }],
    subtotal: eur(baseCent),
    iva: eur(cuotaCent),
    iva_rate: TIPO_IVA,
    irpf: 0,
    irpf_rate: 0,
    total: eur(totalCent),
    date: hoy,
    ...(p.fecha < hoy ? { fecha_operacion: p.fecha } : {}),
    due_date: hoy,
    status: 'cobrada',
    payment_method: p.metodo ? `${p.pasarela}:${p.metodo}` : p.pasarela,
    payment_date: p.fecha,
    notes: `${marcaPedido(p.pedido)} Cobrado por ${NOMBRE_PASARELA[p.pasarela]}. Precio con el IVA incluido.`,
  }
}
