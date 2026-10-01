// Tests V05: generador del XML del registro de alta (RegistroAlta) validado
// contra los XSD OFICIALES de la AEAT (docs/verifactu/xsd/, descargados de la
// sede). Ejecutar con: npm test  (node --test, sin transpilación).

import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import {
  construirRegistroAlta,
  xmlRegFactuSistemaFacturacion,
  sistemaInformaticoKuentas,
  esNifValido,
  escaparXml,
  ErrorValidacionRegistro,
} from '../registro-alta.ts'
import { facturaAppARegistroAlta, descripcionDesdeItems } from '../factura-app.ts'
import { huellaAlta, verificarCadena, esHuellaValida } from '../huella.ts'
import { validarRegistroXsd, validarEnvioXsd } from './helpers/xsd-validator.mjs'

// ---------------------------------------------------------------------------
// Datos base reutilizados
// ---------------------------------------------------------------------------

const EMISOR = { nif: 'B98407901', nombreRazon: 'Mercadonet Global S.L.' }
const SIF = sistemaInformaticoKuentas('KU-test-0001')
const CUANDO = new Date('2026-09-12T10:00:00+02:00')

/** Factura F1 nacional mínima y correcta (una línea al 21 %). */
function facturaBase(extra = {}) {
  return {
    emisor: EMISOR,
    numSerieFactura: 'F-2026-000123',
    fechaExpedicion: '2026-09-12',
    tipoFactura: 'F1',
    descripcionOperacion: 'Desarrollo web y mantenimiento mensual',
    destinatarios: [{ nombreRazon: 'Cliente Ejemplo S.L.', nif: 'A58818501' }],
    desglose: [
      {
        claveRegimen: '01',
        calificacionOperacion: 'S1',
        tipoImpositivo: 21,
        baseImponible: 1000,
        cuotaRepercutida: 210,
      },
    ],
    ...extra,
  }
}

function generar(entrada, opciones = {}) {
  return construirRegistroAlta(entrada, {
    encadenamiento: { primerRegistro: true },
    sistemaInformatico: SIF,
    fechaGeneracion: CUANDO,
    ...opciones,
  })
}

async function assertXsdValido(xml) {
  const r = await validarRegistroXsd(xml)
  assert.ok(r.valida, `XML no válido contra el XSD oficial:\n${r.errores.join('\n')}\n---\n${xml}`)
}

function assertErrores(fn, ...fragmentos) {
  let capturado = null
  try {
    fn()
  } catch (err) {
    capturado = err
  }
  assert.ok(capturado instanceof ErrorValidacionRegistro, 'esperaba ErrorValidacionRegistro')
  for (const fragmento of fragmentos) {
    assert.ok(
      capturado.errores.some((e) => e.includes(fragmento)),
      `esperaba un error que contenga «${fragmento}»; errores:\n - ${capturado.errores.join('\n - ')}`
    )
  }
  return capturado
}

// ---------------------------------------------------------------------------
// Caso general F1 nacional
// ---------------------------------------------------------------------------

test('F1 nacional al 21 %: XML válido contra XSD, totales y huella correctos', async () => {
  const r = generar(facturaBase())
  assert.equal(r.cuotaTotal, '210.00')
  assert.equal(r.importeTotal, '1210.00')
  assert.equal(r.fechaExpedicionFactura, '12-09-2026')
  assert.equal(r.fechaHoraHusoGenRegistro, '2026-09-12T10:00:00+02:00')
  assert.equal(r.tipoHuella, '01')
  assert.ok(esHuellaValida(r.huella))
  // La huella es reproducible desde los mismos datos que van en el XML.
  assert.equal(r.huella, huellaAlta(r.datosHuella, null))
  assert.ok(r.xml.includes(`<sf:Huella>${r.huella}</sf:Huella>`))
  assert.ok(r.xml.includes('<sf:PrimerRegistro>S</sf:PrimerRegistro>'))
  assert.ok(r.xml.includes('<sf:IDEmisorFactura>B98407901</sf:IDEmisorFactura>'))
  assert.ok(r.xml.includes('<sf:TipoImpositivo>21.00</sf:TipoImpositivo>'))
  await assertXsdValido(r.xml)
})

test('la cadena de entrada de la huella sigue el orden oficial del doc. AEAT', () => {
  const r = generar(facturaBase())
  assert.equal(
    r.cadenaHuella,
    'IDEmisorFactura=B98407901&NumSerieFactura=F-2026-000123&FechaExpedicionFactura=12-09-2026' +
      '&TipoFactura=F1&CuotaTotal=210.00&ImporteTotal=1210.00&Huella=' +
      '&FechaHoraHusoGenRegistro=2026-09-12T10:00:00+02:00'
  )
})

// ---------------------------------------------------------------------------
// Todos los tipos de IVA (multilínea) y regímenes
// ---------------------------------------------------------------------------

test('desglose multi-tipo 21/10/4/0: totales agregados y XSD válido', async () => {
  const r = generar(
    facturaBase({
      desglose: [
        { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 100, cuotaRepercutida: 21 },
        { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 10, baseImponible: 200, cuotaRepercutida: 20 },
        { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 4, baseImponible: 300, cuotaRepercutida: 12 },
        { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 0, baseImponible: 400, cuotaRepercutida: 0 },
      ],
    })
  )
  assert.equal(r.cuotaTotal, '53.00')
  assert.equal(r.importeTotal, '1053.00')
  await assertXsdValido(r.xml)
})

test('recargo de equivalencia (régimen 18): tipo+cuota y suma en totales', async () => {
  const r = generar(
    facturaBase({
      desglose: [
        {
          claveRegimen: '18',
          calificacionOperacion: 'S1',
          tipoImpositivo: 21,
          baseImponible: 100,
          cuotaRepercutida: 21,
          tipoRecargoEquivalencia: 5.2,
          cuotaRecargoEquivalencia: 5.2,
        },
      ],
    })
  )
  assert.equal(r.cuotaTotal, '26.20')
  assert.equal(r.importeTotal, '126.20')
  assert.ok(r.xml.includes('<sf:TipoRecargoEquivalencia>5.20</sf:TipoRecargoEquivalencia>'))
  await assertXsdValido(r.xml)
})

test('operación exenta E1 (art. 20 LIVA): sin tipo ni cuota, CuotaTotal 0', async () => {
  const r = generar(
    facturaBase({
      desglose: [{ claveRegimen: '01', operacionExenta: 'E1', baseImponible: 500 }],
    })
  )
  assert.equal(r.cuotaTotal, '0.00')
  assert.equal(r.importeTotal, '500.00')
  assert.ok(r.xml.includes('<sf:OperacionExenta>E1</sf:OperacionExenta>'))
  assert.ok(!r.xml.includes('TipoImpositivo'))
  await assertXsdValido(r.xml)
})

test('exención E7/E8 (añadidas al XSD tras la Orden) también validan', async () => {
  const r = generar(
    facturaBase({
      desglose: [{ claveRegimen: '01', operacionExenta: 'E7', baseImponible: 100 }],
    })
  )
  await assertXsdValido(r.xml)
})

test('exportación exenta E2 con régimen 02 y destinatario extranjero', async () => {
  const r = generar(
    facturaBase({
      destinatarios: [{ nombreRazon: 'Overseas Corp.', codigoPais: 'US', idType: '04', id: 'US-TAX-99887' }],
      desglose: [{ claveRegimen: '02', operacionExenta: 'E2', baseImponible: 2500 }],
    })
  )
  assert.ok(r.xml.includes('<sf:CodigoPais>US</sf:CodigoPais>'))
  assert.ok(r.xml.includes('<sf:IDType>04</sf:IDType>'))
  await assertXsdValido(r.xml)
})

test('S2 (inversión del sujeto pasivo): sin tipo ni cuota', async () => {
  const r = generar(
    facturaBase({
      desglose: [{ claveRegimen: '01', calificacionOperacion: 'S2', baseImponible: 800 }],
    })
  )
  assert.equal(r.cuotaTotal, '0.00')
  assert.equal(r.importeTotal, '800.00')
  await assertXsdValido(r.xml)
})

test('operación no sujeta N2 (reglas de localización) con destinatario UE por NIF-IVA', async () => {
  const r = generar(
    facturaBase({
      destinatarios: [{ nombreRazon: 'GmbH Beispiel', codigoPais: 'DE', idType: '02', id: 'DE811128135' }],
      desglose: [{ claveRegimen: '01', calificacionOperacion: 'N2', baseImponible: 1500 }],
    })
  )
  assert.ok(r.xml.includes('<sf:CalificacionOperacion>N2</sf:CalificacionOperacion>'))
  await assertXsdValido(r.xml)
})

test('destinatario UE con idType=02 puede omitir CodigoPais (el NIF-IVA ya lo lleva)', async () => {
  const r = generar(
    facturaBase({
      destinatarios: [{ nombreRazon: 'SARL Exemple', idType: '02', id: 'FR12345678901' }],
    })
  )
  assert.ok(!r.xml.includes('CodigoPais'))
  await assertXsdValido(r.xml)
})

test('destinatario extranjero por pasaporte (idType=03)', async () => {
  const r = generar(
    facturaBase({
      destinatarios: [{ nombreRazon: 'John Doe', codigoPais: 'GB', idType: '03', id: 'P123456789' }],
    })
  )
  await assertXsdValido(r.xml)
})

// ---------------------------------------------------------------------------
// Simplificadas y rectificativas
// ---------------------------------------------------------------------------

test('F2 simplificada sin destinatarios', async () => {
  const r = generar(facturaBase({ tipoFactura: 'F2', destinatarios: undefined }))
  assert.ok(!r.xml.includes('Destinatarios'))
  await assertXsdValido(r.xml)
})

test('rectificativa R1 por sustitución: FacturasRectificadas + ImporteRectificacion', async () => {
  const r = generar(
    facturaBase({
      tipoFactura: 'R1',
      numSerieFactura: 'R-2026-000004',
      tipoRectificativa: 'S',
      facturasRectificadas: [{ numSerieFactura: 'F-2026-000100', fechaExpedicion: '2026-08-01' }],
      importeRectificacion: { baseRectificada: 1000, cuotaRectificada: 210 },
    })
  )
  assert.ok(r.xml.includes('<sf:TipoRectificativa>S</sf:TipoRectificativa>'))
  // El NIF de la rectificada se toma del emisor si no se indica (nota del XSD).
  assert.ok(r.xml.includes('<sf:IDFacturaRectificada>'))
  assert.ok(r.xml.includes('<sf:FechaExpedicionFactura>01-08-2026</sf:FechaExpedicionFactura>'))
  assert.ok(r.xml.includes('<sf:BaseRectificada>1000.00</sf:BaseRectificada>'))
  await assertXsdValido(r.xml)
})

test('rectificativa R4 por diferencias con importes NEGATIVOS (abono)', async () => {
  const r = generar(
    facturaBase({
      tipoFactura: 'R4',
      numSerieFactura: 'R-2026-000005',
      tipoRectificativa: 'I',
      facturasRectificadas: [{ numSerieFactura: 'F-2026-000101', fechaExpedicion: '2026-07-15' }],
      desglose: [
        { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: -250, cuotaRepercutida: -52.5 },
      ],
    })
  )
  assert.equal(r.cuotaTotal, '-52.50')
  assert.equal(r.importeTotal, '-302.50')
  assert.ok(r.xml.includes('<sf:BaseImponibleOimporteNoSujeto>-250.00</sf:BaseImponibleOimporteNoSujeto>'))
  await assertXsdValido(r.xml)
})

test('F3 sustitutiva de simplificadas: FacturasSustituidas', async () => {
  const r = generar(
    facturaBase({
      tipoFactura: 'F3',
      facturasSustituidas: [
        { numSerieFactura: 'T-2026-0001', fechaExpedicion: '2026-06-01' },
        { numSerieFactura: 'T-2026-0002', fechaExpedicion: '2026-06-02' },
      ],
    })
  )
  assert.ok(r.xml.includes('<sf:FacturasSustituidas>'))
  await assertXsdValido(r.xml)
})

test('R5 (rectificativa de simplificada) puede ir sin destinatarios', async () => {
  const r = generar(
    facturaBase({
      tipoFactura: 'R5',
      destinatarios: undefined,
      tipoRectificativa: 'I',
      facturasRectificadas: [{ numSerieFactura: 'S-2026-0009', fechaExpedicion: '2026-05-01' }],
    })
  )
  await assertXsdValido(r.xml)
})

// ---------------------------------------------------------------------------
// Casos borde
// ---------------------------------------------------------------------------

test('12 líneas de desglose (máximo del XSD) validan; texto multilínea intacto', async () => {
  const desglose = Array.from({ length: 12 }, (_, i) => ({
    claveRegimen: '01',
    calificacionOperacion: 'S1',
    tipoImpositivo: 21,
    baseImponible: 10 + i,
    cuotaRepercutida: Math.round((10 + i) * 21) / 100,
  }))
  const r = generar(
    facturaBase({
      desglose,
      descripcionOperacion: 'Línea 1 de la descripción\nLínea 2 con detalle\nLínea 3 final',
    })
  )
  assert.equal((r.xml.match(/<sf:DetalleDesglose>/g) ?? []).length, 12)
  assert.ok(r.xml.includes('Línea 2 con detalle\nLínea 3 final'))
  await assertXsdValido(r.xml)
})

test('caracteres especiales XML y acentos se escapan y validan', async () => {
  const r = generar(
    facturaBase({
      descripcionOperacion: `Diseño <web> & "SEO" con 'ñ' y € — 50% <script>`,
      destinatarios: [{ nombreRazon: 'Müller & Söhne <GmbH>', codigoPais: 'DE', idType: '02', id: 'DE129273398' }],
    })
  )
  assert.ok(r.xml.includes('Diseño &lt;web&gt; &amp; &quot;SEO&quot;'))
  assert.ok(r.xml.includes('Müller &amp; Söhne &lt;GmbH&gt;'))
  await assertXsdValido(r.xml)
})

test('importe total en el umbral de Macrodato (≥ 100 M€) marca Macrodato=S', async () => {
  const r = generar(
    facturaBase({
      desglose: [
        { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 100_000_000, cuotaRepercutida: 21_000_000 },
      ],
    })
  )
  assert.equal(r.importeTotal, '121000000.00')
  assert.ok(r.xml.includes('<sf:Macrodato>S</sf:Macrodato>'))
  await assertXsdValido(r.xml)
})

test('redondeos: base 33.33 al 21 % admite cuota 7.00 (redondeo por línea)', () => {
  const r = generar(
    facturaBase({
      desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 33.33, cuotaRepercutida: 7 }],
    })
  )
  assert.equal(r.importeTotal, '40.33')
})

// ---------------------------------------------------------------------------
// Encadenamiento
// ---------------------------------------------------------------------------

test('segundo registro encadena con el primero y verificarCadena da por buena la cadena', async () => {
  const r1 = generar(facturaBase())
  const r2 = construirRegistroAlta(
    facturaBase({ numSerieFactura: 'F-2026-000124', fechaExpedicion: '2026-09-13' }),
    {
      encadenamiento: {
        registroAnterior: {
          idEmisorFactura: r1.idEmisorFactura,
          numSerieFactura: r1.numSerieFactura,
          fechaExpedicion: r1.fechaExpedicionFactura,
          huella: r1.huella,
        },
      },
      sistemaInformatico: SIF,
      fechaGeneracion: new Date('2026-09-13T09:30:00+02:00'),
    }
  )
  assert.ok(r2.xml.includes(`<sf:Huella>${r1.huella}</sf:Huella>`))
  assert.ok(r2.xml.includes('<sf:RegistroAnterior>'))
  const resultado = verificarCadena([
    { tipo: 'alta', primerRegistro: true, huellaAnterior: null, huella: r1.huella, datos: r1.datosHuella },
    { tipo: 'alta', primerRegistro: false, huellaAnterior: r1.huella, huella: r2.huella, datos: r2.datosHuella },
  ])
  assert.ok(resultado.valida, JSON.stringify(resultado.errores))
  assert.equal(resultado.ultimaHuella, r2.huella)
  await assertXsdValido(r2.xml)
})

// ---------------------------------------------------------------------------
// Envoltura de remisión RegFactuSistemaFacturacion (SuministroLR.xsd)
// ---------------------------------------------------------------------------

test('mensaje de envío con 2 registros valida contra SuministroLR.xsd', async () => {
  const r1 = generar(facturaBase())
  const r2 = generar(facturaBase({ numSerieFactura: 'F-2026-000124' }))
  const envio = xmlRegFactuSistemaFacturacion(
    { obligadoEmision: { nombreRazon: EMISOR.nombreRazon, nif: EMISOR.nif } },
    [r1.xml, r2.xml]
  )
  const res = await validarEnvioXsd(envio)
  assert.ok(res.valida, res.errores.join('\n'))
})

test('envío con incidencia (art. 16 Orden) valida contra SuministroLR.xsd', async () => {
  const r1 = generar(facturaBase())
  const envio = xmlRegFactuSistemaFacturacion(
    { obligadoEmision: { nombreRazon: EMISOR.nombreRazon, nif: EMISOR.nif }, incidencia: 'S' },
    [r1.xml]
  )
  const res = await validarEnvioXsd(envio)
  assert.ok(res.valida, res.errores.join('\n'))
})

test('envío sin registros o con más de 1000 se rechaza', () => {
  const cab = { obligadoEmision: { nombreRazon: EMISOR.nombreRazon, nif: EMISOR.nif } }
  assert.throws(() => xmlRegFactuSistemaFacturacion(cab, []), /1 a 1000/)
  assert.throws(() => xmlRegFactuSistemaFacturacion(cab, Array(1001).fill('<x/>')), /1 a 1000/)
})

// ---------------------------------------------------------------------------
// Validaciones que deben RECHAZAR la factura
// ---------------------------------------------------------------------------

test('acumula TODOS los errores: NIF malo, serie con espacios, S1 sin tipo, descripción larga', () => {
  const err = assertErrores(
    () =>
      generar(
        facturaBase({
          emisor: { nif: 'B98407902', nombreRazon: EMISOR.nombreRazon }, // dígito de control incorrecto
          numSerieFactura: 'F-2026-000123 ',
          descripcionOperacion: 'x'.repeat(501),
          desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', baseImponible: 100 }],
        })
      ),
    'emisor.nif',
    'numSerieFactura',
    'tipoImpositivo: obligatorio',
    'cuotaRepercutida: obligatoria',
    'descripcionOperacion'
  )
  assert.ok(err.errores.length >= 5)
})

test('cuota que no cuadra con base×tipo más allá de ±10 € se rechaza', () => {
  assertErrores(
    () =>
      generar(
        facturaBase({
          desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 1000, cuotaRepercutida: 250 }],
        })
      ),
    'no cuadra con base×tipo'
  )
})

test('los totales declarados por la app deben cuadrar con los recalculados (R3 de V01)', () => {
  assertErrores(
    () => generar(facturaBase({ importeTotalDeclarado: 1060 })), // 1210 − IRPF: NO es el ImporteTotal
    'importeTotalDeclarado'
  )
  // Con los totales correctos no lanza.
  generar(facturaBase({ cuotaTotalDeclarada: 210, importeTotalDeclarado: 1210 }))
})

test('reglas de exclusión: exenta con cuota, calificación+exención, 13 líneas, F1 sin destinatario', () => {
  assertErrores(
    () => generar(facturaBase({ desglose: [{ claveRegimen: '01', operacionExenta: 'E1', baseImponible: 100, cuotaRepercutida: 21 }] })),
    'cuotaRepercutida: no admisible'
  )
  assertErrores(
    () =>
      generar(
        facturaBase({
          desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', operacionExenta: 'E1', tipoImpositivo: 21, baseImponible: 100, cuotaRepercutida: 21 }],
        })
      ),
    'exactamente una'
  )
  assertErrores(
    () =>
      generar(
        facturaBase({
          desglose: Array.from({ length: 13 }, () => ({ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 10, cuotaRepercutida: 2.1 })),
        })
      ),
    'máximo 12 líneas'
  )
  assertErrores(() => generar(facturaBase({ destinatarios: [] })), 'destinatarios: obligatorios')
})

test('reglas de rectificativas: R sin tipoRectificativa, F1 con restos de rectificativa', () => {
  assertErrores(
    () => generar(facturaBase({ tipoFactura: 'R1' })),
    'tipoRectificativa: obligatorio'
  )
  assertErrores(
    () => generar(facturaBase({ tipoRectificativa: 'S' })),
    'tipoRectificativa: solo admisible'
  )
  assertErrores(
    () => generar(facturaBase({ facturasSustituidas: [{ numSerieFactura: 'X-1', fechaExpedicion: '2026-01-01' }] })),
    'facturasSustituidas: solo admisible'
  )
  assertErrores(
    () =>
      generar(
        facturaBase({
          tipoFactura: 'R1',
          tipoRectificativa: 'I',
          importeRectificacion: { baseRectificada: 100, cuotaRectificada: 21 },
        })
      ),
    'importeRectificacion: solo admisible'
  )
})

test('destinatarios: ES por IDOtro prohibido (salvo 07), país fuera de lista, NIF extranjero', () => {
  assertErrores(
    () => generar(facturaBase({ destinatarios: [{ nombreRazon: 'X', codigoPais: 'ES', idType: '02', id: 'ESB98407901' }] })),
    'use el campo NIF'
  )
  assertErrores(
    () => generar(facturaBase({ destinatarios: [{ nombreRazon: 'X', codigoPais: 'ZZ', idType: '03', id: 'P-1' }] })),
    'fuera de la lista CountryType2'
  )
  assertErrores(
    () => generar(facturaBase({ destinatarios: [{ nombreRazon: 'X', nif: '12345678A' }] })),
    'NIF español inválido'
  )
})

test('rechazoPrevio solo con subsanacion=S; encadenamiento con huella corrupta se rechaza', () => {
  assertErrores(() => generar(facturaBase({ rechazoPrevio: 'S' })), 'rechazoPrevio')
  generar(facturaBase({ subsanacion: 'S', rechazoPrevio: 'S' })) // combinación válida
  assertErrores(
    () =>
      construirRegistroAlta(facturaBase(), {
        encadenamiento: {
          registroAnterior: { idEmisorFactura: EMISOR.nif, numSerieFactura: 'F-1', fechaExpedicion: '2026-01-01', huella: 'abc' },
        },
        sistemaInformatico: SIF,
        fechaGeneracion: CUANDO,
      }),
    '64 hexadecimales'
  )
})

test('fechas imposibles (31-02) y formatos desconocidos se rechazan', () => {
  assertErrores(() => generar(facturaBase({ fechaExpedicion: '2026-02-31' })), 'fecha inexistente')
  assertErrores(() => generar(facturaBase({ fechaExpedicion: '12/09/2026' })), 'fecha no reconocida')
})

// ---------------------------------------------------------------------------
// Validación de NIF (D-09)
// ---------------------------------------------------------------------------

test('esNifValido: DNI, NIE, CIF y dígitos de control incorrectos', () => {
  assert.ok(esNifValido('12345678Z')) // DNI
  assert.ok(esNifValido('89890001K')) // DNI del ejemplo oficial AEAT
  assert.ok(esNifValido('X2482300W')) // NIE
  assert.ok(esNifValido('B98407901')) // CIF Mercadonet
  assert.ok(esNifValido('A58818501')) // CIF con control numérico
  assert.ok(!esNifValido('12345678A')) // letra DNI mala
  assert.ok(!esNifValido('B98407902')) // control CIF malo
  assert.ok(!esNifValido('X2482300A')) // letra NIE mala
  assert.ok(!esNifValido('1234567Z')) // longitud
  assert.ok(!esNifValido(''))
})

test('escaparXml cubre los cinco caracteres reservados', () => {
  assert.equal(escaparXml(`<a b="c">&'</a>`), '&lt;a b=&quot;c&quot;&gt;&amp;&apos;&lt;/a&gt;')
})

// ---------------------------------------------------------------------------
// Adaptador desde la factura de cuentas-app
// ---------------------------------------------------------------------------

const FACTURA_APP = {
  invoice_number: 'F-2026-000200',
  date: '2026-09-12',
  client_name: 'Cliente Ejemplo S.L.',
  client_nif: 'A58818501',
  items: [
    { description: 'Diseño web', quantity: 1, unitPrice: 600, total: 600 },
    { description: 'Mantenimiento septiembre', quantity: 4, unitPrice: 100, total: 400 },
  ],
  subtotal: 1000,
  iva: 210,
  iva_rate: 21,
  irpf: 150,
  irpf_rate: 15,
  total: 1060, // subtotal + IVA − IRPF: total a pagar de la app
}

test('factura de la app con IRPF: ImporteTotal = base + IVA (la retención NO minora)', async () => {
  const entrada = facturaAppARegistroAlta(FACTURA_APP, EMISOR)
  const r = generar(entrada)
  assert.equal(r.tipoFactura, 'F1')
  assert.equal(r.importeTotal, '1210.00') // no 1060.00
  assert.equal(r.cuotaTotal, '210.00')
  assert.ok(r.xml.includes('Diseño web; Mantenimiento septiembre'))
  assert.ok(r.xml.includes('<sf:NIF>A58818501</sf:NIF>'))
  await assertXsdValido(r.xml)
})

test('factura de la app sin cliente identificado → F2 simplificada', async () => {
  const entrada = facturaAppARegistroAlta({ ...FACTURA_APP, client_nif: null, client_name: null }, EMISOR)
  assert.equal(entrada.tipoFactura, 'F2')
  const r = generar(entrada)
  await assertXsdValido(r.xml)
})

test('factura de la app exenta (E1) con iva_rate 0', async () => {
  const entrada = facturaAppARegistroAlta(
    { ...FACTURA_APP, iva: 0, iva_rate: 0, irpf: 0, total: 1000 },
    EMISOR,
    { operacionExenta: 'E1' }
  )
  const r = generar(entrada)
  assert.equal(r.cuotaTotal, '0.00')
  assert.equal(r.importeTotal, '1000.00')
  await assertXsdValido(r.xml)
})

test('exenta declarada con iva_rate ≠ 0 se rechaza en el adaptador', () => {
  assert.throws(() => facturaAppARegistroAlta(FACTURA_APP, EMISOR, { operacionExenta: 'E1' }), /exenta/)
})

test('si la app manda un IVA que no cuadra, la emisión falla (R3 de V01)', () => {
  const entrada = facturaAppARegistroAlta({ ...FACTURA_APP, iva: 300 }, EMISOR)
  assertErrores(() => generar(entrada), 'no cuadra con base×tipo')
})

test('descripcionDesdeItems: vacía → texto por defecto; >500 → truncada', () => {
  assert.equal(descripcionDesdeItems([]), 'Prestación de servicios / entrega de bienes')
  const larga = descripcionDesdeItems([{ description: 'x'.repeat(600), quantity: 1, unitPrice: 1, total: 1 }])
  assert.equal(larga.length, 500)
})
