// R1 (26-nov-2026): numeración FACT-<año> correlativa por usuario y fecha de expedición en hora de España.
import test from 'node:test'
import assert from 'node:assert/strict'
import { anioDeFecha, fechaHoyEspana, siguienteNumeroFactura } from '../numeracion.ts'

test('siguienteNumeroFactura: el mayor del año + 1, sin mirar otros años ni números ajenos a la serie', () => {
  assert.equal(siguienteNumeroFactura(2026, []), 'FACT-2026-001')
  assert.equal(siguienteNumeroFactura(2026, ['FACT-2026-006', 'FACT-2026-006', 'FACT-2026-002']), 'FACT-2026-007')
  assert.equal(siguienteNumeroFactura(2027, ['FACT-2026-040', 'FACT-2026-041']), 'FACT-2027-001')
  assert.equal(siguienteNumeroFactura(2027, ['FACT-2027-009', ' FACT-2027-010 ', 'F-2027-000099', 'S-2027-5', null, undefined, '']), 'FACT-2027-011')
  assert.equal(siguienteNumeroFactura(2026, ['FACT-2026-999']), 'FACT-2026-1000')
})

test('anioDeFecha: solo fechas aaaa-mm-dd que existen', () => {
  assert.equal(anioDeFecha('2027-01-01'), 2027)
  assert.equal(anioDeFecha(' 2026-12-31 '), 2026)
  assert.equal(anioDeFecha('2026-11-26T10:00:00Z'), 2026)
  assert.equal(anioDeFecha('2026-11-26x'), null)
  assert.equal(anioDeFecha('2026-02-30'), null)
  assert.equal(anioDeFecha('2026-13-01'), null)
  assert.equal(anioDeFecha('26-11-2026'), null)
  assert.equal(anioDeFecha('1999-12-31'), null)
  assert.equal(anioDeFecha(20261126), null)
  assert.equal(anioDeFecha(undefined), null)
})

test('fechaHoyEspana: la fecha de Madrid, no la UTC (Nochevieja y cambio de hora)', () => {
  // 31-dic-2026 23:30 UTC = 1-ene-2027 00:30 en Madrid (invierno, UTC+1)
  assert.equal(fechaHoyEspana(new Date('2026-12-31T23:30:00Z')), '2027-01-01')
  // 30-jun-2027 22:30 UTC = 1-jul-2027 00:30 en Madrid (verano, UTC+2)
  assert.equal(fechaHoyEspana(new Date('2027-06-30T22:30:00Z')), '2027-07-01')
  assert.equal(fechaHoyEspana(new Date('2026-11-26T10:00:00Z')), '2026-11-26')
})
