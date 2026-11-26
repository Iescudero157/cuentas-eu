// Importes de la factura (26-nov-2026): al céntimo, y con «precios con IVA incluido» el total es lo escrito.
import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularImportes, redondear } from '../importes.ts'

const L = (quantity, unitPrice, description = 'x') => ({ description, quantity, unitPrice })

test('IVA incluido: el alquiler de 1.290 € sale exacto (base 1.066,12 + IVA 223,88), como la factura original', () => {
  const r = calcularImportes([L(1, 1290, 'Arrendamiento - Diciembre 2026')], 21, 0, true)
  assert.deepEqual([r.subtotal, r.iva, r.irpf, r.total], [1066.12, 223.88, 0, 1290])
  assert.deepEqual(r.lineas, [{ description: 'Arrendamiento - Diciembre 2026', quantity: 1, unitPrice: 1066.12, total: 1066.12 }])
})

test('sin IVA incluido (lo de siempre): base 1.066,12 → IVA 223,89 y total 1.290,01, ya redondeados al céntimo', () => {
  const r = calcularImportes([L(1, 1066.12)], 21, 0)
  assert.deepEqual([r.subtotal, r.iva, r.total], [1066.12, 223.89, 1290.01])
  assert.equal(r.lineas[0].unitPrice, 1066.12)
})

test('IVA incluido con varias líneas: las líneas sin IVA suman exactamente la base', () => {
  const r = calcularImportes([L(3, 10), L(1, 5.5), L(2, 0.99)], 21, 0, true)
  const bruto = 30 + 5.5 + 1.98
  assert.equal(redondear(r.subtotal + r.iva), bruto)
  assert.equal(r.total, bruto)
  assert.equal(redondear(r.lineas.reduce((s, l) => s + l.total, 0)), r.subtotal)
  for (const l of r.lineas) assert.ok(Math.abs(l.quantity * l.unitPrice - l.total) < 0.005, JSON.stringify(l))
})

test('IVA incluido con retención: la retención va sobre la base y el total es lo escrito menos la retención', () => {
  const r = calcularImportes([L(1, 121)], 21, 15, true)
  assert.deepEqual([r.subtotal, r.iva, r.irpf, r.total], [100, 21, 15, 106])
})

test('exenta (0 %) o sin IVA incluido: la casilla no cambia nada', () => {
  assert.deepEqual(calcularImportes([L(2, 50)], 0, 0, true), calcularImportes([L(2, 50)], 0, 0, false))
  const r = calcularImportes([L(1, 100.05)], 21, 15)
  assert.deepEqual([r.subtotal, r.iva, r.irpf, r.total], [100.05, 21.01, 15.01, 106.05])
})

test('líneas vacías o con cantidad 0 no rompen nada', () => {
  const r = calcularImportes([L(0, 50), L(1, 0)], 21, 0, true)
  assert.deepEqual([r.subtotal, r.iva, r.total], [0, 0, 0])
  assert.equal(r.lineas[0].unitPrice, 0)
  assert.deepEqual(calcularImportes([], 21, 15, true), { lineas: [], subtotal: 0, iva: 0, irpf: 0, total: 0 })
})
