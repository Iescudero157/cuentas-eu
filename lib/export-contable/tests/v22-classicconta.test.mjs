// Tests V22: export contable «ClassicConta (AIG)» (classicconta.ts).
// Verifican el layout de ancho fijo del Protocolo de Comunicación Conta6 de
// AIG posición a posición (diario 869 c/registro, subcuentas 444), el formato
// de importes/fechas observado en los ficheros reales importados con éxito en
// CC7 (CC_diario.txt / CC_subcuentas.txt, Anexo A del plan maestro), el cuadre
// de los asientos, la estabilidad de los códigos de cliente, la codificación
// ANSI y el empaquetado ZIP. Ejecutar con: npm test.

import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import JSZip from 'jszip'

import {
  ANCHO_DIARIO,
  ANCHO_SUBCUENTAS,
  EOL,
  LAYOUT_DIARIO,
  LAYOUT_SUBCUENTAS,
  aAnsi,
  asignarCodigosClientes,
  bytesAnsi,
  campoImporte,
  campoTexto,
  centimos,
  construirExportClassicConta,
  claveCliente,
  ErrorExportCC,
  fechaAIG,
  FICHERO_DIARIO,
  FICHERO_LEEME,
  FICHERO_SUBCUENTAS,
  subcuentaFija,
  subcuentaIva,
  zipExportClassicConta,
} from '../classicconta.ts'

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Trocea una línea según un layout y devuelve un objeto campo → valor. */
function trocear(linea, layout) {
  const out = {}
  let pos = 0
  for (const { campo, ancho } of layout) {
    out[campo] = linea.slice(pos, pos + ancho)
    pos += ancho
  }
  return out
}

function factura(sobre = {}) {
  return {
    numero: 'F-2026-000001',
    fecha: '2026-01-15',
    clienteNombre: 'Acme Consulting S.L.',
    clienteNif: 'B12345674',
    clienteDireccion: 'C/ Mayor 1, Valencia',
    clienteEmail: 'admin@acme.es',
    clienteId: 'cli-001',
    base: 1000,
    cuotaIva: 210,
    tipoIva: 21,
    retencionIrpf: 0,
    totalFactura: 1210,
    rectificativa: false,
    ...sobre,
  }
}

// ---------------------------------------------------------------------------
// Layout: los anchos oficiales suman 869 / 444
// ---------------------------------------------------------------------------

test('layout del diario: 16 campos que suman 869', () => {
  assert.equal(LAYOUT_DIARIO.length, 16)
  assert.equal(LAYOUT_DIARIO.reduce((s, c) => s + c.ancho, 0), ANCHO_DIARIO)
})

test('layout de subcuentas: 20 campos que suman 444', () => {
  assert.equal(LAYOUT_SUBCUENTAS.length, 20)
  assert.equal(LAYOUT_SUBCUENTAS.reduce((s, c) => s + c.ancho, 0), ANCHO_SUBCUENTAS)
})

// ---------------------------------------------------------------------------
// Formateo de campos (formato verificado contra CC_diario.txt real)
// ---------------------------------------------------------------------------

test('campoImporte: punto decimal, ceros a la izquierda, 16 posiciones', () => {
  assert.equal(campoImporte(121000), '0000000001210.00')
  assert.equal(campoImporte(300000), '0000000003000.00')
  assert.equal(campoImporte(0), '0000000000000.00')
  assert.equal(campoImporte(5), '0000000000000.05')
})

test('campoImporte negativo: signo delante de los ceros (como el fichero real)', () => {
  assert.equal(campoImporte(-369395), '-000000003693.95')
  assert.equal(campoImporte(-12100), '-000000000121.00')
})

test('campoImporte rechaza no enteros', () => {
  assert.throws(() => campoImporte(12.5), ErrorExportCC)
})

test('fechaAIG: aaaammdd y rechazo de fechas mal formadas', () => {
  assert.equal(fechaAIG('2026-01-15'), '20260115')
  assert.throws(() => fechaAIG('15/01/2026'), ErrorExportCC)
  assert.throws(() => fechaAIG(''), ErrorExportCC)
})

test('centimos: redondeo correcto de céntimos', () => {
  assert.equal(centimos(1210), 121000)
  assert.equal(centimos(19.99), 1999)
  assert.equal(centimos(0.1 + 0.2), 30)
  assert.equal(centimos(-121), -12100)
})

test('campoTexto: recorte y relleno con blancos a la derecha', () => {
  assert.equal(campoTexto('ABC', 5), 'ABC  ')
  assert.equal(campoTexto('ABCDEFGH', 5), 'ABCDE')
  assert.equal(campoTexto(null, 3), '   ')
})

test('aAnsi: conserva latin1 y translitera lo que no cabe en ANSI', () => {
  assert.equal(aAnsi('Peñíscola año'), 'Peñíscola año')
  assert.equal(aAnsi('Coste… 30€'), 'Coste... 30EUR')
  assert.equal(aAnsi('“Comillas” – raya'), '"Comillas" - raya')
  assert.equal(aAnsi('Kaluža'), 'Kaluza') // ž → z (fuera de latin1, se despoja el diacrítico)
})

// ---------------------------------------------------------------------------
// Subcuentas: códigos
// ---------------------------------------------------------------------------

test('subcuentaFija y subcuentaIva construyen códigos del plan de 9 dígitos', () => {
  assert.equal(subcuentaFija('705', 9), '705000000')
  assert.equal(subcuentaFija('473', 9), '473000000')
  assert.equal(subcuentaIva('477', 21, 9), '477000021')
  assert.equal(subcuentaIva('477', 10, 9), '477000010')
  assert.equal(subcuentaIva('477', 4, 9), '477000004')
})

test('códigos de cliente estables entre exports y sin colisiones', () => {
  const a = claveCliente({ clienteId: null, clienteNif: 'B12345674', clienteNombre: 'Acme' })
  const b = claveCliente({ clienteId: null, clienteNif: 'b-1234.5674', clienteNombre: 'Otro nombre' })
  assert.equal(a, b) // el NIF normalizado manda
  const m1 = asignarCodigosClientes([a, 'nif:X111', 'nif:X222'], '430', 9)
  const m2 = asignarCodigosClientes(['nif:X222', a], '430', 9) // otro orden y censo
  assert.equal(m1.get(a), m2.get(a))
  assert.equal(m1.get('nif:X222'), m2.get('nif:X222'))
  const codigos = new Set(m1.values())
  assert.equal(codigos.size, 3)
  for (const c of codigos) assert.match(c, /^430\d{6}$/)
})

// ---------------------------------------------------------------------------
// Asiento de venta: posiciones exactas del diario
// ---------------------------------------------------------------------------

test('venta simple: 3 apuntes, posiciones y anchos exactos', () => {
  const r = construirExportClassicConta([factura()])
  assert.equal(r.asientos, 1)
  assert.equal(r.apuntes.length, 3)
  assert.equal(r.avisos.length, 0)

  const lineas = r.diarioTxt.split(EOL)
  assert.equal(lineas.at(-1), '') // CRLF final
  const cuerpo = lineas.slice(0, -1)
  assert.equal(cuerpo.length, 3)
  for (const l of cuerpo) assert.equal(l.length, ANCHO_DIARIO)

  const [cliente, ventas, iva] = cuerpo.map((l) => trocear(l, LAYOUT_DIARIO))

  // Apunte del cliente (430x al Debe por el total)
  assert.equal(cliente.Asien, '000001')
  assert.equal(cliente.Fecha, '20260115')
  assert.match(cliente.Subcta, /^430\d{6} {3}$/)
  assert.equal(cliente.Concepto, 'Fra. F-2026-000001       ')
  assert.equal(cliente.Documento, '026-000001') // últimos 10 caracteres del número
  assert.equal(cliente.EuroDebe, '0000000001210.00')
  assert.equal(cliente.EuroHaber, '0000000000000.00')
  assert.equal(cliente.Rectifica, ' ')
  assert.equal(cliente.TipoFac, 'E')
  assert.equal(cliente.Reservado4, ' '.repeat(28))
  assert.equal(cliente.Reservado15, ' '.repeat(529))

  // Ventas al Haber por la base
  assert.equal(ventas.Subcta, '705000000   ')
  assert.equal(ventas.EuroDebe, '0000000000000.00')
  assert.equal(ventas.EuroHaber, '0000000001000.00')

  // IVA repercutido al Haber por la cuota, subcuenta por tipo
  assert.equal(iva.Subcta, '477000021   ')
  assert.equal(iva.EuroHaber, '0000000000210.00')
})

test('venta con retención IRPF: 4 apuntes y cuadre Debe = Haber', () => {
  const r = construirExportClassicConta([
    factura({ base: 1000, cuotaIva: 210, retencionIrpf: 150, totalFactura: 1060 }),
  ])
  assert.equal(r.apuntes.length, 4)
  assert.equal(r.avisos.length, 0)
  const debe = r.apuntes.reduce((s, a) => s + a.debeCent, 0)
  const haber = r.apuntes.reduce((s, a) => s + a.haberCent, 0)
  assert.equal(debe, haber)
  const irpf = r.apuntes.find((a) => a.subcuenta === '473000000')
  assert.equal(irpf.debeCent, 15000)
  const cliente = r.apuntes.find((a) => a.subcuenta.startsWith('430'))
  assert.equal(cliente.debeCent, 106000)
})

test('factura exenta (IVA 0): sin apunte 477 y asiento cuadrado', () => {
  const r = construirExportClassicConta([
    factura({ cuotaIva: 0, tipoIva: 0, totalFactura: 1000 }),
  ])
  assert.equal(r.apuntes.length, 2)
  assert.ok(!r.apuntes.some((a) => a.subcuenta.startsWith('477')))
  assert.equal(r.apuntes[0].debeCent, 100000)
  assert.equal(r.apuntes[1].haberCent, 100000)
})

test('rectificativa: Rectifica=T e importes negativos tal cual', () => {
  const r = construirExportClassicConta([
    factura({
      numero: 'R-2026-000001',
      base: -1000,
      cuotaIva: -210,
      totalFactura: -1210,
      rectificativa: true,
    }),
  ])
  const lineas = r.diarioTxt.split(EOL).slice(0, -1)
  for (const l of lineas) {
    assert.equal(l.length, ANCHO_DIARIO)
    assert.equal(trocear(l, LAYOUT_DIARIO).Rectifica, 'T')
  }
  const cliente = trocear(lineas[0], LAYOUT_DIARIO)
  assert.equal(cliente.EuroDebe, '-000000001210.00')
})

test('total almacenado incoherente: aviso, y el asiento usa el importe derivado', () => {
  const r = construirExportClassicConta([factura({ totalFactura: 1300 })])
  assert.equal(r.avisos.length, 1)
  assert.match(r.avisos[0], /F-2026-000001/)
  const cliente = r.apuntes.find((a) => a.subcuenta.startsWith('430'))
  assert.equal(cliente.debeCent, 121000) // derivado (cuadra), no el almacenado
  assert.match(r.leemeTxt, /AVISOS/)
})

test('numeración de asientos correlativa desde asientoInicial y orden por fecha', () => {
  const r = construirExportClassicConta(
    [
      factura({ numero: 'F-2026-000002', fecha: '2026-02-01' }),
      factura({ numero: 'F-2026-000001', fecha: '2026-01-10' }),
    ],
    { asientoInicial: 100 }
  )
  const asientos = [...new Set(r.apuntes.map((a) => a.asien))]
  assert.deepEqual(asientos, [100, 101])
  const primero = r.apuntes.find((a) => a.asien === 100)
  assert.equal(primero.fecha, '2026-01-10')
})

test('sin facturas o parámetros inválidos: error tipado', () => {
  assert.throws(() => construirExportClassicConta([]), (e) => e.codigo === 'sin_facturas')
  assert.throws(
    () => construirExportClassicConta([factura()], { digitos: 4 }),
    (e) => e.codigo === 'digitos_invalidos'
  )
  assert.throws(
    () => construirExportClassicConta([factura()], { asientoInicial: 0 }),
    (e) => e.codigo === 'asiento_invalido'
  )
})

// ---------------------------------------------------------------------------
// Fichero de subcuentas: posiciones exactas
// ---------------------------------------------------------------------------

test('subcuentas: líneas de 444, cliente con NIF/IdNif/CodPais y títulos de IVA', () => {
  const r = construirExportClassicConta([
    factura(),
    factura({ numero: 'F-2026-000002', tipoIva: 10, cuotaIva: 100, totalFactura: 1100 }),
    factura({ numero: 'F-2026-000003', retencionIrpf: 150, totalFactura: 1060 }),
  ])
  const lineas = r.subcuentasTxt.split(EOL)
  assert.equal(lineas.at(-1), '')
  const cuerpo = lineas.slice(0, -1)
  for (const l of cuerpo) assert.equal(l.length, ANCHO_SUBCUENTAS)

  // 1 cliente + ventas + 2 tipos de IVA + retenciones
  assert.equal(cuerpo.length, 5)
  const campos = cuerpo.map((l) => trocear(l, LAYOUT_SUBCUENTAS))

  const cliente = campos.find((c) => c.Cod.startsWith('430'))
  assert.equal(cliente.Titulo, 'Acme Consulting S.L.'.padEnd(40, ' '))
  assert.equal(cliente.NIF, 'B12345674      ')
  assert.equal(cliente.IdNif, '1')
  assert.equal(cliente.CodPais, 'ES')
  assert.equal(cliente.Domicilio, 'C/ Mayor 1, Valencia'.padEnd(35, ' '))
  assert.equal(cliente.Email, 'admin@acme.es'.padEnd(50, ' '))
  // Como en el fichero real importado con éxito: TPC/RecEquiv/nIRPF a ceros
  assert.equal(cliente.TPC, '00000')
  assert.equal(cliente.RecEquiv, '00000')
  assert.equal(cliente.nIRPF, '00000')

  const iva21 = campos.find((c) => c.Cod.startsWith('477000021'))
  assert.equal(iva21.Titulo.trimEnd(), 'HP IVA REPERCUTIDO 21%')
  const iva10 = campos.find((c) => c.Cod.startsWith('477000010'))
  assert.equal(iva10.Titulo.trimEnd(), 'HP IVA REPERCUTIDO 10%')
  const ventas = campos.find((c) => c.Cod.startsWith('705'))
  assert.equal(ventas.Titulo.trimEnd(), 'Prestaciones de servicios')
  assert.equal(ventas.IdNif, '0')
  const ret = campos.find((c) => c.Cod.startsWith('473'))
  assert.equal(ret.Titulo.trimEnd(), 'HP Retenciones y pagos a cuenta')
})

test('mismo cliente en varias facturas: una sola subcuenta y mismo código', () => {
  const r = construirExportClassicConta([
    factura(),
    factura({ numero: 'F-2026-000002' }),
  ])
  const clientes = r.subcuentas.filter((s) => s.codigo.startsWith('430'))
  assert.equal(clientes.length, 1)
  const apuntesCliente = r.apuntes.filter((a) => a.subcuenta.startsWith('430'))
  assert.equal(new Set(apuntesCliente.map((a) => a.subcuenta)).size, 1)
})

// ---------------------------------------------------------------------------
// Codificación ANSI y ZIP
// ---------------------------------------------------------------------------

test('bytesAnsi: ñ y tildes como un byte latin1/ANSI', () => {
  const bytes = bytesAnsi(aAnsi('Señor Peña'))
  assert.equal(bytes.length, 'Señor Peña'.length)
  assert.equal(bytes[2], 0xf1) // ñ
})

test('ZIP: contiene los 3 ficheros y el diario decodifica con líneas de 869', async () => {
  const r = construirExportClassicConta([
    factura({ clienteNombre: 'Diseño Ibáñez… 100€ S.L.' }),
  ])
  const zipBytes = await zipExportClassicConta(r)
  const zip = await JSZip.loadAsync(zipBytes)
  assert.deepEqual(Object.keys(zip.files).sort(), [FICHERO_DIARIO, FICHERO_LEEME, FICHERO_SUBCUENTAS].sort())

  const diario = Buffer.from(await zip.file(FICHERO_DIARIO).async('uint8array')).toString('latin1')
  assert.equal(diario, r.diarioTxt)
  for (const l of diario.split(EOL).slice(0, -1)) assert.equal(l.length, ANCHO_DIARIO)

  const subcuentas = Buffer.from(await zip.file(FICHERO_SUBCUENTAS).async('uint8array')).toString('latin1')
  // Transliteración aplicada y bytes ANSI de una sola posición por carácter
  assert.match(subcuentas, /Diseño Ibáñez\.\.\. 100EUR S\.L\./)
  for (const l of subcuentas.split(EOL).slice(0, -1)) assert.equal(l.length, ANCHO_SUBCUENTAS)

  const leeme = Buffer.from(await zip.file(FICHERO_LEEME).async('uint8array')).toString('latin1')
  assert.match(leeme, /Importador de Asientos/)
  assert.match(leeme, /PRIMERO el fichero de subcuentas/)
})
