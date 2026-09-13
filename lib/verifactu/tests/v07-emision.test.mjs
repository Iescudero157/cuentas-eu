// V07 — Tests unitarios (sin BD) del servicio de emisión: mapeo factura→entrada,
// dry-run de validación y reconstrucción determinista del XML desde el jsonb
// persistido en sif_registros.registro (mismo camino que usará el worker V10).
// La parte transaccional (RPC + PGlite) se cubre en supabase/tests/v07-emision.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'

import { construirRegistroAlta, sistemaInformaticoKuentas, ErrorValidacionRegistro } from '../registro-alta.ts'
import { construirRegistroAnulacion } from '../registro-anulacion.ts'
import { facturaAppARegistroAnulacion } from '../factura-app.ts'
import {
  ErrorEmision,
  filaAFacturaApp,
  prepararEntradaAlta,
  reconstruirRegistroAlta,
  reconstruirRegistroAnulacion,
  validarEmision,
} from '../emision.ts'

const CONFIG = {
  user_id: 'u-1',
  nif_obligado: 'B98407901',
  nombre_razon: 'Empresa Test SL',
  numero_instalacion: 'KU-TEST',
  modalidad: 'verifactu',
  entorno_aeat: 'pruebas',
  activo: true,
}

const SI = sistemaInformaticoKuentas(CONFIG.numero_instalacion)

const FILA_BASE = {
  id: 'inv-1',
  user_id: 'u-1',
  number: 'FACT-2026-006',
  date: '2026-09-13',
  client_name: 'Cliente Ejemplo SL',
  client_nif: '12345678Z',
  items: [{ description: 'Desarrollo web', quantity: 1, unitPrice: 100, total: 100 }],
  subtotal: 100,
  iva: 21,
  iva_rate: 21,
  irpf: 15,
  irpf_rate: 15,
  total: 106,
  verifactu_estado: 'borrador',
  numero_fiscal: null,
  tipo_factura: null,
  rectifica_invoice_id: null,
  tipo_rectificativa: null,
}

test('filaAFacturaApp convierte números y usa el número de serie indicado', () => {
  const f = filaAFacturaApp({ ...FILA_BASE, subtotal: '100.00', iva: '21.00' }, 'F-2026-000001')
  assert.equal(f.invoice_number, 'F-2026-000001')
  assert.equal(f.subtotal, 100)
  assert.equal(f.iva, 21)
})

test('prepararEntradaAlta: F1 con destinatario identificado; IRPF no minora ImporteTotal', () => {
  const entrada = prepararEntradaAlta(FILA_BASE, CONFIG)
  assert.equal(entrada.tipoFactura, 'F1')
  assert.equal(entrada.emisor.nif, 'B98407901')
  assert.equal(entrada.destinatarios?.[0]?.nif, '12345678Z')
  assert.equal(entrada.cuotaTotalDeclarada, 21)
  assert.equal(entrada.importeTotalDeclarado, 121) // 100 + 21, SIN restar IRPF
})

test('prepararEntradaAlta: F2 simplificada sin NIF de cliente', () => {
  const entrada = prepararEntradaAlta({ ...FILA_BASE, client_nif: null }, CONFIG)
  assert.equal(entrada.tipoFactura, 'F2')
  assert.equal(entrada.destinatarios, undefined)
})

test('prepararEntradaAlta: rectificativa R1 por diferencias con factura rectificada', () => {
  const fila = { ...FILA_BASE, rectifica_invoice_id: 'inv-0', tipo_rectificativa: 'I' }
  const rectificada = { numero_fiscal: 'F-2026-000009', date: '2026-08-01', subtotal: 90, iva: 18.9 }
  const entrada = prepararEntradaAlta(fila, CONFIG, {}, rectificada)
  assert.equal(entrada.tipoFactura, 'R1')
  assert.equal(entrada.tipoRectificativa, 'I')
  assert.deepEqual(entrada.facturasRectificadas, [
    { idEmisorFactura: 'B98407901', numSerieFactura: 'F-2026-000009', fechaExpedicion: '2026-08-01' },
  ])
  assert.equal(entrada.importeRectificacion, undefined) // solo en modalidad S
})

test('prepararEntradaAlta: rectificativa S incluye ImporteRectificacion', () => {
  const fila = { ...FILA_BASE, rectifica_invoice_id: 'inv-0', tipo_rectificativa: 'S' }
  const rectificada = { numero_fiscal: 'F-2026-000009', date: '2026-08-01', subtotal: 90, iva: 18.9 }
  const entrada = prepararEntradaAlta(fila, CONFIG, { tipoFactura: 'R4' }, rectificada)
  assert.equal(entrada.tipoFactura, 'R4')
  assert.deepEqual(entrada.importeRectificacion, { baseRectificada: 90, cuotaRectificada: 18.9 })
})

test('prepararEntradaAlta: rectificativa sin factura rectificada emitida lanza ErrorEmision', () => {
  const fila = { ...FILA_BASE, rectifica_invoice_id: 'inv-0' }
  assert.throws(() => prepararEntradaAlta(fila, CONFIG, {}, null), ErrorEmision)
  assert.throws(
    () => prepararEntradaAlta(fila, CONFIG, {}, { numero_fiscal: null, date: '2026-08-01', subtotal: 90, iva: 18.9 }),
    ErrorEmision
  )
})

test('validarEmision: dry-run acepta la factura válida y recalcula totales oficiales', () => {
  const dry = validarEmision(prepararEntradaAlta(FILA_BASE, CONFIG), SI)
  assert.equal(dry.cuotaTotal, '21.00')
  assert.equal(dry.importeTotal, '121.00')
  assert.match(dry.huella, /^[0-9A-F]{64}$/)
})

test('validarEmision: cuota incoherente (fuera de ±10 €) rechazada SIN tocar la BD', () => {
  const fila = { ...FILA_BASE, iva: 40 } // 21 % de 100 = 21; 40 se sale de la tolerancia
  assert.throws(() => validarEmision(prepararEntradaAlta(fila, CONFIG), SI), ErrorValidacionRegistro)
})

test('reconstruirRegistroAlta: round-trip determinista desde el jsonb persistido', () => {
  const entrada = {
    ...prepararEntradaAlta(FILA_BASE, CONFIG),
    numSerieFactura: 'F-2026-000001',
  }
  const encadenamiento = { primerRegistro: true }
  const gen = construirRegistroAlta(entrada, {
    encadenamiento,
    sistemaInformatico: SI,
    fechaGeneracion: new Date('2026-09-13T10:21:33+02:00'),
  })
  // Lo que persiste sif_emitir_factura en sif_registros.registro:
  const persistido = {
    entrada,
    sistemaInformatico: SI,
    encadenamiento,
    fechaHoraHusoGenRegistro: gen.fechaHoraHusoGenRegistro,
    tipoHuella: '01',
    huella: gen.huella,
  }
  const rec = reconstruirRegistroAlta(persistido)
  assert.equal(rec.xml, gen.xml)
  assert.equal(rec.huella, gen.huella)
  assert.equal(rec.fechaHoraHusoGenRegistro, gen.fechaHoraHusoGenRegistro)
})

test('reconstruirRegistroAlta: round-trip con encadenamiento a registro anterior', () => {
  const entrada = {
    ...prepararEntradaAlta(FILA_BASE, CONFIG),
    numSerieFactura: 'F-2026-000002',
  }
  const encadenamiento = {
    registroAnterior: {
      idEmisorFactura: 'B98407901',
      numSerieFactura: 'F-2026-000001',
      fechaExpedicion: '13-09-2026',
      huella: 'A'.repeat(64),
    },
  }
  const gen = construirRegistroAlta(entrada, {
    encadenamiento,
    sistemaInformatico: SI,
    fechaGeneracion: new Date('2026-09-13T11:00:00+02:00'),
  })
  const rec = reconstruirRegistroAlta({
    entrada,
    sistemaInformatico: SI,
    encadenamiento,
    fechaHoraHusoGenRegistro: gen.fechaHoraHusoGenRegistro,
    tipoHuella: '01',
    huella: gen.huella,
  })
  assert.equal(rec.xml, gen.xml)
  assert.equal(rec.huella, gen.huella)
})

test('reconstruirRegistroAnulacion: round-trip determinista', () => {
  const entrada = facturaAppARegistroAnulacion(
    { invoice_number: 'F-2026-000001', date: '2026-09-13' },
    { nif: CONFIG.nif_obligado, nombreRazon: CONFIG.nombre_razon }
  )
  const encadenamiento = {
    registroAnterior: {
      idEmisorFactura: 'B98407901',
      numSerieFactura: 'F-2026-000002',
      fechaExpedicion: '13-09-2026',
      huella: 'B'.repeat(64),
    },
  }
  const gen = construirRegistroAnulacion(entrada, {
    encadenamiento,
    sistemaInformatico: SI,
    fechaGeneracion: new Date('2026-09-13T12:00:00+02:00'),
  })
  const rec = reconstruirRegistroAnulacion({
    entrada,
    sistemaInformatico: SI,
    encadenamiento,
    fechaHoraHusoGenRegistro: gen.fechaHoraHusoGenRegistro,
    tipoHuella: '01',
    huella: gen.huella,
  })
  assert.equal(rec.xml, gen.xml)
  assert.equal(rec.huella, gen.huella)
})
