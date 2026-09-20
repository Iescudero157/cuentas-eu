// Tests V16: conservación y exportación (export.ts). Construye una cadena
// REAL de registros (generadores V05/V06), la exporta a lotes
// RegFactuSistemaFacturacion + ZIP y re-verifica las huellas sobre lo
// exportado, incluida la detección de manipulaciones. Los lotes se validan
// contra los XSD OFICIALES de la AEAT. Ejecutar con: npm test.

import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { construirRegistroAlta, sistemaInformaticoKuentas } from '../registro-alta.ts'
import { construirRegistroAnulacion } from '../registro-anulacion.ts'
import {
  construirExport,
  construirLotesExport,
  extraerRegistrosDeEnvio,
  sha256HexDe,
  verificarRegistrosExtraidos,
  verificarZipExport,
  xmlDeFilaRegistro,
  ErrorExport,
} from '../export.ts'
import { validarEnvioXsd } from './helpers/xsd-validator.mjs'

// ---------------------------------------------------------------------------
// Fabricación de una cadena real (generadores oficiales V05/V06)
// ---------------------------------------------------------------------------

const EMISOR = { nif: 'B98407901', nombreRazon: 'Mercadonet Global S.L.' }
const SIF = sistemaInformaticoKuentas('KU-test-0001')
const CONFIG = {
  nif_obligado: EMISOR.nif,
  nombre_razon: EMISOR.nombreRazon,
  numero_instalacion: 'KU-test-0001',
}
const CABECERA = { obligadoEmision: { nif: EMISOR.nif, nombreRazon: EMISOR.nombreRazon } }

function entradaAlta(i) {
  return {
    emisor: EMISOR,
    numSerieFactura: `F-2026-00000${i}`,
    fechaExpedicion: '2026-09-18',
    tipoFactura: 'F1',
    descripcionOperacion: 'Servicio de suscripción mensual',
    destinatarios: [{ nombreRazon: 'Cliente Ejemplo S.L.', nif: 'A58818501' }],
    desglose: [
      {
        claveRegimen: '01',
        calificacionOperacion: 'S1',
        tipoImpositivo: 21,
        baseImponible: 100 * i,
        cuotaRepercutida: 21 * i,
      },
    ],
  }
}

/**
 * Cadena real de n registros (la posición 3 es una anulación) con las mismas
 * columnas que sif_registros. `sinXmlEn` deja esa posición sin XML fijado
 * (obliga a reconstruir desde el jsonb, como haría el worker V10).
 */
function cadenaReal(n = 5, { sinXmlEn = [] } = {}) {
  const filas = []
  let huellaAnterior = null
  let anterior = null
  for (let i = 1; i <= n; i++) {
    const tipo = i === 3 && n >= 3 ? 'anulacion' : 'alta'
    const fechaGeneracion = new Date(`2026-09-18T10:${String(i).padStart(2, '0')}:00+02:00`)
    const encadenamiento =
      i === 1
        ? { primerRegistro: true }
        : {
            registroAnterior: {
              idEmisorFactura: EMISOR.nif,
              numSerieFactura: anterior.num_serie_factura,
              fechaExpedicion: '2026-09-18',
              huella: huellaAnterior,
            },
          }
    const opciones = { encadenamiento, sistemaInformatico: SIF, fechaGeneracion }
    const entrada =
      tipo === 'alta'
        ? entradaAlta(i)
        : {
            emisor: { nif: EMISOR.nif },
            numSerieFacturaAnulada: `F-2026-00000${i - 1}`,
            fechaExpedicionFacturaAnulada: '2026-09-18',
          }
    const generado =
      tipo === 'alta'
        ? construirRegistroAlta(entrada, opciones)
        : construirRegistroAnulacion(entrada, opciones)
    const fila = {
      id: `reg-${i}`,
      correlativo: i,
      tipo_registro: tipo,
      id_emisor_factura: EMISOR.nif,
      num_serie_factura: tipo === 'alta' ? entrada.numSerieFactura : entrada.numSerieFacturaAnulada,
      fecha_expedicion: '2026-09-18',
      tipo_factura: tipo === 'alta' ? 'F1' : null,
      primer_registro: i === 1,
      huella_anterior: huellaAnterior,
      huella: generado.huella,
      fecha_hora_huso_gen: generado.fechaHoraHusoGenRegistro,
      generado_at: fechaGeneracion.toISOString(),
      xml: sinXmlEn.includes(i) ? null : generado.xml,
      registro: {
        entrada,
        sistemaInformatico: SIF,
        encadenamiento,
        fechaHoraHusoGenRegistro: generado.fechaHoraHusoGenRegistro,
        tipoHuella: '01',
        huella: generado.huella,
      },
    }
    filas.push(fila)
    huellaAnterior = generado.huella
    anterior = fila
  }
  return filas
}

function eventosDe(filas) {
  // Cadena de eventos mínima y consistente (solo linkage: la huella de los
  // eventos se recalcula en BD y en V12, aquí se verifica la continuidad).
  const eventos = []
  let anterior = null
  for (let i = 1; i <= 2; i++) {
    const huella = sha256HexDe(`evento-${i}-${filas.length}`)
    eventos.push({
      correlativo: i,
      tipo_evento: i === 1 ? 'deteccion_anomalias_registros' : 'export_registros',
      datos: {},
      primer_evento: i === 1,
      huella_anterior: anterior,
      tipo_huella: '01',
      huella,
      fecha_hora_huso_gen: `2026-09-18T11:0${i}:00+02:00`,
      generado_at: `2026-09-18T09:0${i}:00.000Z`,
    })
    anterior = huella
  }
  return eventos
}

const AHORA = new Date('2026-09-19T12:00:00+02:00')

function codigos(informe) {
  return informe.anomalias.map((a) => a.codigo)
}

// ---------------------------------------------------------------------------
// Lotes: formato oficial, troceo y XML de fila
// ---------------------------------------------------------------------------

test('los lotes exportados validan contra SuministroLR.xsd (formato oficial de remisión)', async () => {
  const filas = cadenaReal(4)
  const lotes = construirLotesExport(CABECERA, filas)
  assert.equal(lotes.length, 1)
  const r = await validarEnvioXsd(lotes[0].xml.replace(/^<\?xml[^>]*\?>\n/, ''))
  assert.ok(r.valida, `Lote no válido contra el XSD oficial:\n${r.errores.join('\n')}`)
})

test('troceo en lotes de tamaño máximo con correlativos contiguos', () => {
  const filas = cadenaReal(5)
  const lotes = construirLotesExport(CABECERA, filas, 2)
  assert.equal(lotes.length, 3)
  assert.deepEqual(
    lotes.map((l) => [l.fichero, l.registros, l.correlativoDesde, l.correlativoHasta]),
    [
      ['registros/registros-00001.xml', 2, 1, 2],
      ['registros/registros-00002.xml', 2, 3, 4],
      ['registros/registros-00003.xml', 1, 5, 5],
    ]
  )
})

test('xmlDeFilaRegistro reconstruye desde el jsonb si el XML no está fijado', () => {
  const [conXml] = cadenaReal(1)
  const [sinXml] = cadenaReal(1, { sinXmlEn: [1] })
  assert.equal(sinXml.xml, null)
  assert.equal(xmlDeFilaRegistro(sinXml), conXml.xml)
})

test('xmlDeFilaRegistro rechaza una fila cuya huella no casa con el contenido (no se exporta XML corrupto)', () => {
  const [fila] = cadenaReal(1, { sinXmlEn: [1] })
  const corrupta = { ...fila, huella: 'A'.repeat(64) }
  assert.throws(() => xmlDeFilaRegistro(corrupta), (e) => e instanceof ErrorExport && e.codigo === 'huella_divergente')
})

// ---------------------------------------------------------------------------
// Roundtrip: extraer del XML exportado y re-verificar huellas
// ---------------------------------------------------------------------------

test('roundtrip íntegro: extraer los lotes y recalcular la cadena → 0 anomalías', () => {
  const filas = cadenaReal(5)
  const lotes = construirLotesExport(CABECERA, filas, 2)
  const extraidos = []
  for (const lote of lotes) {
    const { obligado, registros } = extraerRegistrosDeEnvio(lote.xml)
    assert.equal(obligado.nif, EMISOR.nif)
    for (const r of registros) extraidos.push({ ...r, posicion: extraidos.length + 1 })
  }
  assert.equal(extraidos.length, 5)
  assert.equal(extraidos[2].tipoRegistro, 'anulacion')
  const informe = verificarRegistrosExtraidos(extraidos, {
    ultimaHuellaEsperada: filas.at(-1).huella,
    debeSerDesdePrimerRegistro: true,
  })
  assert.deepEqual(informe.anomalias, [])
  assert.equal(informe.integra, true)
  assert.equal(informe.ultimaHuella, filas.at(-1).huella)
  assert.equal(informe.anclaHuellaAnterior, null)
})

test('manipular un importe del XML exportado → HUELLA_NO_COINCIDE', () => {
  const filas = cadenaReal(3)
  const [lote] = construirLotesExport(CABECERA, filas)
  const manipulado = lote.xml.replace('<sf:ImporteTotal>121.00</sf:ImporteTotal>', '<sf:ImporteTotal>221.00</sf:ImporteTotal>')
  assert.notEqual(manipulado, lote.xml)
  const { registros } = extraerRegistrosDeEnvio(manipulado)
  const informe = verificarRegistrosExtraidos(registros, { debeSerDesdePrimerRegistro: true })
  assert.ok(codigos(informe).includes('HUELLA_NO_COINCIDE'))
})

test('eliminar un registro intermedio del XML exportado → ENCADENADO_ROTO', () => {
  const filas = cadenaReal(4)
  const [lote] = construirLotesExport(CABECERA, filas)
  const { registros } = extraerRegistrosDeEnvio(lote.xml)
  const sinTercero = registros.filter((r) => r.posicion !== 3).map((r, i) => ({ ...r, posicion: i + 1 }))
  const informe = verificarRegistrosExtraidos(sinTercero, { debeSerDesdePrimerRegistro: true })
  assert.ok(codigos(informe).includes('ENCADENADO_ROTO'))
})

test('export parcial: la cadena se verifica anclada a la huella anterior declarada', () => {
  const filas = cadenaReal(5)
  const parciales = filas.slice(2) // correlativos 3..5
  const [lote] = construirLotesExport(CABECERA, parciales)
  const { registros } = extraerRegistrosDeEnvio(lote.xml)
  const informe = verificarRegistrosExtraidos(registros)
  assert.deepEqual(informe.anomalias, [])
  assert.equal(informe.anclaHuellaAnterior, filas[1].huella)
})

// ---------------------------------------------------------------------------
// Export completo (ZIP + manifiesto) y verificación del fichero
// ---------------------------------------------------------------------------

test('construirExport: ZIP íntegro, manifiesto coherente y re-verificación del fichero final', async () => {
  const filas = cadenaReal(5)
  const eventos = eventosDe(filas)
  const resultado = await construirExport(CONFIG, filas, eventos, {
    maxPorLote: 2,
    ahora: AHORA,
    ultimaHuellaCadena: filas.at(-1).huella,
  })

  const m = resultado.manifiesto
  assert.equal(m.obligado.nif, EMISOR.nif)
  assert.equal(m.registros.total, 5)
  assert.equal(m.registros.altas, 4)
  assert.equal(m.registros.anulaciones, 1)
  assert.equal(m.registros.primeraHuella, filas[0].huella)
  assert.equal(m.registros.ultimaHuella, filas.at(-1).huella)
  assert.equal(m.lotes.length, 3)
  assert.equal(m.alcance.desdePrimerRegistro, true)
  assert.equal(m.alcance.hastaUltimoRegistro, true)
  assert.equal(m.eventos.total, 2)
  assert.equal(m.verificacion.integra, true)
  assert.match(resultado.nombreFichero, /^verifactu-export-B98407901-1-5-\d{8}-\d{6}\.zip$/)

  // Verificación del fichero LITERAL que se entrega
  assert.equal(resultado.verificacionZip.integra, true)
  assert.equal(resultado.verificacionZip.registros, 5)
  assert.equal(resultado.verificacionZip.ficherosComprobados, 4) // 3 lotes + eventos

  // Y una verificación independiente del mismo ZIP
  const informe = await verificarZipExport(resultado.zip)
  assert.deepEqual(informe.anomalias, [])
  assert.equal(informe.integra, true)
})

test('sin registros → ErrorExport sin_registros', async () => {
  await assert.rejects(
    () => construirExport(CONFIG, [], [], { ahora: AHORA }),
    (e) => e instanceof ErrorExport && e.codigo === 'sin_registros'
  )
})

test('manipular un lote dentro del ZIP → FICHERO_MANIPULADO al re-verificar', async () => {
  const filas = cadenaReal(3)
  const resultado = await construirExport(CONFIG, filas, [], { ahora: AHORA })

  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(resultado.zip)
  const fichero = resultado.manifiesto.lotes[0].fichero
  const xml = await zip.file(fichero).async('string')
  zip.file(fichero, xml.replace('121.00', '221.00'))
  const manipulado = await zip.generateAsync({ type: 'uint8array' })

  const informe = await verificarZipExport(manipulado)
  assert.equal(informe.integra, false)
  assert.ok(codigos(informe).includes('FICHERO_MANIPULADO'))
})

test('eliminar un fichero declarado en el manifiesto → MANIFIESTO_INCONSISTENTE', async () => {
  const filas = cadenaReal(3)
  const resultado = await construirExport(CONFIG, filas, [], { ahora: AHORA, maxPorLote: 2 })

  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(resultado.zip)
  zip.remove(resultado.manifiesto.lotes[1].fichero)
  const manipulado = await zip.generateAsync({ type: 'uint8array' })

  const informe = await verificarZipExport(manipulado)
  assert.equal(informe.integra, false)
  assert.ok(codigos(informe).includes('MANIFIESTO_INCONSISTENTE'))
})

test('romper la cadena de eventos exportada → EVENTOS_ENCADENADO_ROTO', async () => {
  const filas = cadenaReal(2)
  const eventos = eventosDe(filas)
  eventos[1].huella_anterior = 'B'.repeat(64)
  const resultado = await construirExport(CONFIG, filas, eventos, { ahora: AHORA })
  assert.equal(resultado.manifiesto.verificacion.integra, false)
  assert.ok(resultado.manifiesto.verificacion.anomalias.some((a) => a.codigo === 'EVENTOS_ENCADENADO_ROTO'))
})

test('el export declara export parcial cuando no llega al final de la cadena en BD', async () => {
  const filas = cadenaReal(5)
  const parciales = filas.slice(1, 4) // correlativos 2..4
  const resultado = await construirExport(CONFIG, parciales, [], {
    ahora: AHORA,
    ultimaHuellaCadena: filas.at(-1).huella,
  })
  assert.equal(resultado.manifiesto.alcance.desdePrimerRegistro, false)
  assert.equal(resultado.manifiesto.alcance.hastaUltimoRegistro, false)
  assert.equal(resultado.verificacionZip.integra, true)
  assert.equal(resultado.verificacionZip.anclaHuellaAnterior, filas[0].huella)
})
