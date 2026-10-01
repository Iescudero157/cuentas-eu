// Tests V08: QR tributario y leyenda VERI*FACTU.
//
// La URL de cotejo se verifica contra los EJEMPLOS OFICIALES del documento
// AEAT «Detalle de las especificaciones técnicas del código "QR" de la
// factura…» v0.5.0 (10/12/2025), §4 (URL encoding) y §8 (URL válidas).
// Ejecutar con: npm test  (node --test, sin transpilación).

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import QRCode from 'qrcode'

import {
  construirUrlCotejo,
  construirBloqueQR,
  generarQrPngDataUrl,
  datosCotejoDesdeRegistro,
  ErrorQR,
  URL_COTEJO_VERIFACTU,
  URL_COTEJO_NO_VERIFACTU,
  TITULO_QR,
  LEYENDA_VERIFACTU,
  MARCA_VERIFACTU,
  QR_LADO_MM,
} from '../qr.ts'

// ---------------------------------------------------------------------------
// URL de cotejo: ejemplos oficiales del documento AEAT
// ---------------------------------------------------------------------------

test('URL oficial §4: URL-encoding del ejemplo con «&» en numserie (pruebas)', () => {
  const url = construirUrlCotejo(
    { nif: '89890001K', numSerie: '12345678&G33', fecha: '01-01-2024', importe: '241.4' },
    'pruebas'
  )
  assert.equal(
    url,
    'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678%26G33&fecha=01-01-2024&importe=241.4'
  )
})

test('URL oficial §8.1: entorno de pruebas, SIF que emite facturas verificables', () => {
  const url = construirUrlCotejo(
    { nif: '89890001K', numSerie: '12345678-G33', fecha: '01-09-2024', importe: '241.4' },
    'pruebas'
  )
  assert.equal(
    url,
    'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678-G33&fecha=01-09-2024&importe=241.4'
  )
})

test('URL oficial §8.3: entorno de producción, SIF que emite facturas verificables', () => {
  const url = construirUrlCotejo(
    { nif: '89890001K', numSerie: '12345678-G33', fecha: '01-09-2024', importe: '241.4' },
    'produccion'
  )
  assert.equal(
    url,
    'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678-G33&fecha=01-09-2024&importe=241.4'
  )
})

test('URL oficial §8.2/§8.4: modo no-VERI*FACTU usa ValidarQRNoVerifactu', () => {
  const datos = { nif: '89890001K', numSerie: '12345678-G33', fecha: '01-09-2024', importe: '241.4' }
  assert.equal(
    construirUrlCotejo(datos, 'pruebas', { modalidad: 'no_verifactu' }),
    'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=89890001K&numserie=12345678-G33&fecha=01-09-2024&importe=241.4'
  )
  assert.equal(
    construirUrlCotejo(datos, 'produccion', { modalidad: 'no_verifactu' }),
    'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=89890001K&numserie=12345678-G33&fecha=01-09-2024&importe=241.4'
  )
})

// ---------------------------------------------------------------------------
// Formatos de los 4 parámetros (doc. QR §6)
// ---------------------------------------------------------------------------

test('importe numérico se formatea con 2 decimales, idéntico al ImporteTotal del registro', () => {
  const url = construirUrlCotejo(
    { nif: 'B98407901', numSerie: 'F-2026-000123', fecha: '2026-02-10', importe: 241.4 },
    'produccion'
  )
  assert.ok(url.endsWith('&importe=241.40'))
})

test('fecha SQL aaaa-mm-dd se convierte a dd-mm-aaaa', () => {
  const url = construirUrlCotejo(
    { nif: 'B98407901', numSerie: 'F-2026-000001', fecha: '2026-01-05', importe: 100 },
    'produccion'
  )
  assert.ok(url.includes('&fecha=05-01-2026&'))
})

test('numserie con espacios y caracteres especiales queda URL-encoded (UTF-8)', () => {
  const url = construirUrlCotejo(
    { nif: 'B98407901', numSerie: 'FAC 2026/00 1+A&B=C', fecha: '01-01-2026', importe: 1 },
    'pruebas'
  )
  assert.ok(url.includes('numserie=FAC%202026%2F00%201%2BA%26B%3DC'))
  // La URL final solo contiene ASCII imprimible
  assert.match(url, /^[\x20-\x7e]+$/)
})

test('orden de parámetros FIJO: nif, numserie, fecha, importe', () => {
  const url = construirUrlCotejo(
    { nif: 'B98407901', numSerie: 'F-1', fecha: '01-01-2026', importe: 1 },
    'produccion'
  )
  const orden = [...url.matchAll(/[?&](\w+)=/g)].map((m) => m[1])
  assert.deepEqual(orden, ['nif', 'numserie', 'fecha', 'importe'])
})

test('validaciones: NIF incorrecto, numserie >60 o no ASCII, fecha e importe inválidos', () => {
  const base = { nif: 'B98407901', numSerie: 'F-1', fecha: '01-01-2026', importe: 1 }
  assert.throws(() => construirUrlCotejo({ ...base, nif: '12345678Z'.replace('Z', 'A') }, 'pruebas'), ErrorQR)
  assert.throws(() => construirUrlCotejo({ ...base, numSerie: 'X'.repeat(61) }, 'pruebas'), ErrorQR)
  assert.throws(() => construirUrlCotejo({ ...base, numSerie: 'AÑO-2026' }, 'pruebas'), ErrorQR)
  assert.throws(() => construirUrlCotejo({ ...base, numSerie: '' }, 'pruebas'), ErrorQR)
  assert.throws(() => construirUrlCotejo({ ...base, fecha: '31-02-2026' }, 'pruebas'), ErrorQR)
  assert.throws(() => construirUrlCotejo({ ...base, importe: 1e12 }, 'pruebas'), ErrorQR)
  assert.throws(() => construirUrlCotejo({ ...base, importe: '241.405' }, 'pruebas'), ErrorQR)
  // El error agrega todos los problemas detectados
  try {
    construirUrlCotejo({ nif: 'MAL', numSerie: '', fecha: 'ayer', importe: NaN }, 'pruebas')
    assert.fail('debería haber lanzado ErrorQR')
  } catch (e) {
    assert.ok(e instanceof ErrorQR)
    assert.ok(e.errores.length >= 4)
  }
})

test('datosCotejoDesdeRegistro mapea la fila de sif_registros (fuente de verdad)', () => {
  const url = construirUrlCotejo(
    datosCotejoDesdeRegistro({
      id_emisor_factura: 'B98407901',
      num_serie_factura: 'F-2026-000042',
      fecha_expedicion: '2026-03-15',
      importe_total: '121.00', // numeric de Postgres puede llegar como string
    }),
    'produccion'
  )
  assert.equal(
    url,
    'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=B98407901&numserie=F-2026-000042&fecha=15-03-2026&importe=121.00'
  )
})

// ---------------------------------------------------------------------------
// Código QR: nivel M y contenido exacto (art. 21 Orden)
// ---------------------------------------------------------------------------

const URL_EJEMPLO = construirUrlCotejo(
  { nif: 'B98407901', numSerie: 'F-2026-000123', fecha: '2026-02-10', importe: 121 },
  'produccion'
)

test('el QR se genera con corrección de errores nivel M y contiene la URL exacta', () => {
  const qr = QRCode.create(URL_EJEMPLO, { errorCorrectionLevel: 'M' })
  // En ISO/IEC 18004 el nivel M se codifica con los bits 00 (qrcode: bit = 0)
  assert.equal(qr.errorCorrectionLevel.bit, 0)
  const contenido = qr.segments.map((s) => Buffer.from(s.data).toString('utf8')).join('')
  assert.equal(contenido, URL_EJEMPLO)
})

test('generarQrPngDataUrl devuelve un PNG en data URL', async () => {
  const dataUrl = await generarQrPngDataUrl(URL_EJEMPLO)
  assert.ok(dataUrl.startsWith('data:image/png;base64,'))
  const png = Buffer.from(dataUrl.split(',')[1], 'base64')
  // Firma PNG y resolución apropiada (~512 px de lado ≈ 370 ppp a 35 mm;
  // qrcode redondea a un nº entero de píxeles por módulo)
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ancho = png.readUInt32BE(16)
  const alto = png.readUInt32BE(20)
  assert.equal(ancho, alto)
  assert.ok(ancho >= 450 && ancho <= 512, `lado del PNG: ${ancho} px`)
})

test('tamaño de impresión elegido dentro del rango legal 30-40 mm', () => {
  assert.ok(QR_LADO_MM >= 30 && QR_LADO_MM <= 40)
})

test('construirBloqueQR: leyenda + marca en VERI*FACTU, sin leyenda en no-VERI*FACTU', async () => {
  const datos = { nif: 'B98407901', numSerie: 'F-2026-000123', fecha: '2026-02-10', importe: 121 }
  const bloque = await construirBloqueQR(datos, 'produccion')
  assert.equal(bloque.urlCotejo, URL_EJEMPLO)
  assert.equal(bloque.titulo, TITULO_QR)
  assert.equal(bloque.titulo, 'QR tributario:')
  assert.equal(bloque.leyenda, LEYENDA_VERIFACTU)
  assert.equal(bloque.leyenda, 'Factura verificable en la sede electrónica de la AEAT')
  assert.equal(bloque.marca, MARCA_VERIFACTU)
  assert.ok(bloque.qrPngDataUrl.startsWith('data:image/png;base64,'))

  const bloqueNoV = await construirBloqueQR(datos, 'produccion', { modalidad: 'no_verifactu' })
  assert.equal(bloqueNoV.leyenda, null)
  assert.equal(bloqueNoV.marca, null)
  assert.equal(bloqueNoV.urlCotejo, construirUrlCotejo(datos, 'produccion', { modalidad: 'no_verifactu' }))
})

test('las URL base oficiales no cambian por accidente', () => {
  assert.equal(URL_COTEJO_VERIFACTU.produccion, 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR')
  assert.equal(URL_COTEJO_VERIFACTU.pruebas, 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR')
  assert.equal(URL_COTEJO_NO_VERIFACTU.produccion, 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu')
  assert.equal(URL_COTEJO_NO_VERIFACTU.pruebas, 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu')
})

// ---------------------------------------------------------------------------
// Snapshot funcional del PDF de servidor (plantilla .tsx transpilada al vuelo:
// node --test no ejecuta JSX, así que se compila con el propio TypeScript del
// proyecto a un módulo temporal y se genera un PDF real con y sin QR)
// ---------------------------------------------------------------------------

test('el PDF de servidor incorpora el bloque QR + leyenda cuando se le pasa', async () => {
  const ts = (await import('typescript')).default
  const rutaTsx = fileURLToPath(new URL('../../pdf/invoice-pdf-server.tsx', import.meta.url))
  const rutaTmp = fileURLToPath(new URL('../../pdf/.v08-invoice-pdf-server.tmp.mjs', import.meta.url))
  const js = ts.transpileModule(readFileSync(rutaTsx, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  writeFileSync(rutaTmp, js)
  try {
    const { generateInvoicePDFBuffer } = await import(new URL('../../pdf/.v08-invoice-pdf-server.tmp.mjs', import.meta.url))
    const base = {
      number: 'F-2026-000123',
      clientName: 'Cliente Ejemplo SL',
      clientNif: 'B98407901',
      date: '2026-02-10',
      status: 'pendiente',
      items: [{ description: 'Servicio', quantity: 1, unitPrice: 100, total: 100 }],
      subtotal: 100,
      iva: 21,
      ivaRate: 21,
      irpf: 0,
      irpfRate: 0,
      total: 121,
      issuerName: 'Autónomo Ejemplo',
      issuerNif: '89890001K',
    }
    const sinQR = await generateInvoicePDFBuffer(base)
    const verifactu = await construirBloqueQR(
      { nif: '89890001K', numSerie: 'F-2026-000123', fecha: '2026-02-10', importe: 121 },
      'pruebas'
    )
    const conQR = await generateInvoicePDFBuffer({ ...base, verifactu })
    assert.equal(sinQR.subarray(0, 5).toString(), '%PDF-')
    assert.equal(conQR.subarray(0, 5).toString(), '%PDF-')
    // El PDF con QR embebe la imagen: debe pesar sensiblemente más
    assert.ok(conQR.length > sinQR.length + 1000, `con QR ${conQR.length} B vs sin QR ${sinQR.length} B`)
  } finally {
    rmSync(rutaTmp, { force: true })
  }
})
