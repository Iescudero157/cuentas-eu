// Tests: productor del SIF = Milbrotes S.L. (lib/verifactu/productor-sif.ts).
// Mientras PRODUCTOR_SIF.nif esté vacío, ni la emisión de registros reales ni
// el envío REAL a la AEAT pueden ejecutarse (nunca se remite un bloque
// SistemaInformatico con NIF vacío). Ejecutar con: npm test.

import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import {
  PRODUCTOR_SIF,
  ErrorProductorSif,
  exigirProductorSifConfigurado,
  motivoProductorSifNoConfigurado,
  productorSifConfigurado,
} from '../productor-sif.ts'
import { sistemaInformaticoKuentas, sistemaInformaticoParaEmitir } from '../registro-alta.ts'
import { ClienteAeat } from '../aeat-cliente.ts'
import { declaracionResponsableKuentas } from '../declaracion-responsable.ts'
import { PRODUCTOR_PRUEBAS } from './helpers/productor-pruebas.mjs'

test('productor: Milbrotes S.L. con domicilio en Madrid; Mercadonet ya no es productor', () => {
  assert.equal(PRODUCTOR_SIF.nombreRazon, 'Milbrotes S.L.')
  assert.ok(PRODUCTOR_SIF.domicilio.includes('Calle Belalcázar 14, 28006 Madrid'))
  assert.notEqual(PRODUCTOR_SIF.nif, 'B98407901')
  const si = sistemaInformaticoKuentas('KU-x')
  assert.equal(si.nombreRazon, 'Milbrotes S.L.')
  assert.equal(si.nif, PRODUCTOR_SIF.nif)
})

test('productor: vacío o con marcador → no configurado y error claro', () => {
  assert.match(motivoProductorSifNoConfigurado({ ...PRODUCTOR_SIF, nif: '' }), /vacío/)
  assert.match(motivoProductorSifNoConfigurado({ ...PRODUCTOR_SIF, nif: '  ' }), /vacío/)
  assert.match(motivoProductorSifNoConfigurado({ ...PRODUCTOR_SIF, nif: '{{MILBROTES_CIF}}' }), /marcador/)
  assert.match(motivoProductorSifNoConfigurado({ ...PRODUCTOR_SIF, nif: 'B-1234' }), /formato/)
  assert.throws(() => exigirProductorSifConfigurado({ ...PRODUCTOR_SIF, nif: '' }), (e) =>
    e instanceof ErrorProductorSif && /PRODUCTOR_SIF\.nif/.test(e.message) && /No se ha enviado nada/.test(e.message))
  assert.equal(productorSifConfigurado({ ...PRODUCTOR_SIF, ...PRODUCTOR_PRUEBAS }), true)
})

test('productor sin NIF: la emisión real (sistemaInformaticoParaEmitir) aborta', { skip: productorSifConfigurado() }, () => {
  assert.throws(() => sistemaInformaticoParaEmitir('KU-x'), ErrorProductorSif)
})

test('productor sin NIF: el envío REAL a la AEAT aborta antes de tocar la red', { skip: productorSifConfigurado() }, async () => {
  // Transporte por defecto = HTTPS real: la guarda salta antes de abrir conexión.
  const cliente = new ClienteAeat({ entorno: 'pruebas', certificado: { cert: 'x', key: 'y' } })
  await assert.rejects(() => cliente.enviarCuerpoXml('<sf:RegFactuSistemaFacturacion/>'), ErrorProductorSif)
})

test('productor sin NIF: un transporte inyectado (simulador) no se bloquea', async () => {
  let llamado = false
  const cliente = new ClienteAeat({ entorno: 'pruebas', certificado: { cert: 'x', key: 'y' } }, async () => {
    llamado = true
    return { status: 500, cuerpo: 'no-soap' }
  })
  await assert.rejects(() => cliente.enviarCuerpoXml('<x/>'))
  assert.ok(llamado)
})

test('declaración responsable: productor Milbrotes con marcadores mientras falten datos', () => {
  const d = declaracionResponsableKuentas()
  assert.equal(d.productor.razonSocial, 'Milbrotes S.L.')
  if (!productorSifConfigurado()) {
    assert.equal(d.productor.nif, '{{MILBROTES_CIF}}')
    assert.ok(d.pendientes.some((p) => p.includes('PRODUCTOR_SIF')))
  }
  if (!PRODUCTOR_SIF.registroMercantil.trim()) assert.equal(d.productor.registroMercantil, '{{MILBROTES_REGISTRO}}')
})
