// Modelo de factura por cuenta (26-nov-2026): lo guardado se valida antes de llegar al PDF.
import test from 'node:test'
import assert from 'node:assert/strict'
import { etiquetaFormaPago, formatearEuros, normalizarMarca, notasImprimibles } from '../marca-factura.ts'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

test('normalizarMarca: acepta logo PNG/JPEG, colores #rrggbb y pie; descarta lo demás', () => {
  const m = normalizarMarca({ logo: PNG, colorPrincipal: '#787068', colorTitulo: '#b7a17a', colorSuave: '#ebe8e1', pie: '  Mercadonet   Global S.L. · NIF B98407901 ' })
  assert.deepEqual(m, { logo: PNG, colorPrincipal: '#787068', colorTitulo: '#b7a17a', colorSuave: '#ebe8e1', pie: 'Mercadonet Global S.L. · NIF B98407901' })
  assert.deepEqual(normalizarMarca({ logo: 'https://x.es/logo.png', colorPrincipal: 'red', colorTitulo: '#12345', pie: '' }), null)
  assert.deepEqual(normalizarMarca({ logo: 'data:image/svg+xml;base64,PHN2Zz4=', colorSuave: '#f2f7f0' }), { colorSuave: '#f2f7f0' })
  assert.equal(normalizarMarca(null), null)
  assert.equal(normalizarMarca('texto'), null)
  assert.equal(normalizarMarca([1, 2]), null)
  assert.equal(normalizarMarca({ logo: 'data:image/png;base64,' + 'A'.repeat(400_001) }), null)
})

test('etiquetaFormaPago: formas del formulario y del TPV («pasarela:método»)', () => {
  assert.equal(etiquetaFormaPago('transferencia'), 'Transferencia bancaria')
  assert.equal(etiquetaFormaPago('bbva:bizum'), 'Bizum')
  assert.equal(etiquetaFormaPago('bbva:tarjeta'), 'Tarjeta')
  assert.equal(etiquetaFormaPago('stripe'), 'Tarjeta')
  assert.equal(etiquetaFormaPago('desconocida'), null)
  assert.equal(etiquetaFormaPago(''), null)
  assert.equal(etiquetaFormaPago(undefined), null)
})

test('notasImprimibles: quita la marca interna del TPV y deja el resto', () => {
  assert.equal(notasImprimibles('[TPV 123456] Cobrado por BBVA. Precio con el IVA incluido.'), 'Cobrado por BBVA. Precio con el IVA incluido.')
  assert.equal(notasImprimibles('Operación sujeta a IVA.'), 'Operación sujeta a IVA.')
  assert.equal(notasImprimibles('[TPV 1]'), null)
  assert.equal(notasImprimibles(null), null)
})

test('formatearEuros: separador de millares siempre y coma decimal', () => {
  assert.equal(formatearEuros(1290), '1.290,00 €')
  assert.equal(formatearEuros(1066.12), '1.066,12 €')
  assert.equal(formatearEuros(223.88), '223,88 €')
  assert.equal(formatearEuros(24789.54), '24.789,54 €')
  assert.equal(formatearEuros(1234567.891), '1.234.567,89 €')
  assert.equal(formatearEuros(-1500.5), '-1.500,50 €')
  assert.equal(formatearEuros(0), '0,00 €')
})
