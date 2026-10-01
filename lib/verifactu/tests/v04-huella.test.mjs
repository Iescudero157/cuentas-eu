// V04 — Tests de la librería de huella encadenada (lib/verifactu/huella.ts).
//
// Vectores oficiales: documento AEAT «Detalle de las especificaciones técnicas
// para generación de la huella o hash de los registros de facturación»
// v0.1.2 (27/08/2024), §6 Ejemplos (casos 1, 2 y 3).
//
// Ejecutar (Node >= 22.18, con type-stripping nativo de TypeScript):
//   npm test   (= node --test lib/verifactu/tests/v04-huella.test.mjs)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  TIPO_HUELLA_SHA256,
  esHuellaValida,
  cadenaEntradaAlta,
  cadenaEntradaAnulacion,
  cadenaEntradaEvento,
  huellaAlta,
  huellaAnulacion,
  huellaEvento,
  verificarCadena,
  formatearImporte,
  formatearFechaExpedicion,
  fechaHoraHusoGenRegistro,
} from '../huella.ts'

// --- Vectores oficiales del doc. AEAT v0.1.2, §6 ---------------------------

const ALTA_1 = {
  IDEmisorFactura: '89890001K',
  NumSerieFactura: '12345678/G33',
  FechaExpedicionFactura: '01-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '12.35',
  ImporteTotal: '123.45',
  FechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
}
const HUELLA_1 = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60'

const ALTA_2 = {
  IDEmisorFactura: '89890001K',
  NumSerieFactura: '12345679/G34',
  FechaExpedicionFactura: '01-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '12.35',
  ImporteTotal: '123.45',
  FechaHoraHusoGenRegistro: '2024-01-01T19:20:35+01:00',
}
const HUELLA_2 = 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97'

const ANULACION_3 = {
  IDEmisorFacturaAnulada: '89890001K',
  NumSerieFacturaAnulada: '12345679/G34',
  FechaExpedicionFacturaAnulada: '01-01-2024',
  FechaHoraHusoGenRegistro: '2024-01-01T19:20:40+01:00',
}
const HUELLA_3 = '177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68'

test('caso oficial 1: cadena de entrada del primer registro de alta', () => {
  assert.equal(
    cadenaEntradaAlta(ALTA_1, null),
    'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00'
  )
})

test('caso oficial 1: huella del primer registro de alta', () => {
  assert.equal(huellaAlta(ALTA_1, null), HUELLA_1)
  assert.equal(huellaAlta(ALTA_1, ''), HUELLA_1) // '' equivale a primer registro
})

test('caso oficial 2: huella de alta encadenada con registro anterior', () => {
  assert.equal(huellaAlta(ALTA_2, HUELLA_1), HUELLA_2)
})

test('caso oficial 3: huella de anulación encadenada', () => {
  assert.equal(
    cadenaEntradaAnulacion(ANULACION_3, HUELLA_2),
    `IDEmisorFacturaAnulada=89890001K&NumSerieFacturaAnulada=12345679/G34&FechaExpedicionFacturaAnulada=01-01-2024&Huella=${HUELLA_2}&FechaHoraHusoGenRegistro=2024-01-01T19:20:40+01:00`
  )
  assert.equal(huellaAnulacion(ANULACION_3, HUELLA_2), HUELLA_3)
})

test('formato de salida: 64 hex mayúsculas y TipoHuella=01', () => {
  assert.equal(TIPO_HUELLA_SHA256, '01')
  assert.ok(esHuellaValida(HUELLA_1))
  assert.ok(!esHuellaValida(HUELLA_1.toLowerCase()))
  assert.ok(!esHuellaValida(HUELLA_1.slice(0, 63)))
  assert.ok(!esHuellaValida(''))
})

// --- Reglas de tratamiento de valores (doc. AEAT §3) ------------------------

test('los valores se recortan (trim) como en el ejemplo oficial del documento', () => {
  // <NumSerieFactura>    12345678 / G33  </NumSerieFactura> → "12345678 / G33"
  const cadena = cadenaEntradaAlta({ ...ALTA_1, NumSerieFactura: '    12345678 / G33  ' }, null)
  assert.ok(cadena.includes('&NumSerieFactura=12345678 / G33&'))
})

test('campo ausente o vacío → solo «Campo=»', () => {
  const cadena = cadenaEntradaAlta({ ...ALTA_1, TipoFactura: '', CuotaTotal: '   ' }, null)
  assert.ok(cadena.includes('&TipoFactura=&CuotaTotal=&'))
})

test('la huella es sensible a cualquier cambio de valor', () => {
  assert.notEqual(huellaAlta({ ...ALTA_1, ImporteTotal: '123.46' }, null), HUELLA_1)
  assert.notEqual(huellaAlta(ALTA_1, HUELLA_2), HUELLA_1)
})

// --- Registro de evento (doc. AEAT §3.c; cadena propia, se usará en V06) ----

test('evento: cadena de entrada con los 9 campos oficiales y ID vacío excluyente', () => {
  const cadena = cadenaEntradaEvento(
    {
      NIFSistemaInformatico: '89890001K',
      ID: '',
      IdSistemaInformatico: '77',
      Version: '1.0.03',
      NumeroInstalacion: '383',
      NIFObligadoEmision: '89890002E',
      TipoEvento: '01',
      FechaHoraHusoGenEvento: '2024-01-01T19:20:30+01:00',
    },
    null
  )
  // Ejemplo del doc. §3: «NIF=89890001K&ID=&IdSistemaInformatico=…»
  assert.ok(cadena.startsWith('NIF=89890001K&ID=&IdSistemaInformatico=77&'))
  assert.equal(
    cadena,
    'NIF=89890001K&ID=&IdSistemaInformatico=77&Version=1.0.03&NumeroInstalacion=383&NIF=89890002E&TipoEvento=01&HuellaEvento=&FechaHoraHusoGenEvento=2024-01-01T19:20:30+01:00'
  )
})

test('evento: huella con formato oficial y encadenado sensible', () => {
  const datos = {
    NIFSistemaInformatico: '89890001K',
    ID: '',
    IdSistemaInformatico: '77',
    Version: '1.0.03',
    NumeroInstalacion: '383',
    NIFObligadoEmision: '89890002E',
    TipoEvento: '01',
    FechaHoraHusoGenEvento: '2024-01-01T19:20:30+01:00',
  }
  const h1 = huellaEvento(datos, null)
  assert.ok(esHuellaValida(h1))
  assert.notEqual(huellaEvento(datos, h1), h1)
})

// --- Verificación de integridad de una cadena -------------------------------

// Cadena oficial completa: alta 1 → alta 2 → anulación 3.
const CADENA_OFICIAL = [
  { tipo: 'alta', primerRegistro: true, huellaAnterior: null, huella: HUELLA_1, datos: ALTA_1 },
  { tipo: 'alta', primerRegistro: false, huellaAnterior: HUELLA_1, huella: HUELLA_2, datos: ALTA_2 },
  {
    tipo: 'anulacion',
    primerRegistro: false,
    huellaAnterior: HUELLA_2,
    huella: HUELLA_3,
    datos: ANULACION_3,
  },
]

test('verificarCadena: la cadena oficial de 3 eslabones es válida', () => {
  const r = verificarCadena(CADENA_OFICIAL)
  assert.deepEqual(r.errores, [])
  assert.equal(r.valida, true)
  assert.equal(r.ultimaHuella, HUELLA_3)
})

test('verificarCadena: cadena vacía es válida y sin última huella', () => {
  const r = verificarCadena([])
  assert.equal(r.valida, true)
  assert.equal(r.ultimaHuella, null)
})

test('verificarCadena: detecta manipulación del contenido de un eslabón', () => {
  const manipulada = structuredClone(CADENA_OFICIAL)
  manipulada[1].datos.ImporteTotal = '999.99'
  const r = verificarCadena(manipulada)
  assert.equal(r.valida, false)
  assert.deepEqual(
    r.errores.map((e) => [e.indice, e.codigo]),
    [[1, 'HUELLA_NO_COINCIDE']]
  )
})

test('verificarCadena: detecta encadenado roto', () => {
  const rota = structuredClone(CADENA_OFICIAL)
  rota[2].huellaAnterior = HUELLA_1 // debería ser HUELLA_2
  const r = verificarCadena(rota)
  assert.equal(r.valida, false)
  const codigos = r.errores.map((e) => e.codigo)
  assert.ok(codigos.includes('ENCADENADO_ROTO'))
  assert.ok(codigos.includes('HUELLA_NO_COINCIDE')) // la huella se calculó con otra anterior
  assert.ok(r.errores.every((e) => e.indice === 2))
})

test('verificarCadena: detecta huella declarada con formato inválido', () => {
  const mala = structuredClone(CADENA_OFICIAL).slice(0, 1)
  mala[0].huella = HUELLA_1.toLowerCase()
  const r = verificarCadena(mala)
  assert.equal(r.valida, false)
  const codigos = r.errores.map((e) => e.codigo)
  assert.ok(codigos.includes('FORMATO_HUELLA'))
})

test('verificarCadena: primer eslabón incoherente', () => {
  // No marcado como primero
  let r = verificarCadena([{ ...CADENA_OFICIAL[0], primerRegistro: false }])
  assert.ok(r.errores.some((e) => e.codigo === 'PRIMER_REGISTRO_INCOHERENTE'))
  // Marcado como primero en mitad de la cadena
  const enMedio = structuredClone(CADENA_OFICIAL)
  enMedio[1].primerRegistro = true
  r = verificarCadena(enMedio)
  assert.deepEqual(
    r.errores.map((e) => [e.indice, e.codigo]),
    [[1, 'PRIMER_REGISTRO_INCOHERENTE']]
  )
})

test('verificarCadena: fragmento que continúa una cadena existente (huellaPrevia)', () => {
  const fragmento = CADENA_OFICIAL.slice(1)
  const r = verificarCadena(fragmento, { huellaPrevia: HUELLA_1 })
  assert.equal(r.valida, true)
  assert.equal(r.ultimaHuella, HUELLA_3)
  // Con la huella previa equivocada, el fragmento no enlaza
  const mal = verificarCadena(fragmento, { huellaPrevia: HUELLA_3 })
  assert.equal(mal.valida, false)
  assert.ok(mal.errores.some((e) => e.indice === 0 && e.codigo === 'ENCADENADO_ROTO'))
})

// --- Formateadores oficiales -------------------------------------------------

test('formatearImporte: punto decimal y 2 decimales', () => {
  assert.equal(formatearImporte(123.45), '123.45')
  assert.equal(formatearImporte(123.1), '123.10')
  assert.equal(formatearImporte(0), '0.00')
  assert.equal(formatearImporte(1.005), '1.01') // sin error de redondeo binario
  assert.equal(formatearImporte(-5), '-5.00') // rectificativas negativas
  assert.equal(formatearImporte(' 12.3 '), '12.30')
  assert.throws(() => formatearImporte('no-numero'))
})

test('formatearFechaExpedicion: dd-mm-aaaa', () => {
  assert.equal(formatearFechaExpedicion('2024-01-01'), '01-01-2024')
  assert.equal(formatearFechaExpedicion('2026-12-31'), '31-12-2026')
  assert.throws(() => formatearFechaExpedicion('01/01/2024'))
})

test('fechaHoraHusoGenRegistro: huso peninsular invierno (+01:00) y verano (+02:00)', () => {
  assert.equal(
    fechaHoraHusoGenRegistro(new Date('2024-01-01T18:20:30Z')),
    '2024-01-01T19:20:30+01:00'
  )
  assert.equal(
    fechaHoraHusoGenRegistro(new Date('2024-07-01T10:00:00Z')),
    '2024-07-01T12:00:00+02:00'
  )
  // Cambio de día al pasar a hora peninsular
  assert.equal(
    fechaHoraHusoGenRegistro(new Date('2024-12-31T23:30:00Z')),
    '2025-01-01T00:30:00+01:00'
  )
})

test('round-trip: huella generada con formateadores verifica en la cadena', () => {
  const datos = {
    IDEmisorFactura: 'B98407901',
    NumSerieFactura: 'F-2026-000001',
    FechaExpedicionFactura: formatearFechaExpedicion('2026-09-12'),
    TipoFactura: 'F1',
    CuotaTotal: formatearImporte(21),
    ImporteTotal: formatearImporte(121),
    FechaHoraHusoGenRegistro: fechaHoraHusoGenRegistro(new Date('2026-09-12T08:00:00Z')),
  }
  const h = huellaAlta(datos, null)
  const r = verificarCadena([
    { tipo: 'alta', primerRegistro: true, huellaAnterior: null, huella: h, datos },
  ])
  assert.equal(r.valida, true)
})
