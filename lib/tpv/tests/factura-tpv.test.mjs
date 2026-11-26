// Pruebas de la lógica pura de la factura automática del TPV central (lib/tpv/factura-tpv.ts), 25-nov-2026.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validarPeticion,
  importesIvaIncluido,
  claseFactura,
  filaInvoice,
  marcaPedido,
  LIMITE_SIMPLIFICADA_CENT,
  NIF_EMPRESA_TPV,
  usuarioFacturador,
} from '../factura-tpv.ts'

const base = {
  empresa: 'milbrotes',
  pedido: '59948988',
  pasarela: 'bbva',
  metodo: 'tarjeta',
  fecha: '2026-11-25',
  importe_cent: 9000,
  concepto: 'Consultoría SEO por horas (1 hora)',
}

test('validarPeticion: acepta un cobro normal y limpia los textos', () => {
  const r = validarPeticion({ ...base, concepto: '  Consultoría   SEO  ', cliente: { email: ' a@b.es ' } })
  assert.equal(r.ok, true)
  assert.equal(r.peticion.concepto, 'Consultoría SEO')
  assert.equal(r.peticion.cliente.email, 'a@b.es')
})

test('validarPeticion: rechaza empresa, pasarela, pedido, fecha, importe y concepto malos', () => {
  for (const malo of [
    { empresa: 'otra' },
    { pasarela: 'paypal' },
    { pedido: '12' },
    { pedido: '1234;DROP' },
    { fecha: '25/11/2026' },
    { importe_cent: 0 },
    { importe_cent: 90.5 },
    { importe_cent: '9000' },
    { concepto: '   ' },
  ]) {
    assert.equal(validarPeticion({ ...base, ...malo }).ok, false, JSON.stringify(malo))
  }
  assert.equal(validarPeticion(null).ok, false)
})

test('importesIvaIncluido: base + cuota = total y la cuota es el 21 % de la base (al céntimo)', () => {
  for (const total of [100, 7200, 9000, 9900, 59290, 40000, 1, 12345]) {
    const { baseCent, cuotaCent } = importesIvaIncluido(total)
    assert.equal(baseCent + cuotaCent, total)
    assert.ok(Math.abs(cuotaCent - baseCent * 0.21) <= 1, `total ${total}: base ${baseCent} cuota ${cuotaCent}`)
  }
  assert.deepEqual(importesIvaIncluido(9000), { baseCent: 7438, cuotaCent: 1562, totalCent: 9000 })
  assert.deepEqual(importesIvaIncluido(7200), { baseCent: 5950, cuotaCent: 1250, totalCent: 7200 })
})

test('claseFactura: completa con nombre y NIF válido; simplificada sin datos hasta 400 €; más sin datos, a mano', () => {
  const ok = validarPeticion
  assert.deepEqual(claseFactura(ok(base).peticion), { clase: 'simplificada' })
  assert.deepEqual(
    claseFactura(ok({ ...base, cliente: { nombre: 'ACME SL', nif: 'B05772710' } }).peticion),
    { clase: 'completa' }
  )
  // NIF no válido: no puede ser completa; hasta 400 € va como simplificada
  assert.deepEqual(claseFactura(ok({ ...base, cliente: { nombre: 'X', nif: '123' } }).peticion), { clase: 'simplificada' })
  assert.deepEqual(claseFactura(ok({ ...base, importe_cent: LIMITE_SIMPLIFICADA_CENT }).peticion), { clase: 'simplificada' })
  assert.deepEqual(
    claseFactura(ok({ ...base, importe_cent: LIMITE_SIMPLIFICADA_CENT + 1 }).peticion),
    { error: 'datos_cliente_necesarios' }
  )
})

test('filaInvoice: borrador cobrado, una línea con la base, IVA 21 %, marca del pedido y sin inventar cliente', () => {
  const p = validarPeticion(base).peticion
  const f = filaInvoice(p, '00000000-0000-0000-0000-000000000001', 'simplificada')
  assert.equal(f.client_name, 'Consumidor final')
  assert.equal(f.client_nif, null)
  assert.equal(f.status, 'cobrada')
  assert.equal(f.total, 90)
  assert.equal(f.subtotal, 74.38)
  assert.equal(f.iva, 15.62)
  assert.equal(f.iva_rate, 21)
  assert.equal(f.irpf, 0)
  assert.deepEqual(f.items, [{ description: p.concepto, quantity: 1, unitPrice: 74.38, total: 74.38 }])
  assert.ok(f.notes.startsWith(marcaPedido('59948988')))
  assert.match(f.notes, /TPV virtual de BBVA/)
  assert.equal(f.payment_method, 'tarjeta')
  const c = filaInvoice(
    validarPeticion({ ...base, cliente: { nombre: 'ACME SL', nif: 'b-05772710', direccion: 'C/ Uno 1' } }).peticion,
    '00000000-0000-0000-0000-000000000001',
    'completa'
  )
  assert.equal(c.client_name, 'ACME SL')
  assert.equal(c.client_nif, 'B05772710')
  assert.equal(c.client_address, 'C/ Uno 1')
})

test('usuarioFacturador: manda el id de Vercel; si no, la única cuenta activa con el NIF; nunca adivina', () => {
  const a = '11111111-2222-4333-8444-555555555555'
  const b = '66666666-7777-4888-9999-000000000000'
  assert.equal(NIF_EMPRESA_TPV.milbrotes, 'B05772710')
  assert.equal(NIF_EMPRESA_TPV.mercadonet, 'B98407901')
  assert.equal(usuarioFacturador(` ${a} `, [{ user_id: b }]), a)
  assert.equal(usuarioFacturador('no-es-un-uuid', [{ user_id: b }]), null)
  assert.equal(usuarioFacturador(undefined, [{ user_id: b }]), b)
  assert.equal(usuarioFacturador('', [{ user_id: b }]), b)
  assert.equal(usuarioFacturador(undefined, []), null)
  assert.equal(usuarioFacturador(undefined, [{ user_id: a }, { user_id: b }]), null)
})

test('transferencia y venta al por menor (26-nov): nota sin «Cobrado por» y simplificada hasta 3.000 € si es minorista', () => {
  const base = { empresa: 'mercadonet', pedido: 'MN2026F205', pasarela: 'transferencia', metodo: 'transferencia', fecha: '2026-09-30', importe_cent: 47798, concepto: 'Ventas de camisetas' }
  const v = validarPeticion({ ...base, minorista: true })
  assert.ok(v.ok)
  assert.equal(v.peticion.minorista, true)
  assert.deepEqual(claseFactura(v.peticion), { clase: 'simplificada' })
  const sinMinorista = validarPeticion(base)
  assert.deepEqual(claseFactura(sinMinorista.peticion), { error: 'datos_cliente_necesarios' })
  assert.deepEqual(claseFactura(validarPeticion({ ...base, minorista: true, importe_cent: 300001 }).peticion), { error: 'datos_cliente_necesarios' })
  const fila = filaInvoice(v.peticion, 'u-1', 'simplificada', '2026-11-26')
  assert.match(fila.notes, /^\[TPV MN2026F205\] Pagada por transferencia bancaria\.$/)
  assert.equal(fila.payment_method, 'transferencia')
  const bizum = filaInvoice({ ...v.peticion, pasarela: 'bbva', metodo: 'bizum' }, 'u-1', 'simplificada', '2026-11-26')
  assert.equal(bizum.payment_method, 'otro')
  assert.match(bizum.notes, /Cobrado por .+ \(bizum\)\. Precio con el IVA incluido\.$/)
  assert.equal(filaInvoice({ ...v.peticion, pasarela: 'stripe', metodo: 'card' }, 'u-1', 'simplificada', '2026-11-26').payment_method, 'tarjeta')
  assert.equal(fila.fecha_operacion, '2026-09-30')
})
