// Tests V10: worker de remisión (outbox → AEAT).
//
// Cubre las funciones puras (fechas, XML del registro con verificación de
// huella, casado de RespuestaLinea con duplicados idempotentes, clasificación
// de errores) y el flujo completo remitirObligado/procesarRemision con un
// Supabase simulado (grabación de RPCs) y el cliente SOAP real de V09 con
// transporte inyectado (sin red). Las respuestas AEAT simuladas siguen la
// estructura de RespuestaSuministro.xsd (mismos fixtures que V09).
// Ejecutar con: npm test  (node --test, sin transpilación).

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'

import {
  fechaOficialDeIso,
  xmlDeFila,
  resolverLineas,
  esErrorReintentable,
  remitirObligado,
  procesarRemision,
} from '../remision.ts'
import {
  ClienteAeat,
  ErrorTransporteAeat,
  ErrorHttpAeat,
  ErrorSoapAeat,
  ErrorRespuestaAeat,
  NS_SOAP_ENV,
  parsearRespuestaSoap,
} from '../aeat-cliente.ts'
import {
  construirRegistroAlta,
  sistemaInformaticoKuentas,
  NS_SF,
} from '../registro-alta.ts'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NIF = 'B98407901'
const CERT_FICTICIO = { cert: 'x', key: 'y' } // material sintáctico (sin red)
const NS_SFR =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaSuministro.xsd'

function lineaXml({ numSerie, fecha = '12-09-2026', tipoOperacion = 'Alta', estado = 'Correcto', extras = '' }) {
  return `    <sfR:RespuestaLinea>
      <sfR:IDFactura>
        <sf:IDEmisorFactura>${NIF}</sf:IDEmisorFactura>
        <sf:NumSerieFactura>${numSerie}</sf:NumSerieFactura>
        <sf:FechaExpedicionFactura>${fecha}</sf:FechaExpedicionFactura>
      </sfR:IDFactura>
      <sfR:Operacion>
        <sf:TipoOperacion>${tipoOperacion}</sf:TipoOperacion>
      </sfR:Operacion>
      <sfR:EstadoRegistro>${estado}</sfR:EstadoRegistro>${extras}
    </sfR:RespuestaLinea>`
}

function respuestaXml({ csv, estadoEnvio, tiempoEspera = '60', lineas }) {
  return `<sfR:RespuestaRegFactuSistemaFacturacion xmlns:sfR="${NS_SFR}" xmlns:sf="${NS_SF}">
${csv ? `    <sfR:CSV>${csv}</sfR:CSV>\n` : ''}    <sfR:Cabecera>
      <sf:ObligadoEmision>
        <sf:NombreRazon>Mercadonet Global S.L.</sf:NombreRazon>
        <sf:NIF>${NIF}</sf:NIF>
      </sf:ObligadoEmision>
    </sfR:Cabecera>
    <sfR:TiempoEsperaEnvio>${tiempoEspera}</sfR:TiempoEsperaEnvio>
    <sfR:EstadoEnvio>${estadoEnvio}</sfR:EstadoEnvio>
${lineas.join('\n')}
</sfR:RespuestaRegFactuSistemaFacturacion>`
}

function envolver(cuerpo) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<env:Envelope xmlns:env="${NS_SOAP_ENV}"><env:Header/><env:Body>${cuerpo}</env:Body></env:Envelope>`
}

const FAULT = envolver(
  `<env:Fault><faultcode>env:Client</faultcode><faultstring>XML mal formado</faultstring></env:Fault>`
)

const LOTE = randomUUID()

function fila(extra = {}) {
  return {
    outbox_id: randomUUID(),
    lote_id: LOTE,
    registro_id: randomUUID(),
    tipo_registro: 'alta',
    num_serie_factura: 'F-2026-000123',
    fecha_expedicion: '2026-09-12',
    intentos: 1,
    incidencia: false,
    xml: '<sf:RegistroAlta><sf:Ficticio/></sf:RegistroAlta>',
    registro: {},
    huella: 'X'.repeat(64),
    ...extra,
  }
}

/** Supabase simulado: graba las RPC y devuelve respuestas canónicas. */
function supabaseFalso({ filas = [], pendientes = [], config, onRpc } = {}) {
  const llamadas = []
  return {
    llamadas,
    rpc: async (fn, args = {}) => {
      llamadas.push({ fn, args })
      if (onRpc) {
        const r = onRpc(fn, args)
        if (r !== undefined) return r
      }
      if (fn === 'sif_remision_pendientes') return { data: pendientes, error: null }
      if (fn === 'sif_outbox_reclamar_lote') return { data: filas, error: null }
      return { data: filas.length, error: null } // resolver / fallar
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: config === undefined
              ? { nif_obligado: NIF, nombre_razon: 'Mercadonet Global S.L.' }
              : config,
            error: null,
          }),
        }),
      }),
    }),
  }
}

function clienteConRespuesta(respuestas) {
  const peticiones = []
  const cola = [...respuestas]
  const cliente = new ClienteAeat(
    { entorno: 'pruebas', certificado: CERT_FICTICIO },
    async (p) => {
      peticiones.push(p)
      const r = cola.shift()
      if (r instanceof Error) throw r
      return r
    }
  )
  return { cliente, peticiones }
}

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

test('fechaOficialDeIso convierte aaaa-mm-dd → dd-mm-aaaa', () => {
  assert.equal(fechaOficialDeIso('2026-09-12'), '12-09-2026')
  assert.equal(fechaOficialDeIso('2026-01-03T00:00:00'), '03-01-2026')
  assert.throws(() => fechaOficialDeIso('12/09/2026'), /Fecha ISO inválida/)
})

test('xmlDeFila usa el XML fijado si existe', () => {
  const f = fila({ xml: '<sf:RegistroAlta>fijado</sf:RegistroAlta>' })
  assert.equal(xmlDeFila(f), '<sf:RegistroAlta>fijado</sf:RegistroAlta>')
})

test('xmlDeFila regenera desde el jsonb persistido verificando la huella', () => {
  const si = sistemaInformaticoKuentas('KU-test-0001')
  const entrada = {
    emisor: { nif: NIF, nombreRazon: 'Mercadonet Global S.L.' },
    numSerieFactura: 'F-2026-000123',
    fechaExpedicion: '2026-09-12',
    tipoFactura: 'F1',
    descripcionOperacion: 'Desarrollo web',
    destinatarios: [{ nombreRazon: 'Cliente Ejemplo S.L.', nif: 'A58818501' }],
    desglose: [
      { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 1000, cuotaRepercutida: 210 },
    ],
  }
  const encadenamiento = { primerRegistro: true }
  const cuando = new Date('2026-09-12T10:00:00+02:00')
  const generado = construirRegistroAlta(entrada, {
    encadenamiento,
    sistemaInformatico: si,
    fechaGeneracion: cuando,
  })
  const persistido = {
    entrada,
    sistemaInformatico: si,
    encadenamiento,
    fechaHoraHusoGenRegistro: generado.fechaHoraHusoGenRegistro,
    tipoHuella: '01',
    huella: generado.huella,
  }
  const f = fila({ xml: null, registro: persistido, huella: generado.huella })
  assert.equal(xmlDeFila(f), generado.xml)

  // Huella registrada distinta ⇒ integridad rota ⇒ NO se remite
  const mala = fila({ xml: null, registro: persistido, huella: '0'.repeat(64) })
  assert.throws(() => xmlDeFila(mala), /Integridad/)
})

test('resolverLineas casa por IDFactura y mapea los estados internos', () => {
  const filas = [
    fila({ num_serie_factura: 'F-2026-000123' }),
    fila({ num_serie_factura: 'F-2026-000124' }),
    fila({ num_serie_factura: 'F-2026-000125' }),
    fila({ num_serie_factura: 'F-2026-000126' }), // sin línea en la respuesta
  ]
  const respuesta = parsearRespuestaSoap(
    envolver(
      respuestaXml({
        csv: 'CSVPRUEBA01',
        estadoEnvio: 'ParcialmenteCorrecto',
        lineas: [
          lineaXml({ numSerie: 'F-2026-000123', estado: 'Correcto' }),
          lineaXml({
            numSerie: 'F-2026-000124',
            estado: 'AceptadoConErrores',
            extras: `\n      <sfR:CodigoErrorRegistro>2001</sfR:CodigoErrorRegistro>\n      <sfR:DescripcionErrorRegistro>Valor no censado</sfR:DescripcionErrorRegistro>`,
          }),
          lineaXml({
            numSerie: 'F-2026-000125',
            estado: 'Incorrecto',
            extras: `\n      <sfR:CodigoErrorRegistro>3000</sfR:CodigoErrorRegistro>\n      <sfR:DescripcionErrorRegistro>Registro inválido</sfR:DescripcionErrorRegistro>`,
          }),
        ],
      })
    )
  )
  const { lineas, sinRespuesta } = resolverLineas(filas, respuesta, NIF)
  assert.equal(lineas.length, 3)
  assert.deepEqual(
    lineas.map((l) => l.estado),
    ['accepted', 'accepted_with_errors', 'rejected']
  )
  assert.equal(lineas[0].codigo_error, null)
  assert.equal(lineas[1].codigo_error, '2001')
  assert.equal(lineas[2].descripcion, 'Registro inválido')
  assert.equal(sinRespuesta.length, 1)
  assert.equal(sinRespuesta[0].num_serie_factura, 'F-2026-000126')
})

test('resolverLineas trata los duplicados idempotentemente (SPEC §5.4)', () => {
  const dupCorrecta = `\n      <sfR:CodigoErrorRegistro>3001</sfR:CodigoErrorRegistro>\n      <sfR:RegistroDuplicado>\n        <sfR:IdPeticionRegistroDuplicado>PET-1</sfR:IdPeticionRegistroDuplicado>\n        <sfR:EstadoRegistroDuplicado>Correcta</sfR:EstadoRegistroDuplicado>\n      </sfR:RegistroDuplicado>`
  const dupAnulada = dupCorrecta.replace('Correcta', 'Anulada')
  const filas = [
    fila({ num_serie_factura: 'F-2026-000123' }),
    fila({ num_serie_factura: 'F-2026-000124', tipo_registro: 'anulacion' }),
  ]
  const respuesta = parsearRespuestaSoap(
    envolver(
      respuestaXml({
        estadoEnvio: 'Incorrecto',
        lineas: [
          lineaXml({ numSerie: 'F-2026-000123', estado: 'Incorrecto', extras: dupCorrecta }),
          lineaXml({ numSerie: 'F-2026-000124', tipoOperacion: 'Anulacion', estado: 'Incorrecto', extras: dupAnulada }),
        ],
      })
    )
  )
  const { lineas } = resolverLineas(filas, respuesta, NIF)
  // Alta duplicada ya Correcta ⇒ accepted; anulación duplicada ya Anulada ⇒ accepted
  assert.deepEqual(lineas.map((l) => l.estado), ['accepted', 'accepted'])
})

test('esErrorReintentable clasifica los errores del cliente V09', () => {
  assert.equal(esErrorReintentable(new ErrorTransporteAeat('timeout')), true)
  assert.equal(esErrorReintentable(new ErrorHttpAeat(503, '')), true)
  assert.equal(esErrorReintentable(new ErrorHttpAeat(400, '')), false)
  assert.equal(esErrorReintentable(new ErrorSoapAeat('env:Client', 'mal formado')), false)
  assert.equal(esErrorReintentable(new ErrorRespuestaAeat('cuerpo raro')), true)
  assert.equal(esErrorReintentable(new Error('otro')), false)
})

// ---------------------------------------------------------------------------
// remitirObligado (flujo completo con cliente V09 y transporte inyectado)
// ---------------------------------------------------------------------------

test('remitirObligado: envío correcto → resolver_lote con estados, CSV y TiempoEsperaEnvio', async () => {
  const filas = [
    fila({ num_serie_factura: 'F-2026-000123' }),
    fila({ num_serie_factura: 'F-2026-000124' }),
  ]
  const sb = supabaseFalso({ filas })
  const { cliente, peticiones } = clienteConRespuesta([
    {
      status: 200,
      cuerpo: envolver(
        respuestaXml({
          csv: 'CSVPRUEBA02',
          estadoEnvio: 'Correcto',
          tiempoEspera: '90',
          lineas: [
            lineaXml({ numSerie: 'F-2026-000123' }),
            lineaXml({ numSerie: 'F-2026-000124' }),
          ],
        })
      ),
    },
  ])

  const resumen = await remitirObligado(sb, cliente, 'user-1')
  assert.equal(resumen.enviados, 2)
  assert.equal(resumen.aceptados, 2)
  assert.equal(resumen.rechazados, 0)
  assert.equal(resumen.csv, 'CSVPRUEBA02')
  assert.equal(resumen.tiempoEsperaEnvio, 90)
  assert.equal(resumen.estadoEnvio, 'Correcto')
  assert.equal(resumen.error, undefined)

  // El mensaje enviado lleva la cabecera del obligado y los 2 registros, sin Incidencia
  assert.equal(peticiones.length, 1)
  assert.match(peticiones[0].cuerpo, /<sf:NIF>B98407901<\/sf:NIF>/)
  assert.match(peticiones[0].cuerpo, /<sf:Ficticio\/>/)
  assert.doesNotMatch(peticiones[0].cuerpo, /<sf:Incidencia>/)

  const resolver = sb.llamadas.find((c) => c.fn === 'sif_outbox_resolver_lote')
  assert.ok(resolver, 'debe llamar a sif_outbox_resolver_lote')
  assert.equal(resolver.args.p_lote_id, LOTE)
  assert.equal(resolver.args.p_csv, 'CSVPRUEBA02')
  assert.equal(resolver.args.p_tiempo_espera, 90)
  assert.equal(resolver.args.p_estado_envio, 'Correcto')
  assert.equal(resolver.args.p_lineas.length, 2)
  assert.ok(resolver.args.p_lineas.every((l) => l.estado === 'accepted'))
  assert.ok(!sb.llamadas.some((c) => c.fn === 'sif_outbox_fallar_lote'))
})

test('remitirObligado: registros con incidencia → cabecera con Incidencia=S (art. 16 Orden)', async () => {
  const filas = [fila({ incidencia: true })]
  const sb = supabaseFalso({ filas })
  const { cliente, peticiones } = clienteConRespuesta([
    {
      status: 200,
      cuerpo: envolver(
        respuestaXml({ csv: 'CSVPRUEBA03', estadoEnvio: 'Correcto', lineas: [lineaXml({ numSerie: 'F-2026-000123' })] })
      ),
    },
  ])
  await remitirObligado(sb, cliente, 'user-1')
  assert.match(peticiones[0].cuerpo, /<sf:Incidencia>S<\/sf:Incidencia>/)
})

test('remitirObligado: fallo de transporte → fallar_lote reintentable', async () => {
  const filas = [fila()]
  const sb = supabaseFalso({ filas })
  const { cliente } = clienteConRespuesta([new ErrorTransporteAeat('ECONNREFUSED')])

  const resumen = await remitirObligado(sb, cliente, 'user-1')
  assert.match(resumen.error, /ECONNREFUSED/)
  assert.equal(resumen.reintentable, true)
  const fallar = sb.llamadas.find((c) => c.fn === 'sif_outbox_fallar_lote')
  assert.ok(fallar)
  assert.equal(fallar.args.p_reintentable, true)
  assert.ok(!sb.llamadas.some((c) => c.fn === 'sif_outbox_resolver_lote'))
})

test('remitirObligado: SOAP Fault → fallar_lote NO reintentable (backoff máximo)', async () => {
  const sb = supabaseFalso({ filas: [fila()] })
  const { cliente } = clienteConRespuesta([{ status: 500, cuerpo: FAULT }])

  const resumen = await remitirObligado(sb, cliente, 'user-1')
  assert.match(resumen.error, /XML mal formado/)
  assert.equal(resumen.reintentable, false)
  const fallar = sb.llamadas.find((c) => c.fn === 'sif_outbox_fallar_lote')
  assert.equal(fallar.args.p_reintentable, false)
})

test('remitirObligado: integridad rota al regenerar el XML → fallar_lote NO reintentable', async () => {
  const sb = supabaseFalso({ filas: [fila({ xml: null, registro: { entrada: {} }, huella: '0'.repeat(64) })] })
  const { cliente, peticiones } = clienteConRespuesta([])

  const resumen = await remitirObligado(sb, cliente, 'user-1')
  assert.ok(resumen.error)
  assert.equal(resumen.reintentable, false)
  assert.equal(peticiones.length, 0, 'no debe llegar a enviarse nada')
})

test('remitirObligado: cola vacía / control de flujo → null y ninguna otra RPC', async () => {
  const sb = supabaseFalso({ filas: [] })
  const { cliente, peticiones } = clienteConRespuesta([])
  const resumen = await remitirObligado(sb, cliente, 'user-1')
  assert.equal(resumen, null)
  assert.equal(peticiones.length, 0)
  assert.deepEqual(sb.llamadas.map((c) => c.fn), ['sif_outbox_reclamar_lote'])
})

// ---------------------------------------------------------------------------
// procesarRemision (tick completo multi-obligado)
// ---------------------------------------------------------------------------

test('procesarRemision: procesa todos los obligados y un fallo no detiene a los demás', async () => {
  const filasA = [fila({ num_serie_factura: 'F-2026-000123' })]
  const sb = supabaseFalso({
    pendientes: [
      { user_id: 'user-a', pendientes: 1 },
      { user_id: 'user-b', pendientes: 3 },
    ],
    onRpc: (fn, args) => {
      if (fn === 'sif_outbox_reclamar_lote') {
        if (args.p_user_id === 'user-a') return { data: filasA, error: null }
        return { data: null, error: { message: 'caída simulada de la RPC' } }
      }
      return undefined
    },
  })
  const { cliente } = clienteConRespuesta([
    {
      status: 200,
      cuerpo: envolver(
        respuestaXml({ csv: 'CSVPRUEBA04', estadoEnvio: 'Correcto', lineas: [lineaXml({ numSerie: 'F-2026-000123' })] })
      ),
    },
  ])

  const r = await procesarRemision(sb, () => cliente)
  assert.equal(r.obligados.length, 2)
  const a = r.obligados.find((o) => o.userId === 'user-a')
  const b = r.obligados.find((o) => o.userId === 'user-b')
  assert.equal(a.aceptados, 1)
  assert.equal(a.error, undefined)
  assert.match(b.error, /caída simulada/)
  assert.equal(r.totalEnviados, 1)
  assert.equal(r.totalErrores, 1)
})

test('procesarRemision: sin obligados pendientes → resumen vacío', async () => {
  const sb = supabaseFalso({ pendientes: [] })
  const r = await procesarRemision(sb, () => {
    throw new Error('no debe crear cliente')
  })
  assert.deepEqual(r, { obligados: [], totalEnviados: 0, totalErrores: 0 })
})
