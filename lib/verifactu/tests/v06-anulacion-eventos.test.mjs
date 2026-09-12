// Tests V06: generadores del registro de ANULACIÓN (RegistroAnulacion) y del
// registro de EVENTO (RegistroEvento), validados contra los XSD OFICIALES de
// la AEAT (docs/verifactu/xsd/). Ejecutar con: npm test  (node --test).

import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import {
  construirRegistroAlta,
  xmlRegFactuSistemaFacturacion,
  sistemaInformaticoKuentas,
  ErrorValidacionRegistro,
} from '../registro-alta.ts'
import { construirRegistroAnulacion } from '../registro-anulacion.ts'
import { construirRegistroEvento, verificarCadenaEventos } from '../registro-evento.ts'
import { facturaAppARegistroAnulacion } from '../factura-app.ts'
import { huellaAnulacion, huellaEvento, verificarCadena, esHuellaValida } from '../huella.ts'
import { validarRegistroXsd, validarEnvioXsd, validarEventoXsd } from './helpers/xsd-validator.mjs'

// ---------------------------------------------------------------------------
// Datos base reutilizados
// ---------------------------------------------------------------------------

const EMISOR = { nif: 'B98407901', nombreRazon: 'Mercadonet Global S.L.' }
const SIF = sistemaInformaticoKuentas('KU-test-0001')
const CUANDO = new Date('2026-09-12T10:00:00+02:00')

/** Anulación mínima y correcta de una factura propia. */
function anulacionBase(extra = {}) {
  return {
    emisor: { nif: EMISOR.nif },
    numSerieFacturaAnulada: 'F-2026-000123',
    fechaExpedicionFacturaAnulada: '2026-09-12',
    ...extra,
  }
}

function generarAnulacion(entrada, opciones = {}) {
  return construirRegistroAnulacion(entrada, {
    encadenamiento: { primerRegistro: true },
    sistemaInformatico: SIF,
    fechaGeneracion: CUANDO,
    ...opciones,
  })
}

/** Evento mínimo y correcto (tipo 01: inicio como NO VERI*FACTU). */
function eventoBase(extra = {}) {
  return {
    obligadoEmision: { nombreRazon: 'Cliente Ejemplo S.L.', nif: 'A58818501' },
    tipoEvento: '01',
    ...extra,
  }
}

function generarEvento(entrada, opciones = {}) {
  return construirRegistroEvento(entrada, {
    encadenamiento: { primerEvento: true },
    sistemaInformatico: SIF,
    fechaGeneracion: CUANDO,
    ...opciones,
  })
}

// Firma de PRUEBA estructuralmente válida contra el esquema xmldsig de W3C.
// SOLO para poder validar el resto del documento contra EventosSIF.xsd en los
// tests (el XSD exige ds:Signature): la firma XAdES real es de V14 y el
// generador NUNCA la inventa (sin firmaXmlDs el XML sale sin firma).
const FIRMA_TEST = `<ds:Signature>
  <ds:SignedInfo>
    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    <ds:Reference URI="">
      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <ds:DigestValue>Zmlyc2EtZGUtcHJ1ZWJh</ds:DigestValue>
    </ds:Reference>
  </ds:SignedInfo>
  <ds:SignatureValue>Zmlyc2EtZGUtcHJ1ZWJh</ds:SignatureValue>
</ds:Signature>`

async function assertRegistroXsdValido(xml) {
  const r = await validarRegistroXsd(xml)
  assert.ok(r.valida, `XML no válido contra el XSD oficial:\n${r.errores.join('\n')}\n---\n${xml}`)
}

async function assertEventoXsdValido(xml) {
  const r = await validarEventoXsd(xml)
  assert.ok(r.valida, `XML no válido contra EventosSIF.xsd:\n${r.errores.join('\n')}\n---\n${xml}`)
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
// Registro de anulación
// ---------------------------------------------------------------------------

test('anulación mínima: XML válido contra XSD, huella y cadena de entrada oficiales', async () => {
  const r = generarAnulacion(anulacionBase())
  assert.equal(r.idEmisorFacturaAnulada, 'B98407901')
  assert.equal(r.fechaExpedicionFacturaAnulada, '12-09-2026')
  assert.equal(r.fechaHoraHusoGenRegistro, '2026-09-12T10:00:00+02:00')
  assert.equal(r.tipoHuella, '01')
  assert.ok(esHuellaValida(r.huella))
  assert.equal(r.huella, huellaAnulacion(r.datosHuella, null))
  assert.equal(
    r.cadenaHuella,
    'IDEmisorFacturaAnulada=B98407901&NumSerieFacturaAnulada=F-2026-000123' +
      '&FechaExpedicionFacturaAnulada=12-09-2026&Huella=' +
      '&FechaHoraHusoGenRegistro=2026-09-12T10:00:00+02:00'
  )
  assert.ok(r.xml.includes('<sf:PrimerRegistro>S</sf:PrimerRegistro>'))
  assert.ok(r.xml.includes('<sf:IDEmisorFacturaAnulada>B98407901</sf:IDEmisorFacturaAnulada>'))
  assert.ok(r.xml.includes(`<sf:Huella>${r.huella}</sf:Huella>`))
  await assertRegistroXsdValido(r.xml)
})

test('anulación con marcadores opcionales (RefExterna/SinRegistroPrevio/RechazoPrevio/GeneradoPor E)', async () => {
  const r = generarAnulacion(
    anulacionBase({
      refExterna: 'ANUL-INT-77',
      sinRegistroPrevio: 'N',
      rechazoPrevio: 'S',
      generadoPor: 'E',
      generador: { nombreRazon: EMISOR.nombreRazon, nif: EMISOR.nif },
    })
  )
  assert.ok(r.xml.includes('<sf:RefExterna>ANUL-INT-77</sf:RefExterna>'))
  assert.ok(r.xml.includes('<sf:SinRegistroPrevio>N</sf:SinRegistroPrevio>'))
  assert.ok(r.xml.includes('<sf:RechazoPrevio>S</sf:RechazoPrevio>'))
  assert.ok(r.xml.includes('<sf:GeneradoPor>E</sf:GeneradoPor>'))
  await assertRegistroXsdValido(r.xml)
})

test('anulación generada por tercero extranjero (Generador con IDOtro)', async () => {
  const r = generarAnulacion(
    anulacionBase({
      generadoPor: 'T',
      generador: { nombreRazon: 'Gestoría FR', codigoPais: 'FR', idType: '03', id: 'P-998877' },
    })
  )
  assert.ok(r.xml.includes('<sf:CodigoPais>FR</sf:CodigoPais>'))
  assert.ok(r.xml.includes('<sf:IDType>03</sf:IDType>'))
  await assertRegistroXsdValido(r.xml)
})

test('alta + anulación se encadenan en la MISMA cadena y verificarCadena la acepta', async () => {
  const alta = construirRegistroAlta(
    {
      emisor: EMISOR,
      numSerieFactura: 'F-2026-000123',
      fechaExpedicion: '2026-09-12',
      tipoFactura: 'F1',
      descripcionOperacion: 'Servicio',
      destinatarios: [{ nombreRazon: 'Cliente Ejemplo S.L.', nif: 'A58818501' }],
      desglose: [
        { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 100, cuotaRepercutida: 21 },
      ],
    },
    { encadenamiento: { primerRegistro: true }, sistemaInformatico: SIF, fechaGeneracion: CUANDO }
  )
  const anulacion = generarAnulacion(anulacionBase(), {
    encadenamiento: {
      registroAnterior: {
        idEmisorFactura: alta.idEmisorFactura,
        numSerieFactura: alta.numSerieFactura,
        fechaExpedicion: alta.fechaExpedicionFactura,
        huella: alta.huella,
      },
    },
    fechaGeneracion: new Date('2026-09-12T10:05:00+02:00'),
  })
  assert.equal(anulacion.huellaAnterior, alta.huella)
  assert.ok(anulacion.xml.includes(`<sf:Huella>${alta.huella}</sf:Huella>`))
  await assertRegistroXsdValido(anulacion.xml)

  const resultado = verificarCadena([
    { tipo: 'alta', primerRegistro: true, huellaAnterior: null, huella: alta.huella, datos: alta.datosHuella },
    { tipo: 'anulacion', primerRegistro: false, huellaAnterior: alta.huella, huella: anulacion.huella, datos: anulacion.datosHuella },
  ])
  assert.ok(resultado.valida, JSON.stringify(resultado.errores))
  assert.equal(resultado.ultimaHuella, anulacion.huella)
})

test('envoltura RegFactuSistemaFacturacion mezclando alta y anulación valida contra SuministroLR.xsd', async () => {
  const alta = construirRegistroAlta(
    {
      emisor: EMISOR,
      numSerieFactura: 'F-2026-000124',
      fechaExpedicion: '2026-09-12',
      tipoFactura: 'F2',
      descripcionOperacion: 'Venta mostrador',
      desglose: [
        { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 50, cuotaRepercutida: 10.5 },
      ],
    },
    { encadenamiento: { primerRegistro: true }, sistemaInformatico: SIF, fechaGeneracion: CUANDO }
  )
  const anulacion = generarAnulacion(anulacionBase(), {
    encadenamiento: {
      registroAnterior: {
        idEmisorFactura: alta.idEmisorFactura,
        numSerieFactura: alta.numSerieFactura,
        fechaExpedicion: alta.fechaExpedicionFactura,
        huella: alta.huella,
      },
    },
  })
  const envio = xmlRegFactuSistemaFacturacion(
    { obligadoEmision: EMISOR },
    [alta.xml, anulacion.xml]
  )
  const r = await validarEnvioXsd(envio)
  assert.ok(r.valida, `Envío no válido:\n${r.errores.join('\n')}`)
})

test('adaptador facturaAppARegistroAnulacion produce una entrada válida', async () => {
  const entrada = facturaAppARegistroAnulacion(
    { invoice_number: 'F-2026-000200', date: '2026-08-01' },
    EMISOR,
    { refExterna: 'inv-uuid-interno' }
  )
  const r = generarAnulacion(entrada)
  assert.equal(r.numSerieFacturaAnulada, 'F-2026-000200')
  assert.equal(r.fechaExpedicionFacturaAnulada, '01-08-2026')
  await assertRegistroXsdValido(r.xml)
})

test('anulación: rechazos de validación acumulados', () => {
  assertErrores(
    () => generarAnulacion(anulacionBase({ emisor: { nif: 'B98407902' } })),
    'emisor.nif'
  )
  assertErrores(
    () => generarAnulacion(anulacionBase({ numSerieFacturaAnulada: ' F-2026-1 ' })),
    'numSerieFacturaAnulada: no puede empezar ni terminar en espacios'
  )
  assertErrores(
    () => generarAnulacion(anulacionBase({ fechaExpedicionFacturaAnulada: '2026-02-31' })),
    'fecha inexistente'
  )
  assertErrores(
    () => generarAnulacion(anulacionBase({ generadoPor: 'D' })),
    'generador: obligatorio cuando generadoPor es D'
  )
  assertErrores(
    () => generarAnulacion(anulacionBase({ generador: { nombreRazon: 'X', nif: EMISOR.nif } })),
    'generador: solo admisible acompañado de generadoPor'
  )
  assertErrores(
    () => generarAnulacion(anulacionBase({ sinRegistroPrevio: 'X' })),
    'sinRegistroPrevio'
  )
  assertErrores(
    () =>
      generarAnulacion(anulacionBase(), {
        encadenamiento: {
          registroAnterior: {
            idEmisorFactura: EMISOR.nif,
            numSerieFactura: 'F-1',
            fechaExpedicion: '2026-09-01',
            huella: 'no-es-una-huella',
          },
        },
      }),
    'encadenamiento.registroAnterior.huella'
  )
})

// ---------------------------------------------------------------------------
// Registro de evento
// ---------------------------------------------------------------------------

test('evento 01 (primer evento) firmado: XML válido contra EventosSIF.xsd, huella y cadena oficiales', async () => {
  const r = generarEvento(eventoBase(), { firmaXmlDs: FIRMA_TEST })
  assert.equal(r.tipoEvento, '01')
  assert.equal(r.fechaHoraHusoGenEvento, '2026-09-12T10:00:00+02:00')
  assert.ok(esHuellaValida(r.huellaEvento))
  assert.equal(r.huellaEvento, huellaEvento(r.datosHuella, null))
  assert.equal(
    r.cadenaHuella,
    'NIF=B98407901&ID=&IdSistemaInformatico=01&Version=1.0.0&NumeroInstalacion=KU-test-0001' +
      '&NIF=A58818501&TipoEvento=01&HuellaEvento=' +
      '&FechaHoraHusoGenEvento=2026-09-12T10:00:00+02:00'
  )
  assert.ok(r.firmado)
  assert.ok(r.xml.includes('<sfe:PrimerEvento>S</sfe:PrimerEvento>'))
  assert.ok(r.xml.includes(`<sfe:HuellaEvento>${r.huellaEvento}</sfe:HuellaEvento>`))
  await assertEventoXsdValido(r.xml)
})

test('evento sin firma: se genera sin ds:Signature, queda marcado no firmado y NO valida contra el XSD', async () => {
  const r = generarEvento(eventoBase())
  assert.equal(r.firmado, false)
  assert.ok(!r.xml.includes('ds:Signature'))
  const v = await validarEventoXsd(r.xml)
  assert.equal(v.valida, false, 'el XSD exige ds:Signature: sin firma no debe validar')
})

test('evento 03 (lanzamiento detección anomalías facturación) con contadores: XSD válido', async () => {
  const r = generarEvento(
    eventoBase({
      tipoEvento: '03',
      datosPropiosEvento: {
        tipo: 'LanzamientoProcesoDeteccionAnomaliasRegFacturacion',
        procesoIntegridadHuellas: 'S',
        numeroRegistrosIntegridadHuellas: 1500,
        procesoIntegridadFirmas: 'N',
        procesoTrazabilidadCadena: 'S',
        numeroRegistrosTrazabilidadCadena: 1500,
        procesoTrazabilidadFechas: 'S',
        numeroRegistrosTrazabilidadFechas: 1500,
      },
    }),
    { firmaXmlDs: FIRMA_TEST }
  )
  assert.ok(r.xml.includes('<sfe:RealizadoProcesoSobreIntegridadHuellasRegFacturacion>S</sfe:RealizadoProcesoSobreIntegridadHuellasRegFacturacion>'))
  assert.ok(r.xml.includes('<sfe:NumeroDeRegistrosFacturacionProcesadosSobreIntegridadHuellas>1500</sfe:NumeroDeRegistrosFacturacionProcesadosSobreIntegridadHuellas>'))
  await assertEventoXsdValido(r.xml)
})

test('evento 04 (anomalía en registros de facturación) con registro anómalo: XSD válido', async () => {
  const r = generarEvento(
    eventoBase({
      tipoEvento: '04',
      datosPropiosEvento: {
        tipo: 'DeteccionAnomaliasRegFacturacion',
        tipoAnomalia: '07',
        otrosDatosAnomalia: 'Huella del registro posterior no enlaza',
        registroFacturacionAnomalo: {
          idEmisorFactura: 'A58818501',
          numSerieFactura: 'F-2026-000050',
          fechaExpedicion: '2026-07-15',
        },
      },
    }),
    { firmaXmlDs: FIRMA_TEST }
  )
  assert.ok(r.xml.includes('<sfe:TipoAnomalia>07</sfe:TipoAnomalia>'))
  await assertEventoXsdValido(r.xml)
})

test('evento 08 (exportación de registros de facturación de un periodo): XSD válido', async () => {
  const huellaA = 'A'.repeat(64)
  const huellaB = 'B'.repeat(64)
  const r = generarEvento(
    eventoBase({
      tipoEvento: '08',
      datosPropiosEvento: {
        tipo: 'ExportacionRegFacturacionPeriodo',
        fechaHoraHusoInicioPeriodo: '2026-01-01T00:00:00+01:00',
        fechaHoraHusoFinPeriodo: new Date('2026-06-30T21:59:59Z'),
        registroInicialPeriodo: {
          idEmisorFactura: 'A58818501',
          numSerieFactura: 'F-2026-000001',
          fechaExpedicion: '2026-01-02',
          huella: huellaA,
        },
        registroFinalPeriodo: {
          idEmisorFactura: 'A58818501',
          numSerieFactura: 'F-2026-000420',
          fechaExpedicion: '2026-06-30',
          huella: huellaB,
        },
        numeroAltasExportados: 418,
        sumaCuotaTotalAlta: 21735.5,
        sumaImporteTotalAlta: 125235.5,
        numeroAnulacionesExportados: 2,
        exportadosDejanDeConservarse: 'N',
      },
    }),
    { firmaXmlDs: FIRMA_TEST }
  )
  assert.ok(r.xml.includes('<sfe:SumaCuotaTotalAlta>21735.50</sfe:SumaCuotaTotalAlta>'))
  assert.ok(r.xml.includes('<sfe:FechaHoraHusoFinPeriodoExport>2026-06-30T23:59:59+02:00</sfe:FechaHoraHusoFinPeriodoExport>'))
  await assertEventoXsdValido(r.xml)
})

test('evento 09 (exportación de registros de evento) y evento 10 (resumen): XSD válidos', async () => {
  const evento09 = generarEvento(
    eventoBase({
      tipoEvento: '09',
      datosPropiosEvento: {
        tipo: 'ExportacionRegEventoPeriodo',
        fechaHoraHusoInicioPeriodo: '2026-01-01T00:00:00+01:00',
        fechaHoraHusoFinPeriodo: '2026-06-30T23:59:59+02:00',
        registroEventoInicialPeriodo: {
          tipoEvento: '01',
          fechaHoraHusoEvento: '2026-01-01T08:00:00+01:00',
          huellaEvento: 'C'.repeat(64),
        },
        registroEventoFinalPeriodo: {
          tipoEvento: '10',
          fechaHoraHusoEvento: '2026-06-30T20:00:00+02:00',
          huellaEvento: 'D'.repeat(64),
        },
        numeroEventosExportados: 731,
        exportadosDejanDeConservarse: 'N',
      },
    }),
    { firmaXmlDs: FIRMA_TEST }
  )
  await assertEventoXsdValido(evento09.xml)

  const evento10 = generarEvento(
    eventoBase({
      tipoEvento: '10',
      datosPropiosEvento: {
        tipo: 'ResumenEventos',
        eventos: [
          { tipoEvento: '03', numeroDeEventos: 1 },
          { tipoEvento: '04', numeroDeEventos: 0 },
        ],
        numeroAltasGenerados: 12,
        sumaCuotaTotalAlta: 252,
        sumaImporteTotalAlta: 1452,
        numeroAnulacionesGenerados: 0,
      },
    }),
    { firmaXmlDs: FIRMA_TEST }
  )
  assert.ok(evento10.xml.includes('<sfe:NumeroDeEventos>0</sfe:NumeroDeEventos>'))
  await assertEventoXsdValido(evento10.xml)
})

test('cadena de eventos: encadenamiento con evento anterior y verificarCadenaEventos', async () => {
  const primero = generarEvento(eventoBase(), { firmaXmlDs: FIRMA_TEST })
  const segundo = generarEvento(eventoBase({ tipoEvento: '02' }), {
    encadenamiento: {
      eventoAnterior: {
        tipoEvento: primero.tipoEvento,
        fechaHoraHusoGenEvento: primero.fechaHoraHusoGenEvento,
        huellaEvento: primero.huellaEvento,
      },
    },
    fechaGeneracion: new Date('2026-09-12T16:00:00+02:00'),
    firmaXmlDs: FIRMA_TEST,
  })
  assert.equal(segundo.huellaEventoAnterior, primero.huellaEvento)
  assert.ok(segundo.xml.includes(`<sfe:HuellaEvento>${primero.huellaEvento}</sfe:HuellaEvento>`))
  await assertEventoXsdValido(segundo.xml)

  const ok = verificarCadenaEventos([
    { primerEvento: true, huellaAnterior: null, huella: primero.huellaEvento, datos: primero.datosHuella },
    { primerEvento: false, huellaAnterior: primero.huellaEvento, huella: segundo.huellaEvento, datos: segundo.datosHuella },
  ])
  assert.ok(ok.valida, JSON.stringify(ok.errores))
  assert.equal(ok.ultimaHuella, segundo.huellaEvento)

  // Manipular el tipo de evento del primer eslabón rompe la cadena.
  const manipulada = verificarCadenaEventos([
    {
      primerEvento: true,
      huellaAnterior: null,
      huella: primero.huellaEvento,
      datos: { ...primero.datosHuella, TipoEvento: '90' },
    },
    { primerEvento: false, huellaAnterior: primero.huellaEvento, huella: segundo.huellaEvento, datos: segundo.datosHuella },
  ])
  assert.equal(manipulada.valida, false)
  assert.ok(manipulada.errores.some((e) => e.codigo === 'HUELLA_NO_COINCIDE'))
})

test('evento: rechazos de validación', () => {
  assertErrores(() => generarEvento(eventoBase({ tipoEvento: '11' })), 'tipoEvento')
  assertErrores(() => generarEvento(eventoBase({ tipoEvento: '04' })), 'datosPropiosEvento: obligatorio')
  assertErrores(
    () =>
      generarEvento(
        eventoBase({
          datosPropiosEvento: { tipo: 'ResumenEventos', eventos: [], numeroAltasGenerados: 0, sumaCuotaTotalAlta: 0, sumaImporteTotalAlta: 0, numeroAnulacionesGenerados: 0 },
        })
      ),
    'datosPropiosEvento: no admisible para tipoEvento=01'
  )
  assertErrores(
    () =>
      generarEvento(
        eventoBase({
          tipoEvento: '04',
          datosPropiosEvento: { tipo: 'DeteccionAnomaliasRegEvento', tipoAnomalia: '01' },
        })
      ),
    'no corresponde a tipoEvento=04'
  )
  assertErrores(
    () =>
      generarEvento(
        eventoBase({
          tipoEvento: '10',
          datosPropiosEvento: {
            tipo: 'ResumenEventos',
            eventos: [{ tipoEvento: '03', numeroDeEventos: 12345 }],
            numeroAltasGenerados: 0,
            sumaCuotaTotalAlta: 0,
            sumaImporteTotalAlta: 0,
            numeroAnulacionesGenerados: 0,
          },
        })
      ),
    'supera los 4 dígitos'
  )
  assertErrores(
    () => generarEvento(eventoBase({ terceroODestinatario: { nombreRazon: 'X', nif: EMISOR.nif } })),
    'terceroODestinatario: solo admisible'
  )
  assertErrores(
    () => generarEvento(eventoBase({ emitidaPorTerceroODestinatario: 'D' })),
    'terceroODestinatario: obligatorio'
  )
  assertErrores(
    () => generarEvento(eventoBase(), { firmaXmlDs: '<Signature>x</Signature>' }),
    'firmaXmlDs'
  )
  assertErrores(() => generarEvento(eventoBase({ otrosDatosEvento: 'x'.repeat(101) })), 'otrosDatosEvento')
})
