// Caducidad mensual de los planes (lib/plan.ts, 8-nov-2026).
// Ejecutar (Node >= 22.18, con type-stripping nativo de TypeScript): npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DIAS_GRACIA,
  IMPORTE_CENTIMOS,
  avisoQueToca,
  claveAviso,
  diasNaturalesHasta,
  estadoPlan,
  nuevaCaducidad,
  planEfectivo,
  sumarUnMes,
} from '../plan.ts'

const iso = (d) => d.toISOString()

test('sumarUnMes: mes natural, con el último día si el día no existe', () => {
  assert.equal(iso(sumarUnMes(new Date('2026-11-08T10:00:00Z'))), '2026-12-08T10:00:00.000Z')
  assert.equal(iso(sumarUnMes(new Date('2026-12-15T10:00:00Z'))), '2027-01-15T10:00:00.000Z')
  assert.equal(iso(sumarUnMes(new Date('2027-01-31T10:00:00Z'))), '2027-02-28T10:00:00.000Z')
  assert.equal(iso(sumarUnMes(new Date('2028-01-31T10:00:00Z'))), '2028-02-29T10:00:00.000Z')
  assert.equal(iso(sumarUnMes(new Date('2027-03-31T23:30:00Z'))), '2027-04-30T23:30:00.000Z')
})

test('nuevaCaducidad: la mayor entre ahora y la vigente, más un mes', () => {
  const ahora = new Date('2026-11-08T10:00:00Z')
  // Sin caducidad o caducada: desde ahora
  assert.equal(iso(nuevaCaducidad(null, ahora)), '2026-12-08T10:00:00.000Z')
  assert.equal(iso(nuevaCaducidad(undefined, ahora)), '2026-12-08T10:00:00.000Z')
  assert.equal(iso(nuevaCaducidad('2026-10-01T00:00:00Z', ahora)), '2026-12-08T10:00:00.000Z')
  assert.equal(iso(nuevaCaducidad('no es fecha', ahora)), '2026-12-08T10:00:00.000Z')
  // Vigente: se suma a la caducidad (renovar antes no hace perder días)
  assert.equal(iso(nuevaCaducidad('2026-11-20T09:00:00Z', ahora)), '2026-12-20T09:00:00.000Z')
})

test('estadoPlan: gratis, sin caducidad, vigente, gracia y caducado', () => {
  const ahora = new Date('2026-11-08T10:00:00Z')
  assert.equal(estadoPlan({ plan: 'gratis' }, ahora).situacion, 'gratis')
  assert.equal(estadoPlan(null, ahora).efectivo, 'gratis')
  assert.equal(estadoPlan({ plan: 'raro' }, ahora).efectivo, 'gratis')

  // Antes de aplicar la migración no hay columna: el plan sigue como hasta ahora
  const sin = estadoPlan({ plan: 'creator' }, ahora)
  assert.equal(sin.situacion, 'sin_caducidad')
  assert.equal(sin.efectivo, 'creator')

  const vigente = estadoPlan({ plan: 'autonomo', plan_expires_at: '2026-11-15T10:00:00Z' }, ahora)
  assert.equal(vigente.situacion, 'vigente')
  assert.equal(vigente.efectivo, 'autonomo')
  assert.equal(vigente.diasParaCaducar, 7)

  const gracia = estadoPlan({ plan: 'business', plan_expires_at: '2026-11-05T10:00:00Z' }, ahora)
  assert.equal(gracia.situacion, 'gracia')
  assert.equal(gracia.efectivo, 'business')
  assert.equal(gracia.diasParaCaducar, -3)

  // Justo al acabar los 7 días de gracia pasa a Gratis
  const limite = new Date(Date.parse('2026-11-01T10:00:00Z') + DIAS_GRACIA * 86_400_000)
  assert.equal(planEfectivo({ plan: 'business', plan_expires_at: '2026-11-01T10:00:00Z' }, new Date(limite.getTime() - 1)), 'business')
  const caducado = estadoPlan({ plan: 'business', plan_expires_at: '2026-11-01T10:00:00Z' }, limite)
  assert.equal(caducado.situacion, 'caducado')
  assert.equal(caducado.efectivo, 'gratis')
  assert.equal(caducado.contratado, 'business')
})

test('diasNaturalesHasta cuenta días naturales en Madrid', () => {
  // 8-nov 23:30 en Madrid (22:30 UTC) frente a una caducidad el 9-nov a las 00:30 de Madrid: mañana
  assert.equal(diasNaturalesHasta(new Date('2026-11-08T23:30:00Z'), new Date('2026-11-08T22:30:00Z')), 1)
  assert.equal(diasNaturalesHasta(new Date('2026-11-08T12:00:00Z'), new Date('2026-11-08T08:00:00Z')), 0)
  assert.equal(diasNaturalesHasta(new Date('2026-11-01T12:00:00Z'), new Date('2026-11-08T08:00:00Z')), -7)
})

test('avisoQueToca: 7 a 2 días, el día antes y el día de la caducidad o la gracia', () => {
  assert.equal(avisoQueToca(null), null)
  assert.equal(avisoQueToca(8), null)
  assert.equal(avisoQueToca(7), 'd7')
  assert.equal(avisoQueToca(2), 'd7')
  assert.equal(avisoQueToca(1), 'd1')
  assert.equal(avisoQueToca(0), 'd0')
  assert.equal(avisoQueToca(-DIAS_GRACIA), 'd0')
  assert.equal(avisoQueToca(-DIAS_GRACIA - 1), null)
})

test('claveAviso identifica tipo y caducidad (fecha de Madrid)', () => {
  assert.equal(claveAviso('d7', new Date('2026-12-08T10:00:00Z')), 'd7@2026-12-08')
  assert.equal(claveAviso('d0', new Date('2026-12-08T23:30:00Z')), 'd0@2026-12-09')
})

test('importes de los planes (IVA incluido) iguales a los publicados', () => {
  assert.deepEqual(IMPORTE_CENTIMOS, { autonomo: 999, creator: 1999, business: 2999 })
})
