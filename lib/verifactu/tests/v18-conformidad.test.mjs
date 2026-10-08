// ---------------------------------------------------------------------------
// V18 · Batería de conformidad: verificación OFFLINE del plan y del evaluador.
//
// Genera el plan real con scripts/verifactu-conformidad.mjs --plan (sin red) y
// comprueba: que todos los envelopes válidos cumplen los XSD oficiales, que el
// caso XSD-inválido efectivamente NO valida, que las manipulaciones están
// donde el plan dice, que las cadenas de huellas son íntegras (librería V04) y
// que el evaluador (--evaluar) da PASS/FAIL correctamente ante respuestas
// sintéticas conformes con RespuestaSuministro.xsd.
// ---------------------------------------------------------------------------

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validarEnvioXsd, validarRespuestaXsd } from './helpers/xsd-validator.mjs'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const SCRIPT = join(RAIZ, 'scripts', 'verifactu-conformidad.mjs')

const NS_SFR =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaSuministro.xsd'
const NS_SF =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd'

let dir
let plan

function cuerpoDeEnvelope(fichero) {
  const soap = readFileSync(join(dir, fichero), 'utf8')
  const m = /<(?:\w+:)?Body>([\s\S]*)<\/(?:\w+:)?Body>/.exec(soap)
  assert.ok(m, `no se pudo extraer el Body SOAP de ${fichero}`)
  return m[1].trim()
}

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'v18-conformidad-'))
  execFileSync(process.execPath, [SCRIPT, '--plan', dir], { stdio: 'pipe' })
  plan = JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8'))
})

test('el plan cubre los escenarios exigidos por V18/B8', () => {
  const ids = plan.pasos.map((p) => p.id.replace(/^\d+-/, ''))
  for (const esperado of [
    'alta-f2-basica',
    'alta-f2-multi-iva',
    'alta-f1-destinatario',
    'alta-f1-recargo',
    'rectificativa-r1',
    'anulacion',
    'envio-multiple',
    'duplicado-reintento',
    'rechazo-cuota',
    'subsanacion-rechazo',
    'aceptado-con-errores',
    'subsanacion-ace',
    'envio-xsd-invalido',
    'cotejo-qr',
  ]) {
    assert.ok(ids.includes(esperado), `falta el caso ${esperado}`)
  }
  assert.equal(plan.entorno, 'pruebas')
  assert.match(plan.urlEnvio, /^https:\/\/prewww1\.aeat\.es\//)
})

test('todos los envelopes salvo el caso XSD-inválido validan contra los XSD oficiales', async () => {
  for (const paso of plan.pasos) {
    if (!paso.fichero) continue
    const r = await validarEnvioXsd(cuerpoDeEnvelope(paso.fichero))
    if (paso.id.endsWith('envio-xsd-invalido')) {
      assert.equal(r.valida, false, `${paso.id} debería ser inválido a nivel XSD`)
    } else {
      assert.ok(r.valida, `${paso.id} no valida: ${r.errores.join(' · ')}`)
    }
  }
})

test('las manipulaciones deliberadas están presentes y son las anunciadas', () => {
  const porId = (sufijo) => plan.pasos.find((p) => p.id.endsWith(sufijo))

  // 09: cuota manipulada en el XML, huella intacta (usa CuotaTotal).
  const c09 = cuerpoDeEnvelope(porId('rechazo-cuota').fichero)
  assert.ok(c09.includes('<sf:CuotaRepercutida>90.00</sf:CuotaRepercutida>'))
  assert.ok(c09.includes('<sf:CuotaTotal>21.00</sf:CuotaTotal>'), 'CuotaTotal no debe manipularse')
  const meta09 = porId('rechazo-cuota').registros[0]
  assert.ok(c09.includes(`<sf:Huella>${meta09.huellaGenerada}</sf:Huella>`))

  // 11: huella corrompida; el plan registra generada y enviada distintas.
  const meta11 = porId('aceptado-con-errores').registros[0]
  assert.notEqual(meta11.huellaGenerada, meta11.huellaEnviada)
  const c11 = cuerpoDeEnvelope(porId('aceptado-con-errores').fichero)
  assert.ok(c11.includes(`<sf:Huella>${meta11.huellaEnviada}</sf:Huella>`))
  assert.ok(!c11.includes(`<sf:Huella>${meta11.huellaGenerada}</sf:Huella>`))

  // 10 y 12: flags de subsanación conforme al doc. de validaciones (1153/1161).
  const c10 = cuerpoDeEnvelope(porId('subsanacion-rechazo').fichero)
  assert.ok(c10.includes('<sf:Subsanacion>S</sf:Subsanacion>'))
  assert.ok(c10.includes('<sf:RechazoPrevio>S</sf:RechazoPrevio>'))
  const c12 = cuerpoDeEnvelope(porId('subsanacion-ace').fichero)
  assert.ok(c12.includes('<sf:Subsanacion>S</sf:Subsanacion>'))
  assert.ok(!c12.includes('<sf:RechazoPrevio>'), 'el caso 12 subsana un registro ACEPTADO: sin RechazoPrevio')

  // 08 (duplicado) reutiliza el envelope del 01, byte a byte.
  const dup = porId('duplicado-reintento')
  assert.equal(dup.fichero, null)
  assert.ok(dup.envelopeDe.endsWith('alta-f2-basica'))
})

test('las cadenas A y B se encadenan por la huella TRANSMITIDA del registro anterior', () => {
  // La cadena que verá la AEAT es la de huellas transmitidas: el bloque
  // RegistroAnterior de cada envelope debe apuntar a la huellaEnviada del
  // eslabón previo (incluidos los eslabones rechazados o manipulados, que
  // siguen formando parte de la cadena generada — flujo RechazoPrevio).
  for (const serie of ['A', 'B']) {
    const pasosCadena = plan.pasos.filter(
      (p) =>
        p.fichero &&
        !p.id.endsWith('envio-xsd-invalido') &&
        p.registros?.some((r) => r.numSerieFactura.startsWith(`PRUEBA-V18${serie}-`))
    )
    assert.ok(pasosCadena.length >= 4, `cadena ${serie} demasiado corta`)

    const eslabones = pasosCadena.flatMap((p) => p.registros.map((r) => ({ paso: p, registro: r })))
    // Primer eslabón: PrimerRegistro=S; el bloque XML de cada registro se
    // localiza por su huella transmitida (única por registro).
    const primerXml = cuerpoDeEnvelope(pasosCadena[0].fichero)
    assert.ok(primerXml.includes('<sf:PrimerRegistro>S</sf:PrimerRegistro>'), `cadena ${serie}: falta PrimerRegistro=S`)

    for (let i = 1; i < eslabones.length; i++) {
      const previa = eslabones[i - 1].registro.huellaEnviada
      const xml = cuerpoDeEnvelope(eslabones[i].paso.fichero)
      const bloque = xml
        .split('<sf:Huella>' + eslabones[i].registro.huellaEnviada + '</sf:Huella>')[0]
      const anterior = /<sf:RegistroAnterior>[\s\S]*?<sf:Huella>([0-9A-F]{64})<\/sf:Huella>[\s\S]*?<\/sf:RegistroAnterior>/g
      let m
      let ultima = null
      while ((m = anterior.exec(bloque)) !== null) ultima = m[1]
      assert.equal(
        ultima,
        previa,
        `cadena ${serie}, eslabón ${i} (${eslabones[i].registro.numSerieFactura}): RegistroAnterior no apunta a la huella transmitida del eslabón previo`
      )
    }
  }
})

/** Respuesta sintética conforme a RespuestaSuministro.xsd (mismo formato que V09). */
function respuestaSintetica(estadoEnvio, lineas, incluirCsv = true) {
  const cuerpo = lineas
    .map(
      (l) =>
        `\n    <sfR:RespuestaLinea>\n      <sfR:IDFactura>\n        <sf:IDEmisorFactura>B98407901</sf:IDEmisorFactura>\n        <sf:NumSerieFactura>${l.num}</sf:NumSerieFactura>\n        <sf:FechaExpedicionFactura>${l.fecha}</sf:FechaExpedicionFactura>\n      </sfR:IDFactura>\n      <sfR:Operacion>\n        <sf:TipoOperacion>${l.op ?? 'Alta'}</sf:TipoOperacion>\n      </sfR:Operacion>\n      <sfR:EstadoRegistro>${l.estado}</sfR:EstadoRegistro>${l.codigo ? `\n      <sfR:CodigoErrorRegistro>${l.codigo}</sfR:CodigoErrorRegistro>` : ''}${l.duplicado ? `\n      <sfR:RegistroDuplicado>\n        <sf:IdPeticionRegistroDuplicado>20260920-000000001</sf:IdPeticionRegistroDuplicado>\n        <sf:EstadoRegistroDuplicado>${l.duplicado}</sf:EstadoRegistroDuplicado>\n      </sfR:RegistroDuplicado>` : ''}\n    </sfR:RespuestaLinea>`
    )
    .join('')
  return (
    `<sfR:RespuestaRegFactuSistemaFacturacion xmlns:sfR="${NS_SFR}" xmlns:sf="${NS_SF}">\n` +
    `${incluirCsv ? '  <sfR:CSV>A-TESTCSVV18XXXX</sfR:CSV>\n' : ''}` +
    `  <sfR:Cabecera><sf:ObligadoEmision><sf:NombreRazon>Mercadonet Global S.L.</sf:NombreRazon><sf:NIF>B98407901</sf:NIF></sf:ObligadoEmision></sfR:Cabecera>\n` +
    `  <sfR:TiempoEsperaEnvio>60</sfR:TiempoEsperaEnvio>\n` +
    `  <sfR:EstadoEnvio>${estadoEnvio}</sfR:EstadoEnvio>${cuerpo}\n` +
    `</sfR:RespuestaRegFactuSistemaFacturacion>`
  )
}

function envolverSoapSintetico(xml) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>${xml}</env:Body></env:Envelope>`
}

test('el evaluador da PASS con respuestas correctas sintéticas y FAIL si el resultado difiere', () => {
  // Copia del plan a un directorio de trabajo del evaluador.
  const dirEval = mkdtempSync(join(tmpdir(), 'v18-eval-'))
  cpSync(dir, dirEval, { recursive: true })

  const fault = `<?xml version="1.0" encoding="UTF-8"?>\n<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><env:Fault><faultcode>env:Client</faultcode><faultstring>Codigo[4102].El XML no cumple el esquema. Falta informar campo obligatorio.</faultstring></env:Fault></env:Body></env:Envelope>`

  for (const paso of plan.pasos) {
    if (paso.tipo === 'cotejo') {
      writeFileSync(join(dirEval, `${paso.id}.respuesta.html`), '<html><body>Factura Encontrada</body></html>', 'utf8')
      continue
    }
    if (paso.id.endsWith('envio-xsd-invalido')) {
      writeFileSync(join(dirEval, `${paso.id}.respuesta.xml`), fault, 'utf8')
      continue
    }
    const lineas = paso.registros.map((r) => {
      const base = { num: r.numSerieFactura, fecha: r.fechaExpedicionFactura, op: r.tipo === 'anulacion' ? 'Anulacion' : 'Alta' }
      if (paso.id.endsWith('duplicado-reintento')) return { ...base, estado: 'Incorrecto', codigo: 3000, duplicado: 'Correcta' }
      if (paso.id.endsWith('rechazo-cuota')) return { ...base, estado: 'Incorrecto', codigo: 1142 }
      if (paso.id.endsWith('aceptado-con-errores')) return { ...base, estado: 'AceptadoConErrores', codigo: 2000 }
      return { ...base, estado: 'Correcto' }
    })
    const estadoEnvio = lineas.every((l) => l.estado === 'Correcto')
      ? 'Correcto'
      : lineas.some((l) => l.estado !== 'Incorrecto')
        ? 'ParcialmenteCorrecto'
        : 'Incorrecto'
    writeFileSync(
      join(dirEval, `${paso.id}.respuesta.xml`),
      envolverSoapSintetico(respuestaSintetica(estadoEnvio, lineas, estadoEnvio !== 'Incorrecto')),
      'utf8'
    )
  }

  const ok = spawnSync(process.execPath, [SCRIPT, '--evaluar', dirEval], { encoding: 'utf8' })
  assert.equal(ok.status, 0, `evaluación esperada CONFORME:\n${ok.stdout}\n${ok.stderr}`)
  const informe = JSON.parse(readFileSync(join(dirEval, 'resultado.json'), 'utf8'))
  assert.equal(informe.resultado, 'CONFORME')
  assert.equal(informe.superados, informe.total)

  // Y si la AEAT «aceptara» el caso de rechazo, la batería debe dar NO CONFORME.
  const pasoRechazo = plan.pasos.find((p) => p.id.endsWith('rechazo-cuota'))
  writeFileSync(
    join(dirEval, `${pasoRechazo.id}.respuesta.xml`),
    envolverSoapSintetico(
      respuestaSintetica('Correcto', [
        { num: pasoRechazo.registros[0].numSerieFactura, fecha: pasoRechazo.registros[0].fechaExpedicionFactura, estado: 'Correcto' },
      ])
    ),
    'utf8'
  )
  const mal = spawnSync(process.execPath, [SCRIPT, '--evaluar', dirEval], { encoding: 'utf8' })
  assert.equal(mal.status, 1, 'un resultado inesperado debe marcar la batería como NO CONFORME')
})

test('las respuestas sintéticas del test anterior validan contra RespuestaSuministro.xsd', async () => {
  // Autochequeo del generador de fixtures: si el formato sintético se desvía
  // del XSD oficial, el test del evaluador estaría probando contra fantasmas.
  const casos = [
    respuestaSintetica('Correcto', [{ num: 'PRUEBA-V18A-X-01', fecha: '20-09-2026', estado: 'Correcto' }]),
    respuestaSintetica(
      'Incorrecto',
      [{ num: 'PRUEBA-V18A-X-01', fecha: '20-09-2026', estado: 'Incorrecto', codigo: 3000, duplicado: 'Correcta' }],
      false
    ),
    respuestaSintetica(
      'ParcialmenteCorrecto',
      [{ num: 'PRUEBA-V18B-X-11', fecha: '20-09-2026', estado: 'AceptadoConErrores', codigo: 2000 }]
    ),
  ]
  for (const xml of casos) {
    const r = await validarRespuestaXsd(xml)
    assert.ok(r.valida, r.errores.join(' · '))
  }
})
