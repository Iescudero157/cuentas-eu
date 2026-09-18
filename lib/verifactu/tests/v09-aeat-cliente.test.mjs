// Tests V09: cliente SOAP del servicio AEAT RegFactuSistemaFacturacion.
//
// - Los endpoints se confirman contra el WSDL OFICIAL descargado
//   (docs/verifactu/xsd/SistemaFacturacion.wsdl), no contra literales sueltos.
// - Las respuestas de ejemplo se validan contra RespuestaSuministro.xsd antes
//   de parsearlas (los fixtures cumplen el esquema oficial).
// - El intercambio completo (SOAP + mTLS con certificado cliente) se prueba
//   contra un servidor HTTPS local que EXIGE certificado, con los certificados
//   autofirmados de fixtures/certs-prueba (solo tests).
// Ejecutar con: npm test  (node --test, sin transpilación).

import { strict as assert } from 'node:assert'
import { test, after } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:https'

import {
  ENDPOINTS_VERIFACTU,
  ENDPOINTS_REQUERIMIENTO,
  ClienteAeat,
  envolverSoap,
  parsearRespuestaSoap,
  transporteHttpsNode,
  certificadoDesdeEnv,
  configDesdeEnv,
  estadoInternoLinea,
  estadoSiDuplicado,
  ErrorTransporteAeat,
  ErrorHttpAeat,
  ErrorSoapAeat,
  ErrorRespuestaAeat,
  NS_SOAP_ENV,
} from '../aeat-cliente.ts'
import { parsearXml, ErrorXml, hijo, textoDe } from '../xml-ligero.ts'
import {
  construirRegistroAlta,
  xmlRegFactuSistemaFacturacion,
  sistemaInformaticoKuentas,
  NS_SF,
} from '../registro-alta.ts'
import { validarEnvioXsd, validarRespuestaXsd } from './helpers/xsd-validator.mjs'

const DIR_CERTS = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'certs-prueba')
const CA_PRUEBA = readFileSync(join(DIR_CERTS, 'ca.cert.pem'))
const SERVIDOR = {
  key: readFileSync(join(DIR_CERTS, 'servidor.key.pem')),
  cert: readFileSync(join(DIR_CERTS, 'servidor.cert.pem')),
}
const CLIENTE_PFX = readFileSync(join(DIR_CERTS, 'cliente.pfx'))
const CLIENTE_PEM = {
  cert: readFileSync(join(DIR_CERTS, 'cliente.cert.pem')),
  key: readFileSync(join(DIR_CERTS, 'cliente.key.pem')),
}

const NS_SFR =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaSuministro.xsd'

const CERT_FICTICIO = { cert: 'x', key: 'y' } // material sintáctico para tests sin red

// ---------------------------------------------------------------------------
// Fixtures de respuesta (conformes a RespuestaSuministro.xsd)
// ---------------------------------------------------------------------------

const LINEA_ALTA_OK = `    <sfR:RespuestaLinea>
      <sfR:IDFactura>
        <sf:IDEmisorFactura>B98407901</sf:IDEmisorFactura>
        <sf:NumSerieFactura>F-2026-000123</sf:NumSerieFactura>
        <sf:FechaExpedicionFactura>12-09-2026</sf:FechaExpedicionFactura>
      </sfR:IDFactura>
      <sfR:Operacion>
        <sf:TipoOperacion>Alta</sf:TipoOperacion>
      </sfR:Operacion>
      <sfR:EstadoRegistro>Correcto</sfR:EstadoRegistro>
    </sfR:RespuestaLinea>`

function respuestaXml({ csv, estadoEnvio, tiempoEspera = '60', lineas = [LINEA_ALTA_OK] }) {
  return `<sfR:RespuestaRegFactuSistemaFacturacion xmlns:sfR="${NS_SFR}" xmlns:sf="${NS_SF}">
${csv ? `    <sfR:CSV>${csv}</sfR:CSV>\n` : ''}${
    csv
      ? `    <sfR:DatosPresentacion>
      <sf:NIFPresentador>B98407901</sf:NIFPresentador>
      <sf:TimestampPresentacion>2026-09-18T10:30:05+02:00</sf:TimestampPresentacion>
    </sfR:DatosPresentacion>\n`
      : ''
  }    <sfR:Cabecera>
      <sf:ObligadoEmision>
        <sf:NombreRazon>Mercadonet Global S.L.</sf:NombreRazon>
        <sf:NIF>B98407901</sf:NIF>
      </sf:ObligadoEmision>
    </sfR:Cabecera>
    <sfR:TiempoEsperaEnvio>${tiempoEspera}</sfR:TiempoEsperaEnvio>
    <sfR:EstadoEnvio>${estadoEnvio}</sfR:EstadoEnvio>
${lineas.join('\n')}
</sfR:RespuestaRegFactuSistemaFacturacion>`
}

function envolver(respuesta) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<env:Envelope xmlns:env="${NS_SOAP_ENV}"><env:Header/><env:Body>${respuesta}</env:Body></env:Envelope>`
}

const RESPUESTA_CORRECTA = respuestaXml({ csv: 'CSVKUENTASPRUEBA01', estadoEnvio: 'Correcto' })

const LINEA_ACEPTADA_CON_ERRORES = LINEA_ALTA_OK.replace(
  '<sfR:EstadoRegistro>Correcto</sfR:EstadoRegistro>',
  `<sfR:EstadoRegistro>AceptadoConErrores</sfR:EstadoRegistro>
      <sfR:CodigoErrorRegistro>2001</sfR:CodigoErrorRegistro>
      <sfR:DescripcionErrorRegistro>Error admisible: valor no censado.</sfR:DescripcionErrorRegistro>`
).replace('<sf:NumSerieFactura>F-2026-000123</sf:NumSerieFactura>', '<sf:NumSerieFactura>F-2026-000124</sf:NumSerieFactura>')

const LINEA_RECHAZADA = `    <sfR:RespuestaLinea>
      <sfR:IDFactura>
        <sf:IDEmisorFactura>B98407901</sf:IDEmisorFactura>
        <sf:NumSerieFactura>F-2026-000125</sf:NumSerieFactura>
        <sf:FechaExpedicionFactura>12-09-2026</sf:FechaExpedicionFactura>
      </sfR:IDFactura>
      <sfR:Operacion>
        <sf:TipoOperacion>Anulacion</sf:TipoOperacion>
        <sf:RechazoPrevio>S</sf:RechazoPrevio>
      </sfR:Operacion>
      <sfR:RefExterna>lote-77</sfR:RefExterna>
      <sfR:EstadoRegistro>Incorrecto</sfR:EstadoRegistro>
      <sfR:CodigoErrorRegistro>3002</sfR:CodigoErrorRegistro>
      <sfR:DescripcionErrorRegistro>No existe el registro de facturación.</sfR:DescripcionErrorRegistro>
    </sfR:RespuestaLinea>`

const LINEA_DUPLICADA = `    <sfR:RespuestaLinea>
      <sfR:IDFactura>
        <sf:IDEmisorFactura>B98407901</sf:IDEmisorFactura>
        <sf:NumSerieFactura>F-2026-000126</sf:NumSerieFactura>
        <sf:FechaExpedicionFactura>12-09-2026</sf:FechaExpedicionFactura>
      </sfR:IDFactura>
      <sfR:Operacion>
        <sf:TipoOperacion>Alta</sf:TipoOperacion>
      </sfR:Operacion>
      <sfR:EstadoRegistro>Incorrecto</sfR:EstadoRegistro>
      <sfR:CodigoErrorRegistro>3000</sfR:CodigoErrorRegistro>
      <sfR:DescripcionErrorRegistro>Registro de facturación duplicado.</sfR:DescripcionErrorRegistro>
      <sfR:RegistroDuplicado>
        <sf:IdPeticionRegistroDuplicado>20260912-000000042</sf:IdPeticionRegistroDuplicado>
        <sf:EstadoRegistroDuplicado>Correcta</sf:EstadoRegistroDuplicado>
      </sfR:RegistroDuplicado>
    </sfR:RespuestaLinea>`

const RESPUESTA_PARCIAL = respuestaXml({
  csv: 'CSVKUENTASPRUEBA02',
  estadoEnvio: 'ParcialmenteCorrecto',
  tiempoEspera: '120',
  lineas: [LINEA_ALTA_OK, LINEA_ACEPTADA_CON_ERRORES, LINEA_RECHAZADA],
})

const RESPUESTA_INCORRECTA = respuestaXml({ estadoEnvio: 'Incorrecto', lineas: [LINEA_DUPLICADA] })

const FAULT = `<?xml version="1.0" encoding="UTF-8"?>
<env:Envelope xmlns:env="${NS_SOAP_ENV}"><env:Body><env:Fault>
  <faultcode>env:Client</faultcode>
  <faultstring>Codigo[4102].El XML no cumple el esquema. Falta informar campo obligatorio.: IDVersion</faultstring>
</env:Fault></env:Body></env:Envelope>`

// ---------------------------------------------------------------------------
// Endpoints confirmados contra el WSDL oficial descargado
// ---------------------------------------------------------------------------

test('los endpoints coinciden con los soap:address del WSDL oficial', () => {
  const wsdl = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'verifactu', 'xsd', 'SistemaFacturacion.wsdl'),
    'utf8'
  )
  const urls = [...wsdl.matchAll(/<soap:address location="([^"]+)"/g)].map((m) => m[1])
  assert.equal(urls.length, 8)
  // Servicio sfVerifactu: orden del WSDL = prod normal, prod sello, pruebas normal, pruebas sello.
  assert.equal(ENDPOINTS_VERIFACTU.produccion.normal, urls[0])
  assert.equal(ENDPOINTS_VERIFACTU.produccion.sello, urls[1])
  assert.equal(ENDPOINTS_VERIFACTU.pruebas.normal, urls[2])
  assert.equal(ENDPOINTS_VERIFACTU.pruebas.sello, urls[3])
  // Servicio sfRequerimiento (V14), mismo orden.
  assert.equal(ENDPOINTS_REQUERIMIENTO.produccion.normal, urls[4])
  assert.equal(ENDPOINTS_REQUERIMIENTO.produccion.sello, urls[5])
  assert.equal(ENDPOINTS_REQUERIMIENTO.pruebas.normal, urls[6])
  assert.equal(ENDPOINTS_REQUERIMIENTO.pruebas.sello, urls[7])
})

test('urlRemision respeta entorno, tipo de certificado y override', () => {
  const cert = { certificado: CERT_FICTICIO }
  assert.equal(
    new ClienteAeat({ entorno: 'pruebas', ...cert }).urlRemision(),
    'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'
  )
  assert.equal(
    new ClienteAeat({ entorno: 'produccion', tipoCertificado: 'sello', ...cert }).urlRemision(),
    'https://www10.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'
  )
  assert.equal(
    new ClienteAeat({ entorno: 'pruebas', urlOverride: 'https://gateway.interno/verifactu', ...cert }).urlRemision(),
    'https://gateway.interno/verifactu'
  )
})

test('sin material de certificado el cliente no se construye', () => {
  assert.throws(() => new ClienteAeat({ entorno: 'pruebas', certificado: {} }), /certificado cliente/)
  assert.throws(() => new ClienteAeat({ entorno: 'pruebas', certificado: { cert: 'solo-cert' } }), /certificado cliente/)
})

// ---------------------------------------------------------------------------
// Parser XML ligero
// ---------------------------------------------------------------------------

test('xml-ligero: entidades, CDATA, comentarios y prefijos arbitrarios', () => {
  const raiz = parsearXml(
    `<?xml version="1.0"?><a:Raiz xmlns:a="urn:x" atrib="v&amp;1"><!-- c --><b:Hijo>uno &lt;2&gt; &#65;&#x42;</b:Hijo><Otro><![CDATA[<crudo & tal>]]></Otro></a:Raiz>`
  )
  assert.equal(raiz.nombre, 'Raiz')
  assert.equal(raiz.atributos.atrib, 'v&1')
  assert.equal(textoDe(raiz, 'Hijo'), 'uno <2> AB')
  assert.equal(hijo(raiz, 'Otro').texto, '<crudo & tal>')
})

test('xml-ligero: rechaza DOCTYPE (anti-XXE), entidades desconocidas y XML mal cerrado', () => {
  assert.throws(() => parsearXml('<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>'), ErrorXml)
  assert.throws(() => parsearXml('<a>&desconocida;</a>'), ErrorXml)
  assert.throws(() => parsearXml('<a><b></a>'), ErrorXml)
  assert.throws(() => parsearXml('<a></a><b></b>'), ErrorXml)
  assert.throws(() => parsearXml('solo texto'), ErrorXml)
})

// ---------------------------------------------------------------------------
// Envoltura SOAP del envío
// ---------------------------------------------------------------------------

function registroDePrueba() {
  return construirRegistroAlta(
    {
      emisor: { nif: 'B98407901', nombreRazon: 'Mercadonet Global S.L.' },
      numSerieFactura: 'F-2026-000123',
      fechaExpedicion: '2026-09-12',
      tipoFactura: 'F1',
      descripcionOperacion: 'Desarrollo web y mantenimiento mensual',
      destinatarios: [{ nombreRazon: 'Cliente Ejemplo S.L.', nif: 'A58818501' }],
      desglose: [
        { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 1000, cuotaRepercutida: 210 },
      ],
    },
    {
      encadenamiento: { primerRegistro: true },
      sistemaInformatico: sistemaInformaticoKuentas('KU-test-0001'),
      fechaGeneracion: new Date('2026-09-12T10:00:00+02:00'),
    }
  )
}

test('envolverSoap produce un Envelope 1.1 con el mensaje intacto', async () => {
  const cuerpo = xmlRegFactuSistemaFacturacion(
    { obligadoEmision: { nombreRazon: 'Mercadonet Global S.L.', nif: 'B98407901' }, incidencia: 'S' },
    [registroDePrueba().xml]
  )
  const sobre = envolverSoap(cuerpo)
  assert.ok(sobre.startsWith('<?xml version="1.0" encoding="UTF-8"?>'))
  assert.ok(sobre.includes(`<soapenv:Envelope xmlns:soapenv="${NS_SOAP_ENV}">`))
  assert.ok(sobre.includes(cuerpo), 'el mensaje debe ir tal cual dentro del Body')
  // El Envelope es XML bien formado y su Body contiene el mensaje de remisión.
  const raiz = parsearXml(sobre)
  assert.equal(raiz.nombre, 'Envelope')
  assert.ok(hijo(hijo(raiz, 'Body'), 'RegFactuSistemaFacturacion'))
  // Y el mensaje interior valida contra SuministroLR.xsd.
  const r = await validarEnvioXsd(cuerpo)
  assert.ok(r.valida, r.errores.join('\n'))
})

// ---------------------------------------------------------------------------
// Parseo de respuestas (fixtures validados contra el XSD oficial)
// ---------------------------------------------------------------------------

test('los fixtures de respuesta cumplen RespuestaSuministro.xsd', async () => {
  for (const fixture of [RESPUESTA_CORRECTA, RESPUESTA_PARCIAL, RESPUESTA_INCORRECTA]) {
    const r = await validarRespuestaXsd(fixture)
    assert.ok(r.valida, `fixture no válido contra el XSD:\n${r.errores.join('\n')}\n---\n${fixture}`)
  }
})

test('respuesta Correcto: CSV, presentación, tiempo de espera y línea aceptada', () => {
  const r = parsearRespuestaSoap(envolver(RESPUESTA_CORRECTA))
  assert.equal(r.estadoEnvio, 'Correcto')
  assert.equal(r.csv, 'CSVKUENTASPRUEBA01')
  assert.deepEqual(r.datosPresentacion, {
    nifPresentador: 'B98407901',
    timestampPresentacion: '2026-09-18T10:30:05+02:00',
  })
  assert.deepEqual(r.cabecera.obligadoEmision, { nombreRazon: 'Mercadonet Global S.L.', nif: 'B98407901' })
  assert.equal(r.tiempoEsperaEnvio, 60)
  assert.equal(r.lineas.length, 1)
  const linea = r.lineas[0]
  assert.deepEqual(linea.idFactura, {
    idEmisorFactura: 'B98407901',
    numSerieFactura: 'F-2026-000123',
    fechaExpedicionFactura: '12-09-2026',
  })
  assert.equal(linea.operacion.tipoOperacion, 'Alta')
  assert.equal(linea.estadoRegistro, 'Correcto')
  assert.equal(estadoInternoLinea(linea), 'accepted')
})

test('respuesta ParcialmenteCorrecto: estados por línea, errores y tiempo ajustado', () => {
  const r = parsearRespuestaSoap(envolver(RESPUESTA_PARCIAL))
  assert.equal(r.estadoEnvio, 'ParcialmenteCorrecto')
  assert.equal(r.tiempoEsperaEnvio, 120, 'debe obedecer el último TiempoEsperaEnvio recibido')
  assert.equal(r.lineas.length, 3)

  const [ok, conErrores, rechazada] = r.lineas
  assert.equal(estadoInternoLinea(ok), 'accepted')

  assert.equal(conErrores.estadoRegistro, 'AceptadoConErrores')
  assert.equal(conErrores.codigoErrorRegistro, 2001)
  assert.equal(conErrores.descripcionErrorRegistro, 'Error admisible: valor no censado.')
  assert.equal(estadoInternoLinea(conErrores), 'accepted_with_errors')

  assert.equal(rechazada.estadoRegistro, 'Incorrecto')
  assert.equal(rechazada.operacion.tipoOperacion, 'Anulacion')
  assert.equal(rechazada.operacion.rechazoPrevio, 'S')
  assert.equal(rechazada.refExterna, 'lote-77')
  assert.equal(rechazada.codigoErrorRegistro, 3002)
  assert.equal(estadoInternoLinea(rechazada), 'rejected')
  assert.equal(estadoSiDuplicado(rechazada), null)
})

test('respuesta Incorrecto: sin CSV y duplicado tratado de forma idempotente', () => {
  const r = parsearRespuestaSoap(envolver(RESPUESTA_INCORRECTA))
  assert.equal(r.estadoEnvio, 'Incorrecto')
  assert.equal(r.csv, undefined)
  assert.equal(r.datosPresentacion, undefined)
  const linea = r.lineas[0]
  assert.equal(linea.estadoRegistro, 'Incorrecto')
  assert.deepEqual(linea.registroDuplicado, {
    idPeticionRegistroDuplicado: '20260912-000000042',
    estadoRegistroDuplicado: 'Correcta',
  })
  // §5.4 SPEC: el reenvío de un registro ya almacenado como Correcta se da por aceptado.
  assert.equal(estadoSiDuplicado(linea), 'accepted')
})

test('SOAP Fault → ErrorSoapAeat con código y descripción', () => {
  assert.throws(
    () => parsearRespuestaSoap(FAULT),
    (e) =>
      e instanceof ErrorSoapAeat &&
      e.faultCode === 'env:Client' &&
      e.faultString.includes('Codigo[4102]') &&
      e.reintentable === false
  )
})

test('respuestas malformadas o incompletas → ErrorRespuestaAeat', () => {
  assert.throws(() => parsearRespuestaSoap('<html>pasarela</html>'), ErrorRespuestaAeat)
  assert.throws(() => parsearRespuestaSoap('no es xml'), ErrorRespuestaAeat)
  const sinTiempo = envolver(RESPUESTA_CORRECTA.replace(/\s*<sfR:TiempoEsperaEnvio>60<\/sfR:TiempoEsperaEnvio>/, ''))
  assert.throws(() => parsearRespuestaSoap(sinTiempo), /TiempoEsperaEnvio/)
  const estadoRaro = envolver(RESPUESTA_CORRECTA.replace('>Correcto</sfR:EstadoEnvio>', '>Regular</sfR:EstadoEnvio>'))
  assert.throws(() => parsearRespuestaSoap(estadoRaro), /EstadoEnvio/)
})

// ---------------------------------------------------------------------------
// Configuración por entorno
// ---------------------------------------------------------------------------

test('certificadoDesdeEnv: PFX, par PEM o nada', () => {
  const pfx = certificadoDesdeEnv({
    VERIFACTU_CERT_PFX_BASE64: CLIENTE_PFX.toString('base64'),
    VERIFACTU_CERT_PFX_PASSWORD: 'pruebas',
  })
  assert.ok(pfx.pfx.equals(CLIENTE_PFX))
  assert.equal(pfx.passphrase, 'pruebas')

  const pem = certificadoDesdeEnv({
    VERIFACTU_CERT_PEM_BASE64: CLIENTE_PEM.cert.toString('base64'),
    VERIFACTU_CERT_KEY_PEM_BASE64: CLIENTE_PEM.key.toString('base64'),
  })
  assert.ok(pem.cert.equals(CLIENTE_PEM.cert))
  assert.ok(pem.key.equals(CLIENTE_PEM.key))

  assert.equal(certificadoDesdeEnv({}), null)
})

test('configDesdeEnv: valores por defecto seguros y validación de entradas', () => {
  const base = { VERIFACTU_CERT_PFX_BASE64: CLIENTE_PFX.toString('base64'), VERIFACTU_CERT_PFX_PASSWORD: 'pruebas' }
  const config = configDesdeEnv(base)
  assert.equal(config.entorno, 'pruebas', 'producción debe ser opt-in explícito')
  assert.equal(config.tipoCertificado, 'normal')

  assert.throws(() => configDesdeEnv({ ...base, VERIFACTU_ENTORNO: 'prod' }), /VERIFACTU_ENTORNO/)
  assert.throws(() => configDesdeEnv({ ...base, VERIFACTU_CERT_TIPO: 'representante' }), /VERIFACTU_CERT_TIPO/)
  assert.throws(() => configDesdeEnv({ ...base, VERIFACTU_TIMEOUT_MS: 'mucho' }), /VERIFACTU_TIMEOUT_MS/)
  assert.throws(() => configDesdeEnv({}), /Certificado VERI\*FACTU no configurado/)
})

// ---------------------------------------------------------------------------
// Servidor mock HTTPS con mTLS (certificados de prueba autofirmados)
// ---------------------------------------------------------------------------

const RUTA_SOAP = '/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'
const servidores = []
after(() => Promise.all(servidores.map((s) => new Promise((r) => s.close(r)))))

/** Levanta un servidor HTTPS local que exige certificado cliente de la CA de prueba. */
function servidorMock(gestionar) {
  const servidor = createServer(
    { ...SERVIDOR, ca: CA_PRUEBA, requestCert: true, rejectUnauthorized: true },
    (req, res) => {
      const trozos = []
      req.on('data', (t) => trozos.push(t))
      req.on('end', () => gestionar(req, res, Buffer.concat(trozos).toString('utf8')))
    }
  )
  servidores.push(servidor)
  return new Promise((resolve) => {
    servidor.listen(0, '127.0.0.1', () => {
      resolve({ servidor, url: `https://127.0.0.1:${servidor.address().port}${RUTA_SOAP}` })
    })
  })
}

function clienteMock(url, certificado, extras = {}) {
  return new ClienteAeat({
    entorno: 'pruebas',
    certificado: { ...certificado, ca: CA_PRUEBA },
    urlOverride: url,
    ...extras,
  })
}

test('intercambio completo con mTLS (PFX): envío válido contra XSD y respuesta parseada', async () => {
  let capturada = null
  const { url } = await servidorMock((req, res, cuerpo) => {
    capturada = { metodo: req.method, ruta: req.url, cabeceras: req.headers, cuerpo }
    res.writeHead(200, { 'Content-Type': 'text/xml; charset=UTF-8' })
    res.end(envolver(RESPUESTA_CORRECTA))
  })

  const cliente = clienteMock(url, { pfx: CLIENTE_PFX, passphrase: 'pruebas' })
  const respuesta = await cliente.enviarRegistros(
    { obligadoEmision: { nombreRazon: 'Mercadonet Global S.L.', nif: 'B98407901' } },
    [registroDePrueba().xml]
  )

  assert.equal(respuesta.estadoEnvio, 'Correcto')
  assert.equal(respuesta.csv, 'CSVKUENTASPRUEBA01')
  assert.equal(respuesta.tiempoEsperaEnvio, 60)

  assert.equal(capturada.metodo, 'POST')
  assert.equal(capturada.ruta, RUTA_SOAP)
  assert.match(capturada.cabeceras['content-type'], /^text\/xml/)
  assert.equal(capturada.cabeceras.soapaction, '""')
  assert.equal(Number(capturada.cabeceras['content-length']), Buffer.byteLength(capturada.cuerpo))

  // Lo que viajó por el cable: Envelope bien formado cuyo mensaje interior
  // cumple el XSD oficial de envío.
  const raiz = parsearXml(capturada.cuerpo)
  const mensaje = hijo(hijo(raiz, 'Body'), 'RegFactuSistemaFacturacion')
  assert.ok(mensaje, 'el Body debe llevar RegFactuSistemaFacturacion')
  const inicio = capturada.cuerpo.indexOf('<sfLR:RegFactuSistemaFacturacion')
  const fin = capturada.cuerpo.indexOf('</sfLR:RegFactuSistemaFacturacion>') + '</sfLR:RegFactuSistemaFacturacion>'.length
  const r = await validarEnvioXsd(capturada.cuerpo.slice(inicio, fin))
  assert.ok(r.valida, r.errores.join('\n'))
})

test('mTLS con par PEM cert+key también autentica', async () => {
  const { url } = await servidorMock((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/xml' })
    res.end(envolver(RESPUESTA_CORRECTA))
  })
  const cliente = clienteMock(url, CLIENTE_PEM)
  const r = await cliente.enviarCuerpoXml(
    xmlRegFactuSistemaFacturacion({ obligadoEmision: { nombreRazon: 'Mercadonet Global S.L.', nif: 'B98407901' } }, [
      registroDePrueba().xml,
    ])
  )
  assert.equal(r.estadoEnvio, 'Correcto')
})

test('sin certificado cliente el servidor rechaza el handshake → ErrorTransporteAeat', async () => {
  const { url } = await servidorMock((req, res) => {
    res.writeHead(200)
    res.end('nunca debería llegar')
  })
  // Se salta ClienteAeat (que ya exige material) para probar el transporte puro.
  await assert.rejects(
    transporteHttpsNode({
      url,
      cuerpo: '<x/>',
      cabeceras: { 'Content-Type': 'text/xml' },
      timeoutMs: 5000,
      certificado: { ca: CA_PRUEBA },
    }),
    ErrorTransporteAeat
  )
})

test('timeout → ErrorTransporteAeat reintentable', async () => {
  const { url } = await servidorMock(() => {
    /* nunca responde */
  })
  const cliente = clienteMock(url, { pfx: CLIENTE_PFX, passphrase: 'pruebas' }, { timeoutMs: 400 })
  await assert.rejects(
    cliente.enviarRegistros({ obligadoEmision: { nombreRazon: 'Mercadonet Global S.L.', nif: 'B98407901' } }, [
      registroDePrueba().xml,
    ]),
    (e) => e instanceof ErrorTransporteAeat && e.reintentable && /timeout de 400 ms/.test(e.message)
  )
})

test('HTTP 500 con Fault SOAP → ErrorSoapAeat (no reintentable)', async () => {
  const { url } = await servidorMock((req, res) => {
    res.writeHead(500, { 'Content-Type': 'text/xml' })
    res.end(FAULT)
  })
  const cliente = clienteMock(url, { pfx: CLIENTE_PFX, passphrase: 'pruebas' })
  await assert.rejects(
    cliente.enviarCuerpoXml(
      xmlRegFactuSistemaFacturacion({ obligadoEmision: { nombreRazon: 'Mercadonet Global S.L.', nif: 'B98407901' } }, [
        registroDePrueba().xml,
      ])
    ),
    (e) => e instanceof ErrorSoapAeat && e.faultCode === 'env:Client'
  )
})

test('HTTP 503 sin SOAP → ErrorHttpAeat reintentable; 200 con basura → ErrorRespuestaAeat', async () => {
  const { url } = await servidorMock((req, res) => {
    if (req.headers['x-caso'] === 'basura') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html>mantenimiento</html>')
    } else {
      res.writeHead(503, { 'Content-Type': 'text/html' })
      res.end('<html>Service Unavailable</html>')
    }
  })
  const cuerpo = xmlRegFactuSistemaFacturacion(
    { obligadoEmision: { nombreRazon: 'Mercadonet Global S.L.', nif: 'B98407901' } },
    [registroDePrueba().xml]
  )
  const cliente = clienteMock(url, { pfx: CLIENTE_PFX, passphrase: 'pruebas' })
  await assert.rejects(
    cliente.enviarCuerpoXml(cuerpo),
    (e) => e instanceof ErrorHttpAeat && e.status === 503 && e.reintentable
  )

  // Mismo servidor, ahora 200 con cuerpo no SOAP: transporte propio para fijar la cabecera.
  const transporteConCaso = (p) =>
    transporteHttpsNode({ ...p, cabeceras: { ...p.cabeceras, 'X-Caso': 'basura' } })
  const cliente2 = new ClienteAeat(
    { entorno: 'pruebas', certificado: { pfx: CLIENTE_PFX, passphrase: 'pruebas', ca: CA_PRUEBA }, urlOverride: url },
    transporteConCaso
  )
  await assert.rejects(cliente2.enviarCuerpoXml(cuerpo), ErrorRespuestaAeat)
})
