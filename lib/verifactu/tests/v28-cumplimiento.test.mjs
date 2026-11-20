// V28 — Cumplimiento 20-nov-2026: los tres huecos hallados al contrastar la
// web con la app (main 71ab027).
//   1. Operaciones exentas: causa de exención (lista L10) guardada con la
//      factura, registro como OperacionExenta y mención en el PDF.
//   2. Rectificativas (R1-R5, por diferencias) y anulación.
//   3. Facturas simplificadas: serie propia y título propio.
// Los XML se validan contra los XSD OFICIALES de la AEAT (docs/verifactu/xsd/).
// La parte transaccional (series en base de datos) está en
// supabase/tests/v28-cumplimiento.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  CAUSAS_EXENCION_IVA,
  TIPOS_RECTIFICATIVA,
  claseSerie,
  claveRegimenParaExenta,
  esCausaExencionIva,
  mencionExencion,
  normalizarNif,
  serieParaTipoFactura,
  situacionNifCliente,
  tipoFacturaDeDocumento,
  tipoRectificativaPara,
  tituloDocumento,
  validarExencion,
} from '../factura-fiscal.ts'
import { construirRegistroAlta, sistemaInformaticoKuentas, ErrorValidacionRegistro } from '../registro-alta.ts'
import { construirRegistroAnulacion } from '../registro-anulacion.ts'
import { facturaAppARegistroAlta, facturaAppARegistroAnulacion } from '../factura-app.ts'
import { ErrorEmision, prepararEntradaAlta, validarEmision } from '../emision.ts'
import { construirBorradorRectificativa } from '../rectificacion.ts'
import { invoicePDFDataFromRow } from '../../pdf/invoice-pdf-data.ts'
import { PRODUCTOR_PRUEBAS } from './helpers/productor-pruebas.mjs'
import { validarRegistroXsd } from './helpers/xsd-validator.mjs'

const CONFIG = {
  user_id: 'u-1',
  nif_obligado: 'B98407901',
  nombre_razon: 'Empresa Test SL',
  numero_instalacion: 'KU-TEST',
  modalidad: 'verifactu',
  entorno_aeat: 'pruebas',
  activo: true,
}
const EMISOR = { nif: CONFIG.nif_obligado, nombreRazon: CONFIG.nombre_razon }
const SI = sistemaInformaticoKuentas(CONFIG.numero_instalacion, PRODUCTOR_PRUEBAS)
const CUANDO = new Date('2026-11-20T10:00:00+01:00')
const HOY = '2026-11-20'

/** Borrador de la app: factura completa al 21 %. */
const FILA = {
  id: 'inv-1',
  user_id: 'u-1',
  number: 'FACT-2026-006',
  date: '2026-11-20',
  client_name: 'Cliente Ejemplo SL',
  client_nif: 'A58818501',
  items: [{ description: 'Servicio de prueba', quantity: 1, unitPrice: 100, total: 100 }],
  subtotal: 100,
  iva: 21,
  iva_rate: 21,
  irpf: 0,
  irpf_rate: 0,
  total: 121,
  verifactu_estado: 'borrador',
  numero_fiscal: null,
  tipo_factura: null,
  rectifica_invoice_id: null,
  tipo_rectificativa: null,
  operacion_exenta: null,
}

/** La misma operación, exenta por el art. 20 LIVA (IVA 0 %, causa E1). */
const FILA_EXENTA = { ...FILA, iva: 0, iva_rate: 0, total: 100, operacion_exenta: 'E1' }

function generar(entrada, numSerie) {
  return construirRegistroAlta(
    { ...entrada, numSerieFactura: numSerie },
    { encadenamiento: { primerRegistro: true }, sistemaInformatico: SI, fechaGeneracion: CUANDO }
  )
}

async function assertXsd(xml) {
  const r = await validarRegistroXsd(xml)
  assert.ok(r.valida, `XML no válido contra el XSD oficial:\n${r.errores.join('\n')}\n---\n${xml}`)
}

function erroresDe(fn) {
  try {
    fn()
  } catch (e) {
    assert.ok(e instanceof ErrorValidacionRegistro, `esperaba ErrorValidacionRegistro y llegó ${e?.name}: ${e?.message}`)
    return e.errores.join('\n')
  }
  assert.fail('no lanzó error y debía')
}

// ---------------------------------------------------------------------------
// 1. Operaciones exentas
// ---------------------------------------------------------------------------

test('lista L10: seis causas con su artículo; E5 no disponible todavía', () => {
  assert.deepEqual(CAUSAS_EXENCION_IVA.map((c) => c.clave), ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'])
  assert.deepEqual(
    CAUSAS_EXENCION_IVA.map((c) => c.descripcionOficial),
    [
      'Exenta por el artículo 20',
      'Exenta por el artículo 21',
      'Exenta por el artículo 22',
      'Exenta por los artículos 23 y 24',
      'Exenta por el artículo 25',
      'Exenta por otros',
    ]
  )
  assert.deepEqual(CAUSAS_EXENCION_IVA.filter((c) => !c.disponible).map((c) => c.clave), ['E5'])
  assert.ok(esCausaExencionIva('E1'))
  assert.ok(!esCausaExencionIva('E7')) // E7 y E8 solo existen para IGIC
  assert.ok(!esCausaExencionIva(''))
  assert.ok(!esCausaExencionIva(null))
})

test('mención de exención: cita el artículo de la Ley 37/1992 (art. 6.1.j RD 1619/2012)', () => {
  assert.equal(
    mencionExencion('E1'),
    'Operación exenta de IVA (artículo 20 de la Ley 37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido).'
  )
  assert.match(mencionExencion('E4'), /artículos 23 y 24 de la Ley 37\/1992/)
  assert.match(mencionExencion('E1', ' Art. 20.Uno.23.º '), /Añadido\)\. Art\. 20\.Uno\.23\.º$/)
  // E6 «otros» no tiene artículo propio: la mención remite a la Ley y al precepto escrito
  assert.equal(
    mencionExencion('E6', 'Precepto de ejemplo'),
    'Operación exenta de IVA conforme a la Ley 37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido. Precepto de ejemplo'
  )
})

test('validarExencion: con IVA 0 % la causa es obligatoria; con IVA > 0 no cabe', () => {
  assert.deepEqual(validarExencion(21, undefined, undefined), { ok: true, operacion_exenta: null, exencion_detalle: null })
  assert.equal(validarExencion(21, 'E1', '').ok, false)
  assert.equal(validarExencion(0, undefined, undefined).ok, false)
  assert.equal(validarExencion(0, '', '').ok, false)
  assert.equal(validarExencion(0, 'E7', '').ok, false) // fuera de L10 para IVA
  assert.deepEqual(validarExencion(0, 'E1', ''), { ok: true, operacion_exenta: 'E1', exencion_detalle: null })
  assert.deepEqual(validarExencion(0, 'E1', '  Art. 20.Uno.23.º  '), {
    ok: true,
    operacion_exenta: 'E1',
    exencion_detalle: 'Art. 20.Uno.23.º',
  })
  // E5 (entregas a otro Estado miembro) no se puede emitir bien todavía
  const e5 = validarExencion(0, 'E5', '')
  assert.equal(e5.ok, false)
  assert.match(e5.error, /art\. 25/)
  // E6 exige escribir el precepto
  assert.equal(validarExencion(0, 'E6', '').ok, false)
  assert.equal(validarExencion(0, 'E6', 'Precepto de ejemplo').ok, true)
  assert.equal(validarExencion(0, 'E1', 'x'.repeat(201)).ok, false)
})

test('factura exenta: el registro es OperacionExenta con su causa, no S1 al 0 %', async () => {
  const entrada = prepararEntradaAlta(FILA_EXENTA, CONFIG, { hoy: HOY })
  assert.equal(entrada.tipoFactura, 'F1')
  assert.deepEqual(entrada.desglose, [
    { impuesto: '01', claveRegimen: '01', operacionExenta: 'E1', baseImponible: 100 },
  ])
  const r = generar(entrada, 'F-2026-000001')
  assert.equal(r.cuotaTotal, '0.00')
  assert.equal(r.importeTotal, '100.00')
  assert.ok(r.xml.includes('<sf:OperacionExenta>E1</sf:OperacionExenta>'))
  assert.ok(!r.xml.includes('CalificacionOperacion'))
  assert.ok(!r.xml.includes('TipoImpositivo'))
  assert.ok(!r.xml.includes('CuotaRepercutida'))
  await assertXsd(r.xml)
})

test('IVA al 0 % sin causa de exención: no se emite (antes salía como S1 al 0 %)', () => {
  const sinCausa = { ...FILA_EXENTA, operacion_exenta: null }
  assert.match(erroresDe(() => prepararEntradaAlta(sinCausa, CONFIG, { hoy: HOY })), /sin causa de exención/)
  assert.match(
    erroresDe(() => facturaAppARegistroAlta({ ...sinCausa, invoice_number: 'X-1' }, EMISOR)),
    /sin causa de exención/
  )
  // Y una causa con IVA repercutido tampoco
  assert.match(
    erroresDe(() => prepararEntradaAlta({ ...FILA, operacion_exenta: 'E1' }, CONFIG, { hoy: HOY })),
    /no puede repercutir IVA/
  )
})

test('E2 (art. 21) y E3 (art. 22) van con clave de régimen 02; el resto con 01', async () => {
  assert.equal(claveRegimenParaExenta('E1'), '01')
  assert.equal(claveRegimenParaExenta('E2'), '02')
  assert.equal(claveRegimenParaExenta('E3'), '02')
  assert.equal(claveRegimenParaExenta('E4'), '01')
  assert.equal(claveRegimenParaExenta('E6'), '01')
  for (const causa of ['E2', 'E3', 'E4', 'E6']) {
    const entrada = prepararEntradaAlta({ ...FILA_EXENTA, operacion_exenta: causa }, CONFIG, { hoy: HOY })
    const r = generar(entrada, 'F-2026-000002')
    assert.ok(r.xml.includes(`<sf:OperacionExenta>${causa}</sf:OperacionExenta>`))
    assert.ok(r.xml.includes(`<sf:ClaveRegimen>${claveRegimenParaExenta(causa)}</sf:ClaveRegimen>`))
    await assertXsd(r.xml)
  }
})

test('motor: reglas de la AEAT sobre exentas (doc. «Validaciones» §15.5, §15.5.1 y §15.6.1)', async () => {
  const base = prepararEntradaAlta(FILA_EXENTA, CONFIG, { hoy: HOY })
  const con = (linea, extra = {}) => ({ ...base, ...extra, desglose: [{ impuesto: '01', baseImponible: 100, ...linea }] })

  // E2/E3 no admisibles con clave 01
  assert.match(erroresDe(() => generar(con({ claveRegimen: '01', operacionExenta: 'E2' }), 'F-1')), /claveRegimen=01/)
  assert.match(erroresDe(() => generar(con({ claveRegimen: '01', operacionExenta: 'E3' }), 'F-1')), /claveRegimen=01/)
  // La clave 02 solo admite operaciones exentas
  assert.match(
    erroresDe(() =>
      generar(
        { ...FILA_ENTRADA_S1(), desglose: [{ claveRegimen: '02', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 100, cuotaRepercutida: 21 }] },
        'F-1'
      )
    ),
    /clave 02 \(exportación\) solo admite operaciones exentas/
  )
  // E5: destinatario con NIF español → rechazado; con NIF-IVA (IDOtro) → válido
  assert.match(erroresDe(() => generar(con({ claveRegimen: '01', operacionExenta: 'E5' }), 'F-1')), /IDOtro/)
  const e5 = generar(
    con(
      { claveRegimen: '01', operacionExenta: 'E5' },
      { destinatarios: [{ nombreRazon: 'GmbH Beispiel', idType: '02', id: 'DE811128135' }] }
    ),
    'F-2026-000003'
  )
  await assertXsd(e5.xml)
  // E5 nunca en factura simplificada (art. 4.4.a RD 1619/2012)
  assert.match(
    erroresDe(() =>
      generar(con({ claveRegimen: '01', operacionExenta: 'E5' }, { tipoFactura: 'F2', destinatarios: undefined }), 'S-1')
    ),
    /no puede documentarse en factura simplificada/
  )
})

function FILA_ENTRADA_S1() {
  return prepararEntradaAlta(FILA, CONFIG, { hoy: HOY })
}

// ---------------------------------------------------------------------------
// 3. Simplificadas: clase, serie y título (art. 7.1.a RD 1619/2012)
// ---------------------------------------------------------------------------

test('una serie por clase de factura: F completas · S simplificadas · R y RS rectificativas', () => {
  assert.equal(serieParaTipoFactura('F1'), 'F')
  assert.equal(serieParaTipoFactura('F3'), 'F')
  assert.equal(serieParaTipoFactura('F2'), 'S')
  for (const r of ['R1', 'R2', 'R3', 'R4']) assert.equal(serieParaTipoFactura(r), 'R')
  assert.equal(serieParaTipoFactura('R5'), 'RS')
  assert.equal(claseSerie('F2'), 'simplificada')
  assert.equal(claseSerie('R5'), 'rectificativa_simplificada')
  // Ninguna serie por defecto se repite entre clases
  const series = ['F1', 'F2', 'R1', 'R5'].map(serieParaTipoFactura)
  assert.equal(new Set(series).size, 4)
})

test('título del documento según el tipo de factura', () => {
  assert.equal(tituloDocumento('F1'), 'FACTURA')
  assert.equal(tituloDocumento('F2'), 'FACTURA SIMPLIFICADA')
  assert.equal(tituloDocumento('R1'), 'FACTURA RECTIFICATIVA')
  assert.equal(tituloDocumento('R4'), 'FACTURA RECTIFICATIVA')
  assert.equal(tituloDocumento('R5'), 'FACTURA SIMPLIFICADA RECTIFICATIVA')
})

test('NIF del cliente: vacío → simplificada; español válido → completa; otro texto → no se emite', () => {
  assert.equal(situacionNifCliente(null), 'vacio')
  assert.equal(situacionNifCliente('   '), 'vacio')
  assert.equal(situacionNifCliente('a-58818501'), 'valido')
  assert.equal(normalizarNif(' a-588.185 01 '), 'A58818501')
  assert.equal(situacionNifCliente('B1234567'), 'invalido')
  assert.equal(situacionNifCliente('FR12345678901'), 'invalido')

  // Sin NIF: F2, sin destinatarios
  const f2 = prepararEntradaAlta({ ...FILA, client_nif: null }, CONFIG, { hoy: HOY })
  assert.equal(f2.tipoFactura, 'F2')
  assert.equal(f2.destinatarios, undefined)
  // NIF escrito con guion: se normaliza y la factura es completa
  const f1 = prepararEntradaAlta({ ...FILA, client_nif: 'a-58818501' }, CONFIG, { hoy: HOY })
  assert.equal(f1.tipoFactura, 'F1')
  assert.equal(f1.destinatarios[0].nif, 'A58818501')
  // NIF que no es español válido: antes se convertía en simplificada en silencio
  assert.throws(
    () => prepararEntradaAlta({ ...FILA, client_nif: 'B1234567' }, CONFIG, { hoy: HOY }),
    (e) => e instanceof ErrorEmision && e.codigo === 'nif_cliente_invalido'
  )
})

test('tipoFacturaDeDocumento: manda el tipo registrado; si no, sin NIF es simplificada', () => {
  assert.equal(tipoFacturaDeDocumento({ tipo_factura: 'R5', client_nif: 'A58818501' }), 'R5')
  assert.equal(tipoFacturaDeDocumento({ tipo_factura: null, client_nif: 'A58818501' }), 'F1')
  assert.equal(tipoFacturaDeDocumento({ tipo_factura: null, client_nif: '' }), 'F2')
  // Sin VERI*FACTU, un documento extranjero escrito no la convierte en simplificada
  assert.equal(tipoFacturaDeDocumento({ tipo_factura: null, client_nif: 'FR12345678901' }), 'F1')
})

test('simplificada: registro F2 sin Destinatarios, válido contra el XSD', async () => {
  const entrada = prepararEntradaAlta({ ...FILA, client_nif: null, client_name: 'Cliente de mostrador' }, CONFIG, { hoy: HOY })
  const r = generar(entrada, 'S-2026-000001')
  assert.equal(r.tipoFactura, 'F2')
  assert.ok(r.xml.includes('<sf:NumSerieFactura>S-2026-000001</sf:NumSerieFactura>'))
  assert.ok(r.xml.includes('<sf:TipoFactura>F2</sf:TipoFactura>'))
  assert.ok(!r.xml.includes('Destinatarios'))
  await assertXsd(r.xml)
})

test('simplificada: máximo 3.000 € IVA incluido (art. 4.2 RD 1619/2012; AEAT §15.8)', () => {
  const de = (subtotal) => ({ ...FILA, client_nif: null, subtotal, iva: +(subtotal * 0.21).toFixed(2), total: +(subtotal * 1.21).toFixed(2) })
  // 2.479,33 + 520,66 = 2.999,99 → se admite
  assert.equal(validarEmision(prepararEntradaAlta(de(2479.33), CONFIG, { hoy: HOY }), SI).importeTotal, '2999.99')
  // 2.500 + 525 = 3.025 → rechazada antes de reservar número
  assert.match(
    erroresDe(() => validarEmision(prepararEntradaAlta(de(2500), CONFIG, { hoy: HOY }), SI)),
    /no puede superar los 3000 € IVA incluido/
  )
  // La misma factura con NIF del cliente es completa y no tiene ese límite
  const completa = { ...de(2500), client_nif: 'A58818501' }
  assert.equal(validarEmision(prepararEntradaAlta(completa, CONFIG, { hoy: HOY }), SI).importeTotal, '3025.00')
})

test('motor: F2 y R5 no admiten destinatarios (AEAT §13)', () => {
  const entrada = prepararEntradaAlta(FILA, CONFIG, { hoy: HOY })
  assert.match(erroresDe(() => generar({ ...entrada, tipoFactura: 'F2' }, 'S-1')), /no admisibles en facturas F2/)
  // El adaptador los retira aunque el cliente tenga NIF válido
  const f2 = facturaAppARegistroAlta({ ...FILA, invoice_number: 'S-1' }, EMISOR, { tipoFactura: 'F2' })
  assert.equal(f2.destinatarios, undefined)
})

// ---------------------------------------------------------------------------
// 2. Rectificativas (art. 15 RD 1619/2012) y anulación (art. 11 RD 1007/2023)
// ---------------------------------------------------------------------------

/** Factura completa ya emitida (la que se rectifica). */
const EMITIDA = {
  ...FILA,
  id: 'inv-emitida',
  number: 'F-2026-000007',
  numero_fiscal: 'F-2026-000007',
  date: '2026-11-03',
  verifactu_estado: 'emitida',
  tipo_factura: 'F1',
  client_id: null,
  client_address: 'Calle de Ejemplo 1',
  client_email: null,
  exencion_detalle: null,
}

test('tipos de rectificativa: lista L2 oficial; R5 si se rectifica una simplificada', () => {
  assert.deepEqual(TIPOS_RECTIFICATIVA.map((t) => t.clave), ['R1', 'R2', 'R3', 'R4'])
  assert.equal(tipoRectificativaPara('F1', 'R4'), 'R4')
  assert.equal(tipoRectificativaPara('F1', undefined), 'R1')
  assert.equal(tipoRectificativaPara('F2', 'R1'), 'R5')
  assert.equal(tipoRectificativaPara('R5', undefined), 'R5')
  assert.equal(tipoRectificativaPara('F1', 'R5'), 'R1') // R5 no rectifica completas
})

test('rectificativa por el importe íntegro: diferencias en negativo y referencia a la original', () => {
  const b = construirBorradorRectificativa(EMITIDA, { modo: 'total', motivo: 'Operación sin efecto', tipo: 'R1', hoy: HOY })
  assert.equal(b.subtotal, -100)
  assert.equal(b.iva, -21)
  assert.equal(b.total, -121)
  assert.equal(b.iva_rate, 21)
  assert.equal(b.date, HOY)
  assert.equal(b.rectifica_invoice_id, 'inv-emitida')
  assert.equal(b.tipo_rectificativa, 'I')
  assert.equal(b.tipo_factura, 'R1')
  assert.equal(b.client_nif, 'A58818501')
  assert.equal(
    b.items[0].description,
    'Rectificación de la factura F-2026-000007 de 03/11/2026: Operación sin efecto'
  )
  assert.deepEqual(b.items[0], { description: b.items[0].description, quantity: 1, unitPrice: -100, total: -100 })
})

test('rectificativa que corrige la base: solo la diferencia, con IRPF y rectificativas previas', () => {
  const conIrpf = { ...EMITIDA, irpf: 15, irpf_rate: 15, total: 106 }
  // La base correcta era 80: diferencia −20, IVA −4,20, IRPF −3
  const b = construirBorradorRectificativa(conIrpf, { modo: 'importe', baseCorrecta: 80, motivo: 'Descuento posterior', tipo: 'R1', hoy: HOY })
  assert.equal(b.subtotal, -20)
  assert.equal(b.iva, -4.2)
  assert.equal(b.irpf, -3)
  assert.equal(b.total, -21.2) // −20 − 4,20 + 3
  // Con una rectificativa previa de −20 ya emitida, dejar la base en 60 es otra de −20
  const previa = { subtotal: -20, iva: -4.2, irpf: -3 }
  const b2 = construirBorradorRectificativa(conIrpf, { modo: 'importe', baseCorrecta: 60, motivo: 'Segundo descuento', tipo: 'R1', hoy: HOY }, previa)
  assert.equal(b2.subtotal, -20)
  assert.equal(b2.iva, -4.2)
  // «Todo el importe» tras esa previa deja sin efecto solo lo que sigue vigente
  const b3 = construirBorradorRectificativa(conIrpf, { modo: 'total', motivo: 'Operación sin efecto', tipo: 'R1', hoy: HOY }, previa)
  assert.equal(b3.subtotal, -80)
  assert.equal(b3.iva, -16.8)
  assert.equal(b3.irpf, -12)
  // Una base mayor que la facturada es una rectificativa en positivo
  const b4 = construirBorradorRectificativa(EMITIDA, { modo: 'importe', baseCorrecta: 150, motivo: 'Faltaba un concepto', tipo: 'R4', hoy: HOY })
  assert.equal(b4.subtotal, 50)
  assert.equal(b4.iva, 10.5)
  assert.equal(b4.tipo_factura, 'R4')
})

test('rectificativa: validaciones (estado, motivo, tipo, sin diferencias)', () => {
  const p = { modo: 'total', motivo: 'Operación sin efecto', tipo: 'R1', hoy: HOY }
  const codigo = (fn) => {
    try { fn() } catch (e) { assert.ok(e instanceof ErrorEmision, e?.message); return e.codigo }
    assert.fail('no lanzó error y debía')
  }
  assert.equal(codigo(() => construirBorradorRectificativa({ ...EMITIDA, verifactu_estado: 'borrador' }, p)), 'no_rectificable')
  assert.equal(codigo(() => construirBorradorRectificativa({ ...EMITIDA, verifactu_estado: 'anulada' }, p)), 'no_rectificable')
  assert.equal(codigo(() => construirBorradorRectificativa({ ...EMITIDA, numero_fiscal: null }, p)), 'no_rectificable')
  assert.equal(codigo(() => construirBorradorRectificativa(EMITIDA, { ...p, motivo: ' ab ' })), 'motivo_requerido')
  assert.equal(codigo(() => construirBorradorRectificativa(EMITIDA, { ...p, motivo: 'x'.repeat(301) })), 'motivo_largo')
  assert.equal(codigo(() => construirBorradorRectificativa(EMITIDA, { ...p, tipo: undefined })), 'tipo_requerido')
  assert.equal(codigo(() => construirBorradorRectificativa(EMITIDA, { ...p, tipo: 'R5' })), 'tipo_requerido')
  assert.equal(codigo(() => construirBorradorRectificativa(EMITIDA, { ...p, modo: 'importe', baseCorrecta: -1 })), 'base_invalida')
  assert.equal(codigo(() => construirBorradorRectificativa(EMITIDA, { ...p, modo: 'importe', baseCorrecta: 100 })), 'sin_diferencias')
  assert.equal(
    codigo(() => construirBorradorRectificativa(EMITIDA, p, { subtotal: -100, iva: -21, irpf: 0 })),
    'sin_diferencias'
  )
  // Una factura ya rectificada admite otra rectificativa
  assert.equal(construirBorradorRectificativa({ ...EMITIDA, verifactu_estado: 'rectificada' }, p).subtotal, -100)
})

test('rectificativa R1: registro con TipoRectificativa I y FacturasRectificadas, válido contra el XSD', async () => {
  const b = construirBorradorRectificativa(EMITIDA, { modo: 'importe', baseCorrecta: 80, motivo: 'Descuento posterior', tipo: 'R1', hoy: HOY })
  const filaRect = {
    ...FILA, ...b, id: 'inv-rect', user_id: 'u-1', verifactu_estado: 'borrador', numero_fiscal: null,
  }
  const entrada = prepararEntradaAlta(filaRect, CONFIG, { hoy: HOY }, EMITIDA)
  assert.equal(entrada.tipoFactura, 'R1')
  assert.equal(entrada.tipoRectificativa, 'I')
  assert.deepEqual(entrada.facturasRectificadas, [
    { idEmisorFactura: 'B98407901', numSerieFactura: 'F-2026-000007', fechaExpedicion: '2026-11-03' },
  ])
  assert.equal(entrada.importeRectificacion, undefined) // solo en la modalidad S
  const r = generar(entrada, 'R-2026-000001')
  assert.equal(r.cuotaTotal, '-4.20')
  assert.equal(r.importeTotal, '-24.20')
  assert.ok(r.xml.includes('<sf:TipoFactura>R1</sf:TipoFactura>'))
  assert.ok(r.xml.includes('<sf:TipoRectificativa>I</sf:TipoRectificativa>'))
  assert.ok(r.xml.includes('<sf:NumSerieFactura>F-2026-000007</sf:NumSerieFactura>'))
  assert.ok(r.xml.includes('<sf:FechaExpedicionFactura>03-11-2026</sf:FechaExpedicionFactura>'))
  assert.ok(r.xml.includes('<sf:BaseImponibleOimporteNoSujeto>-20.00</sf:BaseImponibleOimporteNoSujeto>'))
  assert.ok(r.xml.includes('Rectificación de la factura F-2026-000007 de 03/11/2026: Descuento posterior'))
  await assertXsd(r.xml)
})

test('rectificativa de una simplificada: R5, sin destinatarios, aunque se pida R1', async () => {
  const simplificada = { ...EMITIDA, number: 'S-2026-000004', numero_fiscal: 'S-2026-000004', tipo_factura: 'F2', client_nif: null }
  const b = construirBorradorRectificativa(simplificada, { modo: 'total', motivo: 'Devolución completa', tipo: 'R1', hoy: HOY })
  assert.equal(b.tipo_factura, 'R5')
  assert.equal(b.client_nif, null)
  const filaRect = { ...FILA, ...b, id: 'inv-rect5', user_id: 'u-1', verifactu_estado: 'borrador', numero_fiscal: null }
  const entrada = prepararEntradaAlta(filaRect, CONFIG, { hoy: HOY }, simplificada)
  assert.equal(entrada.tipoFactura, 'R5')
  assert.equal(entrada.destinatarios, undefined)
  const r = generar(entrada, 'RS-2026-000001')
  assert.ok(r.xml.includes('<sf:TipoFactura>R5</sf:TipoFactura>'))
  assert.ok(!r.xml.includes('Destinatarios'))
  await assertXsd(r.xml)
})

test('rectificativa de una factura exenta: hereda la causa y no lleva cuota', async () => {
  const exentaEmitida = { ...EMITIDA, iva: 0, iva_rate: 0, total: 100, operacion_exenta: 'E1', exencion_detalle: 'Art. 20.Uno.23.º' }
  const b = construirBorradorRectificativa(exentaEmitida, { modo: 'total', motivo: 'Operación sin efecto', tipo: 'R4', hoy: HOY })
  assert.equal(b.operacion_exenta, 'E1')
  assert.equal(b.exencion_detalle, 'Art. 20.Uno.23.º')
  assert.equal(b.iva, 0)
  assert.equal(b.total, -100)
  const filaRect = { ...FILA, ...b, id: 'inv-rect-ex', user_id: 'u-1', verifactu_estado: 'borrador', numero_fiscal: null }
  const r = generar(prepararEntradaAlta(filaRect, CONFIG, { hoy: HOY }, exentaEmitida), 'R-2026-000002')
  assert.ok(r.xml.includes('<sf:OperacionExenta>E1</sf:OperacionExenta>'))
  assert.equal(r.cuotaTotal, '0.00')
  assert.equal(r.importeTotal, '-100.00')
  await assertXsd(r.xml)
})

test('anulación: registro de anulación de la factura emitida, válido contra el XSD', async () => {
  const entrada = facturaAppARegistroAnulacion({ invoice_number: 'F-2026-000007', date: '2026-11-03' }, EMISOR)
  const r = construirRegistroAnulacion(entrada, {
    encadenamiento: {
      registroAnterior: {
        idEmisorFactura: 'B98407901',
        numSerieFactura: 'R-2026-000001',
        fechaExpedicion: '20-11-2026',
        huella: 'A'.repeat(64),
      },
    },
    sistemaInformatico: SI,
    fechaGeneracion: CUANDO,
  })
  assert.ok(r.xml.startsWith('<sf:RegistroAnulacion'))
  assert.ok(r.xml.includes('<sf:NumSerieFacturaAnulada>F-2026-000007</sf:NumSerieFacturaAnulada>'))
  assert.ok(r.xml.includes('<sf:FechaExpedicionFacturaAnulada>03-11-2026</sf:FechaExpedicionFacturaAnulada>'))
  assert.match(r.huella, /^[0-9A-F]{64}$/)
  await assertXsd(r.xml)
})

// ---------------------------------------------------------------------------
// PDF: título, mención de exención, factura rectificada y anulada
// ---------------------------------------------------------------------------

const FILA_PDF = {
  number: 'F-2026-000007',
  client_name: 'Cliente Ejemplo SL',
  client_nif: 'A58818501',
  client_address: 'Calle de Ejemplo 1',
  date: '2026-11-03',
  due_date: '2026-12-03',
  status: 'pendiente',
  items: FILA.items,
  subtotal: 100,
  iva: 21,
  iva_rate: 21,
  irpf: 0,
  irpf_rate: 0,
  total: 121,
  tipo_factura: 'F1',
  verifactu_estado: 'emitida',
  operacion_exenta: null,
  exencion_detalle: null,
  rectifica_invoice_id: null,
}
const PERFIL = { name: 'Empresa Test SL', nif: 'B98407901', address: 'Calle Mayor 1' }

test('datos del PDF: título por tipo, mención de exención, rectificada y anulada', () => {
  const completa = invoicePDFDataFromRow(FILA_PDF, PERFIL)
  assert.equal(completa.titulo, 'FACTURA')
  assert.equal(completa.mencionExencion, null)
  assert.equal(completa.rectifica, null)
  assert.equal(completa.anulada, false)

  const simplificada = invoicePDFDataFromRow({ ...FILA_PDF, number: 'S-2026-000001', tipo_factura: 'F2', client_nif: null }, PERFIL)
  assert.equal(simplificada.titulo, 'FACTURA SIMPLIFICADA')

  const exenta = invoicePDFDataFromRow(
    { ...FILA_PDF, iva: 0, iva_rate: 0, total: 100, operacion_exenta: 'E1', exencion_detalle: 'Art. 20.Uno.23.º' },
    PERFIL
  )
  assert.match(exenta.mencionExencion, /^Operación exenta de IVA \(artículo 20 de la Ley 37\/1992/)
  assert.match(exenta.mencionExencion, /Art\. 20\.Uno\.23\.º$/)

  const rectificativa = invoicePDFDataFromRow(
    { ...FILA_PDF, number: 'R-2026-000001', tipo_factura: 'R1', subtotal: -20, iva: -4.2, total: -24.2, rectifica_invoice_id: 'inv-emitida' },
    PERFIL,
    null,
    { numero: 'F-2026-000007', fecha: '2026-11-03' }
  )
  assert.equal(rectificativa.titulo, 'FACTURA RECTIFICATIVA')
  assert.deepEqual(rectificativa.rectifica, { numero: 'F-2026-000007', fecha: '2026-11-03' })

  const r5 = invoicePDFDataFromRow({ ...FILA_PDF, number: 'RS-2026-000001', tipo_factura: 'R5', client_nif: null }, PERFIL)
  assert.equal(r5.titulo, 'FACTURA SIMPLIFICADA RECTIFICATIVA')

  const anulada = invoicePDFDataFromRow({ ...FILA_PDF, verifactu_estado: 'anulada' }, PERFIL)
  assert.equal(anulada.anulada, true)

  // Factura sin emitir (flujo sin VERI*FACTU) y sin NIF del cliente: simplificada
  const borrador = invoicePDFDataFromRow({ ...FILA_PDF, tipo_factura: null, verifactu_estado: 'borrador', client_nif: '' }, PERFIL)
  assert.equal(borrador.titulo, 'FACTURA SIMPLIFICADA')
})

test('el PDF de servidor se genera en los cuatro casos nuevos', async () => {
  const ts = (await import('typescript')).default
  const rutaTsx = fileURLToPath(new URL('../../pdf/invoice-pdf-server.tsx', import.meta.url))
  const rutaTmp = fileURLToPath(new URL('../../pdf/.v28-invoice-pdf-server.tmp.mjs', import.meta.url))
  const js = ts.transpileModule(readFileSync(rutaTsx, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  writeFileSync(rutaTmp, js)
  try {
    const { generateInvoicePDFBuffer } = await import(new URL('../../pdf/.v28-invoice-pdf-server.tmp.mjs', import.meta.url))
    const casos = [
      invoicePDFDataFromRow({ ...FILA_PDF, iva: 0, iva_rate: 0, total: 100, operacion_exenta: 'E1' }, PERFIL),
      invoicePDFDataFromRow({ ...FILA_PDF, number: 'S-2026-000001', tipo_factura: 'F2', client_nif: null }, PERFIL),
      invoicePDFDataFromRow(
        { ...FILA_PDF, number: 'RS-2026-000001', tipo_factura: 'R5', client_nif: null, subtotal: -100, iva: -21, total: -121, rectifica_invoice_id: 'x' },
        PERFIL,
        null,
        { numero: 'S-2026-000001', fecha: '2026-11-03' }
      ),
      invoicePDFDataFromRow({ ...FILA_PDF, verifactu_estado: 'anulada' }, PERFIL),
    ]
    for (const datos of casos) {
      const pdf = await generateInvoicePDFBuffer(datos)
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
      assert.ok(pdf.length > 1500, `PDF demasiado pequeño: ${pdf.length} B`)
    }
  } finally {
    rmSync(rutaTmp, { force: true })
  }
})
