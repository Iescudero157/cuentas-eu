// V30 — Fecha de la operación (26-nov-2026): art. 6.1.k RD 1619/2012 y FechaOperacion del registro VERI*FACTU.
// Una factura expedida hoy por una operación de otro día (el alquiler de enero, el cobro del TPV que se factura
// después) lleva las dos fechas; si coinciden, no se informa FechaOperacion.
import test from 'node:test'
import assert from 'node:assert/strict'

import { construirRegistroAlta, sistemaInformaticoKuentas } from '../registro-alta.ts'
import { facturaAppARegistroAlta } from '../factura-app.ts'
import { ErrorEmision, prepararEntradaAlta } from '../emision.ts'
import { validarFechaOperacion } from '../../invoices/numeracion.ts'
import { filaInvoice } from '../../tpv/factura-tpv.ts'
import { PRODUCTOR_PRUEBAS } from './helpers/productor-pruebas.mjs'
import { validarRegistroXsd } from './helpers/xsd-validator.mjs'

const CONFIG = {
  user_id: 'u-1',
  nif_obligado: 'B98407901',
  nombre_razon: 'Empresa Test SL',
  numero_instalacion: 'KU-TEST-1',
  modalidad: 'verifactu',
  entorno_aeat: 'pruebas',
  activo: true,
}
const EMISOR = { nif: CONFIG.nif_obligado, nombreRazon: CONFIG.nombre_razon }
const SI = sistemaInformaticoKuentas(CONFIG.numero_instalacion, PRODUCTOR_PRUEBAS)
const CUANDO = new Date('2026-11-26T10:00:00+01:00')

const FACTURA = {
  invoice_number: 'F-2026-000001',
  date: '2026-11-26',
  client_name: 'Cliente Test SA',
  client_nif: 'A58818501',
  items: [{ description: 'Arrendamiento - Enero 2026', quantity: 1, unitPrice: 1066.12, total: 1066.12 }],
  subtotal: 1066.12,
  iva: 223.88,
  iva_rate: 21,
  irpf: 0,
  irpf_rate: 0,
  total: 1290,
}

function xmlDe(factura) {
  const entrada = facturaAppARegistroAlta(factura, EMISOR)
  return construirRegistroAlta(entrada, {
    encadenamiento: { primerRegistro: true },
    sistemaInformatico: SI,
    fechaGeneracion: CUANDO,
  }).xml
}

test('registro: con fecha de operación distinta lleva FechaOperacion (dd-mm-aaaa) y valida contra el XSD de la AEAT', async () => {
  const xml = xmlDe({ ...FACTURA, fecha_operacion: '2026-01-02' })
  assert.match(xml, /FechaExpedicionFactura>26-11-2026</)
  assert.match(xml, /FechaOperacion>02-01-2026</)
  const r = await validarRegistroXsd(xml)
  assert.ok(r.valida, r.errores.join('\n'))
})

test('registro: sin fecha de operación, o igual a la de expedición, no se informa', async () => {
  assert.doesNotMatch(xmlDe(FACTURA), /FechaOperacion/)
  assert.doesNotMatch(xmlDe({ ...FACTURA, fecha_operacion: '2026-11-26' }), /FechaOperacion/)
})

test('emisión: una fecha de operación posterior a hoy se corta antes de reservar número (la AEAT da 1125)', () => {
  const fila = {
    id: 'i-1', user_id: 'u-1', number: 'PROV-1', date: '2026-11-26', client_name: 'Cliente Test SA',
    client_nif: 'A58818501', items: FACTURA.items, subtotal: 1066.12, iva: 223.88, iva_rate: 21, irpf: 0,
    irpf_rate: 0, total: 1290, verifactu_estado: 'borrador', numero_fiscal: null, tipo_factura: null,
    rectifica_invoice_id: null, tipo_rectificativa: null, operacion_exenta: null, fecha_operacion: '2026-11-27',
  }
  assert.throws(() => prepararEntradaAlta(fila, CONFIG, { hoy: '2026-11-26' }), (e) => e instanceof ErrorEmision && e.codigo === 'fecha_operacion_futura')
  assert.doesNotThrow(() => prepararEntradaAlta({ ...fila, fecha_operacion: '2026-01-02' }, CONFIG, { hoy: '2026-11-26' }))
})

test('validarFechaOperacion: vacía o igual = null; futura o de hace más de 20 años, error', () => {
  const hoy = '2026-11-26'
  assert.deepEqual(validarFechaOperacion('2026-11-26', '', hoy), { ok: true, valor: null })
  assert.deepEqual(validarFechaOperacion('2026-11-26', null, hoy), { ok: true, valor: null })
  assert.deepEqual(validarFechaOperacion('2026-11-26', '2026-11-26', hoy), { ok: true, valor: null })
  assert.deepEqual(validarFechaOperacion('2026-11-26', '2026-01-02', hoy), { ok: true, valor: '2026-01-02' })
  assert.equal(validarFechaOperacion('2026-11-26', '2026-11-27', hoy).ok, false)
  assert.equal(validarFechaOperacion('2026-11-26', '2006-11-25', hoy).ok, false)
  assert.equal(validarFechaOperacion('2026-11-26', '2026-02-30', hoy).ok, false)
  assert.equal(validarFechaOperacion('2026-11-26', 20260102, hoy).ok, false)
})

test('TPV: la factura se expide hoy y un cobro de otro día va como fecha de operación', () => {
  const p = { empresa: 'milbrotes', pedido: '1234', pasarela: 'bbva', fecha: '2026-11-20', importe_cent: 7200, concepto: 'Consultoría' }
  const atrasado = filaInvoice(p, 'u-1', 'simplificada', '2026-11-26')
  assert.equal(atrasado.date, '2026-11-26')
  assert.equal(atrasado.fecha_operacion, '2026-11-20')
  assert.equal(atrasado.payment_date, '2026-11-20')
  const delDia = filaInvoice({ ...p, fecha: '2026-11-26' }, 'u-1', 'simplificada', '2026-11-26')
  assert.equal(delDia.date, '2026-11-26')
  assert.equal('fecha_operacion' in delDia, false)
})
