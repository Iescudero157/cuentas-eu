// Cobro de los planes (13-nov-2026): aplicación del pago común a Stripe y Redsys (lib/pago-plan.ts) y cobro con
// Stripe Checkout en pago único (lib/pago-stripe.ts). Sin red ni base de datos: un doble de Supabase en memoria
// con la semántica que importa (filtros eq/is, UPDATE condicionado que devuelve las filas cambiadas).
// Ejecutar (Node >= 22.18, con type-stripping nativo de TypeScript): npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { aplicarPagoDePlan } from '../pago-plan.ts'
import {
  APP_STRIPE,
  IMPORTE_PRUEBA_CENTIMOS,
  aplicarSesionStripe,
  cerrarSesionAnterior,
  esCuentaDePrueba,
  parametrosSesion,
} from '../pago-stripe.ts'
import { PASARELA_COBRO } from '../pasarela.ts'

const AHORA = new Date('2026-11-13T10:00:00Z')
const USUARIO = '11111111-2222-3333-4444-555555555555'

// ── Doble de Supabase ───────────────────────────────────────────────────────────────────────────────────────────
class Consulta {
  constructor(bd) {
    this.bd = bd
    this.filtros = []
    this.modo = 'select'
    this.cambios = null
    this.limite = Infinity
    this.devolver = false
  }
  select() {
    if (this.modo === 'update') this.devolver = true
    return this
  }
  update(cambios) {
    this.modo = 'update'
    this.cambios = cambios
    return this
  }
  eq(col, val) {
    this.filtros.push((f) => f[col] === val)
    return this
  }
  is(col, val) {
    this.filtros.push((f) => (f[col] ?? null) === val)
    return this
  }
  limit(n) {
    this.limite = n
    return this
  }
  then(resolve, reject) {
    try {
      resolve(this.ejecutar())
    } catch (e) {
      reject(e)
    }
  }
  ejecutar() {
    const coinciden = this.bd.filas.filter((f) => this.filtros.every((p) => p(f)))
    if (this.modo === 'select') {
      this.bd.lecturas++
      if (this.bd.errorLectura) return { data: null, error: { message: 'base de datos caída' } }
      return { data: coinciden.slice(0, this.limite).map((f) => ({ ...f })), error: null }
    }
    this.bd.updates.push(this.cambios)
    const error = this.bd.errorUpdate?.(this.cambios)
    if (error) return { data: null, error }
    for (const f of coinciden) Object.assign(f, structuredClone(this.cambios))
    return { data: this.devolver ? coinciden.map((f) => ({ id: f.id })) : null, error: null }
  }
}

function bd(filas, opciones = {}) {
  const base = { filas, lecturas: 0, updates: [], ...opciones }
  base.from = (tabla) => {
    assert.equal(tabla, 'profiles')
    return new Consulta(base)
  }
  return base
}

function perfil(extra = {}) {
  return {
    id: USUARIO,
    plan: 'gratis',
    plan_expires_at: null,
    plan_avisos_enviados: ['d7@2026-11-20'],
    redsys_order_pending: null,
    redsys_plan_pending: null,
    ...extra,
  }
}

function sesion(extra = {}, metadata = {}) {
  return {
    id: 'cs_live_prueba0001',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 999,
    currency: 'eur',
    metadata: { app: APP_STRIPE, supabase_user_id: USUARIO, plan: 'autonomo', tipo: 'plan_un_mes', ...metadata },
    ...extra,
  }
}

// ── aplicarPagoDePlan (común a Redsys y Stripe) ─────────────────────────────────────────────────────────────────
test('Redsys: activa el plan pendiente, un mes desde hoy, vacía pedido y avisos', async () => {
  const db = bd([perfil({ redsys_order_pending: '5551234ABCD1', redsys_plan_pending: 'creator' })])
  const r = await aplicarPagoDePlan(db, { origen: 'redsys', pedido: '5551234ABCD1', importeCentimos: 1999, ahora: AHORA })
  assert.equal(r.estado, 'aplicado')
  assert.equal(r.plan, 'creator')
  assert.equal(r.caducidad, '2026-12-13T10:00:00.000Z')
  const f = db.filas[0]
  assert.equal(f.plan, 'creator')
  assert.equal(f.plan_expires_at, '2026-12-13T10:00:00.000Z')
  assert.deepEqual(f.plan_avisos_enviados, [])
  assert.equal(f.redsys_order_pending, null)
  assert.equal(f.redsys_plan_pending, null)
  assert.equal(db.updates.length, 1, 'un solo UPDATE: plan, caducidad y pedido a la vez')
})

test('renovar con el plan vigente suma el mes a la caducidad (no se pierden días)', async () => {
  const db = bd([
    perfil({ plan: 'autonomo', plan_expires_at: '2026-11-20T09:00:00.000Z', redsys_order_pending: 'cs_live_x', redsys_plan_pending: 'autonomo' }),
  ])
  const r = await aplicarPagoDePlan(db, { origen: 'stripe', pedido: 'cs_live_x', usuario: USUARIO, plan: 'autonomo', importeCentimos: 999, ahora: AHORA })
  assert.equal(r.estado, 'aplicado')
  assert.equal(db.filas[0].plan_expires_at, '2026-12-20T09:00:00.000Z')
})

test('aviso repetido del mismo pedido: no vuelve a sumar el mes', async () => {
  const db = bd([perfil({ redsys_order_pending: 'cs_live_x', redsys_plan_pending: 'autonomo' })])
  const pago = { origen: 'stripe', pedido: 'cs_live_x', usuario: USUARIO, plan: 'autonomo', importeCentimos: 999, ahora: AHORA }
  assert.equal((await aplicarPagoDePlan(db, pago)).estado, 'aplicado')
  const caducidad = db.filas[0].plan_expires_at
  assert.equal((await aplicarPagoDePlan(db, pago)).estado, 'sin_pedido')
  assert.equal(db.filas[0].plan_expires_at, caducidad)
  assert.equal(db.updates.length, 1)
})

test('dos avisos del mismo pago a la vez (webhook y vuelta del cliente): solo uno aplica', async () => {
  const db = bd([perfil({ redsys_order_pending: 'cs_live_x', redsys_plan_pending: 'autonomo' })])
  const pago = { origen: 'stripe', pedido: 'cs_live_x', usuario: USUARIO, plan: 'autonomo', importeCentimos: 999, ahora: AHORA }
  const [a, b] = await Promise.all([aplicarPagoDePlan(db, pago), aplicarPagoDePlan(db, pago)])
  assert.equal(db.lecturas, 2, 'los dos leyeron el pedido pendiente antes de que nadie lo aplicara')
  assert.deepEqual([a.estado, b.estado].sort(), ['aplicado', 'sin_pedido'])
  assert.equal(db.filas[0].plan_expires_at, '2026-12-13T10:00:00.000Z', 'un solo mes')
})

test('importe que no es el del plan: no activa nada y el pedido sigue pendiente', async () => {
  const db = bd([perfil({ redsys_order_pending: '5551234ABCD1', redsys_plan_pending: 'business' })])
  const r = await aplicarPagoDePlan(db, { origen: 'redsys', pedido: '5551234ABCD1', importeCentimos: 999, ahora: AHORA })
  assert.equal(r.estado, 'rechazado')
  assert.equal(db.filas[0].plan, 'gratis')
  assert.equal(db.filas[0].redsys_order_pending, '5551234ABCD1')
  assert.equal(db.updates.length, 0)
})

test('Redsys sin plan pendiente o con importe ilegible: no activa', async () => {
  const db = bd([perfil({ redsys_order_pending: 'A1', redsys_plan_pending: null })])
  assert.equal((await aplicarPagoDePlan(db, { origen: 'redsys', pedido: 'A1', importeCentimos: 999 })).estado, 'rechazado')
  const db2 = bd([perfil({ redsys_order_pending: 'A2', redsys_plan_pending: 'autonomo' })])
  assert.equal((await aplicarPagoDePlan(db2, { origen: 'redsys', pedido: 'A2', importeCentimos: Number.NaN })).estado, 'rechazado')
  assert.equal(db.updates.length + db2.updates.length, 0)
})

test('pedido desconocido, vacío o de otro usuario: sin_pedido', async () => {
  const db = bd([perfil({ redsys_order_pending: 'cs_live_x', redsys_plan_pending: 'autonomo' })])
  assert.equal((await aplicarPagoDePlan(db, { origen: 'redsys', pedido: 'OTRO', importeCentimos: 999 })).estado, 'sin_pedido')
  assert.equal((await aplicarPagoDePlan(db, { origen: 'redsys', pedido: '', importeCentimos: 999 })).estado, 'sin_pedido')
  const ajeno = { origen: 'stripe', pedido: 'cs_live_x', usuario: 'otro-usuario', plan: 'autonomo', importeCentimos: 999 }
  assert.equal((await aplicarPagoDePlan(db, ajeno)).estado, 'sin_pedido')
  assert.equal(db.filas[0].plan, 'gratis')
})

test('sin la migración de caducidad: activa el plan sin caducidad, como antes', async () => {
  const db = bd([perfil({ redsys_order_pending: 'A1', redsys_plan_pending: 'autonomo' })], {
    errorUpdate: (c) =>
      'plan_expires_at' in c
        ? { code: 'PGRST204', message: "Could not find the 'plan_expires_at' column of 'profiles' in the schema cache" }
        : null,
  })
  const r = await aplicarPagoDePlan(db, { origen: 'redsys', pedido: 'A1', importeCentimos: 999, ahora: AHORA })
  assert.equal(r.estado, 'aplicado')
  assert.equal(r.caducidad, null)
  assert.equal(db.filas[0].plan, 'autonomo')
  assert.equal(db.filas[0].redsys_order_pending, null)
})

test('fallo de la base de datos: error (para reintentar) y nada cambiado', async () => {
  const db = bd([perfil({ redsys_order_pending: 'A1', redsys_plan_pending: 'autonomo' })], {
    errorUpdate: () => ({ code: 'XX000', message: 'caída' }),
  })
  const r = await aplicarPagoDePlan(db, { origen: 'redsys', pedido: 'A1', importeCentimos: 999 })
  assert.equal(r.estado, 'error')
  assert.equal(db.filas[0].plan, 'gratis')
  assert.equal(db.filas[0].redsys_order_pending, 'A1')
  const caida = bd([perfil()], { errorLectura: true })
  assert.equal((await aplicarPagoDePlan(caida, { origen: 'redsys', pedido: 'A1', importeCentimos: 999 })).estado, 'error')
})

// ── Stripe ──────────────────────────────────────────────────────────────────────────────────────────────────────
test('el interruptor de pasarela está en Stripe', () => {
  assert.equal(PASARELA_COBRO, 'stripe')
})

test('parametrosSesion: pago único de un mes, sin suscripción, con el importe del plan', () => {
  const p = parametrosSesion({ usuario: USUARIO, email: 'cliente@example.com', plan: 'creator', appUrl: 'https://app.kuentas.eu' })
  assert.equal(p.mode, 'payment')
  assert.equal('subscription_data' in p, false)
  assert.deepEqual(p.payment_method_types, ['card'])
  assert.equal(p.line_items.length, 1)
  assert.equal(p.line_items[0].quantity, 1)
  assert.equal(p.line_items[0].price_data.currency, 'eur')
  assert.equal(p.line_items[0].price_data.unit_amount, 1999)
  assert.match(p.line_items[0].price_data.product_data.name, /Plan Creator · 1 mes$/)
  assert.deepEqual(p.metadata, { app: 'kuentas', supabase_user_id: USUARIO, plan: 'creator', tipo: 'plan_un_mes' })
  assert.deepEqual(p.payment_intent_data.metadata, p.metadata)
  assert.equal(p.client_reference_id, USUARIO)
  assert.equal(p.customer_email, 'cliente@example.com')
  assert.equal(p.success_url, 'https://app.kuentas.eu/dashboard/ajustes?pago=stripe&session_id={CHECKOUT_SESSION_ID}')
  assert.equal(p.cancel_url, 'https://app.kuentas.eu/precios')
  const desdeAjustes = parametrosSesion({ usuario: USUARIO, plan: 'autonomo', appUrl: 'https://app.kuentas.eu', origen: 'ajustes' })
  assert.equal(desdeAjustes.cancel_url, 'https://app.kuentas.eu/dashboard/ajustes?renovar=1')
  assert.equal('customer_email' in desdeAjustes, false)
  assert.equal(desdeAjustes.line_items[0].price_data.unit_amount, 999)
})

test('parametrosSesion: el pago de prueba cobra 1,00 € y lo marca', () => {
  const p = parametrosSesion({ usuario: USUARIO, plan: 'business', prueba: true, appUrl: 'https://app.kuentas.eu' })
  assert.equal(p.line_items[0].price_data.unit_amount, IMPORTE_PRUEBA_CENTIMOS)
  assert.equal(IMPORTE_PRUEBA_CENTIMOS, 100)
  assert.equal(p.metadata.prueba, '1')
  assert.match(p.line_items[0].price_data.product_data.name, /pago de prueba/)
})

test('esCuentaDePrueba: lista de emails separada por comas, sin distinguir mayúsculas', () => {
  assert.equal(esCuentaDePrueba('Ivan@Example.com', 'otro@example.com, ivan@example.com'), true)
  assert.equal(esCuentaDePrueba('ivan@example.com', undefined), false)
  assert.equal(esCuentaDePrueba('ivan@example.com', ''), false)
  assert.equal(esCuentaDePrueba(null, 'ivan@example.com'), false)
  assert.equal(esCuentaDePrueba('ivan@example.com', 'ivan@example.co'), false)
})

test('aplicarSesionStripe: las sesiones de otras webs de la cuenta no se tocan', async () => {
  const db = bd([perfil({ redsys_order_pending: 'cs_live_prueba0001', redsys_plan_pending: 'autonomo' })])
  assert.equal((await aplicarSesionStripe(db, sesion({}, { app: 'ofizio' }))).estado, 'ajena')
  assert.equal((await aplicarSesionStripe(db, sesion({ metadata: { supabase_user_id: USUARIO, plan: 'autonomo' } }))).estado, 'ajena')
  assert.equal((await aplicarSesionStripe(db, sesion({ mode: 'subscription' }))).estado, 'ajena')
  assert.equal(db.lecturas, 0)
})

test('aplicarSesionStripe: sin pagar todavía → pendiente', async () => {
  const db = bd([perfil({ redsys_order_pending: 'cs_live_prueba0001', redsys_plan_pending: 'autonomo' })])
  assert.equal((await aplicarSesionStripe(db, sesion({ payment_status: 'unpaid' }))).estado, 'pendiente')
  assert.equal((await aplicarSesionStripe(db, sesion({ status: 'open', payment_status: 'unpaid' }))).estado, 'pendiente')
  assert.equal(db.lecturas, 0)
})

test('aplicarSesionStripe: sesión pagada → un mes del plan, una sola vez', async () => {
  const db = bd([perfil({ redsys_order_pending: 'cs_live_prueba0001', redsys_plan_pending: 'autonomo' })])
  const r = await aplicarSesionStripe(db, sesion())
  assert.equal(r.estado, 'aplicado')
  assert.equal(db.filas[0].plan, 'autonomo')
  assert.ok(db.filas[0].plan_expires_at)
  assert.equal((await aplicarSesionStripe(db, sesion())).estado, 'sin_pedido')
})

test('aplicarSesionStripe: importe de prueba solo con la marca de prueba', async () => {
  const conMarca = bd([perfil({ redsys_order_pending: 'cs_live_prueba0001', redsys_plan_pending: 'autonomo' })])
  assert.equal((await aplicarSesionStripe(conMarca, sesion({ amount_total: 100 }, { prueba: '1' }))).estado, 'aplicado')
  const sinMarca = bd([perfil({ redsys_order_pending: 'cs_live_prueba0001', redsys_plan_pending: 'autonomo' })])
  assert.equal((await aplicarSesionStripe(sinMarca, sesion({ amount_total: 100 }))).estado, 'rechazado')
  assert.equal(sinMarca.filas[0].plan, 'gratis')
})

test('aplicarSesionStripe: moneda o plan que no cuadran → rechazado', async () => {
  const db = bd([perfil({ redsys_order_pending: 'cs_live_prueba0001', redsys_plan_pending: 'autonomo' })])
  assert.equal((await aplicarSesionStripe(db, sesion({ currency: 'usd' }))).estado, 'rechazado')
  assert.equal((await aplicarSesionStripe(db, sesion({}, { plan: 'gratis' }))).estado, 'rechazado')
  assert.equal((await aplicarSesionStripe(db, sesion({}, { supabase_user_id: '' }))).estado, 'rechazado')
  assert.equal(db.filas[0].plan, 'gratis')
})

// ── cerrarSesionAnterior (antes de abrir otra sesión) ──────────────────────────────────────────────────────────
function sesiones({ estado, errorRetrieve, errorExpire, despuesDeExpirar } = {}) {
  const llamadas = { retrieve: 0, expire: 0 }
  let actual = estado
  return {
    llamadas,
    async retrieve() {
      llamadas.retrieve++
      if (errorRetrieve) throw errorRetrieve
      return actual
    },
    async expire() {
      llamadas.expire++
      if (errorExpire) {
        actual = despuesDeExpirar ?? actual
        throw errorExpire
      }
      actual = { ...actual, status: 'expired' }
      return actual
    },
  }
}

test('cerrarSesionAnterior: una sesión abierta se cierra y se puede seguir', async () => {
  const s = sesiones({ estado: sesion({ status: 'open', payment_status: 'unpaid' }) })
  assert.equal(await cerrarSesionAnterior(s, bd([perfil()]), 'cs_live_prueba0001'), null)
  assert.equal(s.llamadas.expire, 1)
})

test('cerrarSesionAnterior: pagada sin aviso todavía → se aplica y no se abre otra', async () => {
  const db = bd([perfil({ redsys_order_pending: 'cs_live_prueba0001', redsys_plan_pending: 'autonomo' })])
  const s = sesiones({ estado: sesion() })
  const aviso = await cerrarSesionAnterior(s, db, 'cs_live_prueba0001')
  assert.match(aviso, /pago anterior ya está confirmado/)
  assert.equal(db.filas[0].plan, 'autonomo')
  assert.equal(s.llamadas.expire, 0)
})

test('cerrarSesionAnterior: se paga justo mientras se intenta cerrar → se aplica', async () => {
  const db = bd([perfil({ redsys_order_pending: 'cs_live_prueba0001', redsys_plan_pending: 'autonomo' })])
  const s = sesiones({
    estado: sesion({ status: 'open', payment_status: 'unpaid' }),
    errorExpire: new Error('Only Checkout Sessions with a status in ["open"] can be expired'),
    despuesDeExpirar: sesion(),
  })
  assert.match(await cerrarSesionAnterior(s, db, 'cs_live_prueba0001'), /ya está confirmado/)
  assert.equal(db.filas[0].plan, 'autonomo')
})

test('cerrarSesionAnterior: pago diferido sin confirmar → no se abre otra', async () => {
  const s = sesiones({ estado: sesion({ payment_status: 'unpaid' }) })
  assert.match(await cerrarSesionAnterior(s, bd([perfil()]), 'cs_live_prueba0001'), /pendiente de confirmar/)
})

test('cerrarSesionAnterior: caducada, o de otra cuenta de Stripe → se puede seguir', async () => {
  assert.equal(await cerrarSesionAnterior(sesiones({ estado: sesion({ status: 'expired', payment_status: 'unpaid' }) }), bd([perfil()]), 'cs_x'), null)
  const deOtraCuenta = Object.assign(new Error('No such checkout.session'), { code: 'resource_missing', statusCode: 404 })
  assert.equal(await cerrarSesionAnterior(sesiones({ errorRetrieve: deOtraCuenta }), bd([perfil()]), 'cs_x'), null)
})

test('cerrarSesionAnterior: si Stripe falla de otra forma, el error sube', async () => {
  const caida = Object.assign(new Error('API caída'), { statusCode: 500 })
  await assert.rejects(cerrarSesionAnterior(sesiones({ errorRetrieve: caida }), bd([perfil()]), 'cs_x'), /API caída/)
})
