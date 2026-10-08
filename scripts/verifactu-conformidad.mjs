#!/usr/bin/env node
// ---------------------------------------------------------------------------
// V18 · Batería de conformidad E2E contra el entorno de PRUEBAS de la AEAT.
//
// Genera un PLAN determinista de casos (todos los XML y huellas se calculan
// en local, sin red) y, tras remitirlos al portal de pruebas, EVALÚA las
// respuestas contra el resultado esperado usando el catálogo oficial de
// validaciones y errores (lib/verifactu/errores-aeat.ts).
//
//   node scripts/verifactu-conformidad.mjs --plan <dir>     → genera envelopes + plan.json (sin red)
//   node scripts/verifactu-conformidad.mjs --evaluar <dir>  → evalúa las respuestas guardadas
//
// La remisión con el certificado del almacén de Windows (clave no exportable)
// la orquesta scripts/verifactu-conformidad.ps1 (curl backend Schannel), que
// respeta el TiempoEsperaEnvio entre envíos (art. 16 Orden HAC/1177/2024).
//
// Cobertura (plan maestro B8 y queue V18): alta simple, todos los tipos de
// IVA (21/10/4 + exenta E1 + no sujeta N1), recargo de equivalencia, F1 con
// destinatario, rectificativa R1, anulación, envío múltiple encadenado,
// duplicado idempotente (reintento tras caída), rechazo por validación,
// reanudación de cadena tras rechazo (Subsanacion+RechazoPrevio), registro
// aceptado con errores y su subsanación, y rechazo del envío completo (XSD).
//
// Los casos de error se fabrican MANIPULANDO el XML tras generarlo, porque
// la librería V05 se niega a construir registros inválidos (eso también es
// parte de la conformidad y está cubierto por los tests de V05). Cada
// manipulación queda anotada en el plan y en el informe.
//
// SOLO entorno de pruebas: el registro es inequívocamente de prueba (series
// PRUEBA-V18*, descripción explícita) y el script aborta si
// VERIFACTU_ENTORNO=produccion.
// ---------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  construirRegistroAlta,
  xmlRegFactuSistemaFacturacion,
  sistemaInformaticoKuentas,
} from '../lib/verifactu/registro-alta.ts'
import { construirRegistroAnulacion } from '../lib/verifactu/registro-anulacion.ts'
import {
  ENDPOINTS_VERIFACTU,
  envolverSoap,
  parsearRespuestaSoap,
  estadoSiDuplicado,
  ErrorSoapAeat,
} from '../lib/verifactu/aeat-cliente.ts'
import { construirUrlCotejo } from '../lib/verifactu/qr.ts'
import { descripcionErrorAeat, errorAeat } from '../lib/verifactu/errores-aeat.ts'

const OBLIGADO = { nif: 'B98407901', nombreRazon: 'Mercadonet Global S.L.' }
// Destinatario de pruebas para F1/R1: el administrador de Mercadonet (persona
// real censada; el entorno de pruebas no tiene efectos tributarios). Si el
// censo de preproducción no lo identificara, la AEAT responde 2001
// (AceptadoConErrores), que el plan admite y documenta.
const DESTINATARIO_PRUEBAS = { nombreRazon: 'IVAN ESCUDERO SALAS', nif: '45484023M' }
const NUMERO_INSTALACION = 'KU-PRUEBAS-V18'
const DESCRIPCION = 'Bateria de conformidad VERI*FACTU (Kuentas V18). Sin efectos tributarios.'
/** Espera entre envíos (TiempoEsperaEnvio observado en pruebas = 60 s + margen). */
const ESPERA_ENTRE_ENVIOS_S = 65

// --- Utilidades ----------------------------------------------------------------
function marcaDeTiempo() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function fechaHoyOficial() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`
}

/** Cambia el último carácter hex de la huella (fabrica el error 2000). */
function corromperHuella(huella) {
  const ultimo = huella.slice(-1)
  return huella.slice(0, -1) + (ultimo === '0' ? '1' : '0')
}

function reemplazarUnico(xml, buscar, reemplazo, caso) {
  const primera = xml.indexOf(buscar)
  if (primera === -1) throw new Error(`${caso}: no se encontró «${buscar}» en el XML a manipular`)
  if (xml.indexOf(buscar, primera + 1) !== -1) {
    throw new Error(`${caso}: «${buscar}» aparece más de una vez; la manipulación sería ambigua`)
  }
  return xml.replace(buscar, reemplazo)
}

// --- Construcción del plan --------------------------------------------------------
function construirPlan(dir) {
  const ts = marcaDeTiempo()
  const fechaHoy = fechaHoyOficial()
  const sistema = sistemaInformaticoKuentas(NUMERO_INSTALACION)
  const serieA = `PRUEBA-V18A-${ts}` // cadena principal
  const serieB = `PRUEBA-V18B-${ts}` // cadena de casos de error
  const serieC = `PRUEBA-V18C-${ts}` // envío inválido a nivel XSD (nunca se registra)

  /** Huella del último registro GENERADO de cada cadena (tal como se transmite). */
  const cadenas = {}

  function encadenar(cadena, registro, huellaEnviada) {
    cadenas[cadena] = {
      idEmisorFactura: OBLIGADO.nif,
      numSerieFactura: registro.numSerieFactura ?? registro.numSerieFacturaAnulada,
      fechaExpedicion: registro.fechaExpedicionFactura ?? registro.fechaExpedicionFacturaAnulada,
      huella: huellaEnviada ?? registro.huella,
    }
  }

  function opciones(cadena) {
    return {
      encadenamiento: cadenas[cadena] ? { registroAnterior: cadenas[cadena] } : { primerRegistro: true },
      sistemaInformatico: sistema,
    }
  }

  function alta(cadena, numSerieFactura, entradaParcial) {
    const registro = construirRegistroAlta(
      {
        emisor: OBLIGADO,
        numSerieFactura,
        fechaExpedicion: fechaHoy,
        descripcionOperacion: DESCRIPCION,
        ...entradaParcial,
      },
      opciones(cadena)
    )
    return registro
  }

  const pasos = []
  let orden = 0

  function paso(id, titulo, registrosMeta, xmlRegistros, esperado, extra = {}) {
    orden += 1
    const num = String(orden).padStart(2, '0')
    const ficheroBase = `${num}-${id}`
    let fichero = null
    if (xmlRegistros) {
      fichero = `${ficheroBase}.envelope.xml`
      const cuerpo = xmlRegFactuSistemaFacturacion({ obligadoEmision: OBLIGADO }, xmlRegistros)
      writeFileSync(join(dir, fichero), envolverSoap(cuerpo), 'utf8')
    }
    pasos.push({ orden, id: ficheroBase, titulo, fichero, registros: registrosMeta, esperado, ...extra })
    return ficheroBase
  }

  const metaAlta = (r, extra = {}) => ({
    tipo: 'alta',
    numSerieFactura: r.numSerieFactura,
    fechaExpedicionFactura: r.fechaExpedicionFactura,
    importeTotal: r.importeTotal,
    cuotaTotal: r.cuotaTotal,
    huellaGenerada: r.huella,
    huellaEnviada: extra.huellaEnviada ?? r.huella,
    ...extra,
  })

  const soloCorrecto = { estadoEnvio: ['Correcto'], lineas: [{ estados: ['Correcto'], codigos: [] }] }
  /** Casos que sondean el censo del destinatario: se admite 2001 (ACE). */
  const correctoOCenso = {
    estadoEnvio: ['Correcto', 'ParcialmenteCorrecto'],
    lineas: [{ estados: ['Correcto', 'AceptadoConErrores'], codigos: [2001] }],
  }

  // ---- Cadena A: flujo feliz -----------------------------------------------------
  // 01 · Alta simple F2 (primer registro de la cadena).
  const r01 = alta('A', `${serieA}-01`, {
    tipoFactura: 'F2',
    desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 10, cuotaRepercutida: 2.1 }],
  })
  encadenar('A', r01)
  paso('alta-f2-basica', 'Alta simple F2 (21%), primer registro de cadena', [metaAlta(r01)], [r01.xml], soloCorrecto)

  // 02 · Alta F2 con todos los tratamientos de IVA: 21/10/4, exenta E1 y no sujeta N1.
  const r02 = alta('A', `${serieA}-02`, {
    tipoFactura: 'F2',
    desglose: [
      { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 100, cuotaRepercutida: 21 },
      { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 10, baseImponible: 50, cuotaRepercutida: 5 },
      { claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 4, baseImponible: 25, cuotaRepercutida: 1 },
      { claveRegimen: '01', operacionExenta: 'E1', baseImponible: 40 },
      { claveRegimen: '01', calificacionOperacion: 'N1', baseImponible: 30 },
    ],
  })
  encadenar('A', r02)
  paso('alta-f2-multi-iva', 'Alta F2 multi-desglose: 21%, 10%, 4%, exenta E1 y no sujeta N1', [metaAlta(r02)], [r02.xml], soloCorrecto)

  // 03 · Alta F1 completa con destinatario identificado por NIF.
  const r03 = alta('A', `${serieA}-03`, {
    tipoFactura: 'F1',
    destinatarios: [DESTINATARIO_PRUEBAS],
    desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 200, cuotaRepercutida: 42 }],
  })
  encadenar('A', r03)
  paso('alta-f1-destinatario', 'Alta F1 con destinatario NIF (sondeo de censo)', [metaAlta(r03)], [r03.xml], correctoOCenso)

  // 04 · Alta F1 con recargo de equivalencia (régimen 18; 21% → recargo 5,2%).
  const r04 = alta('A', `${serieA}-04`, {
    tipoFactura: 'F1',
    destinatarios: [DESTINATARIO_PRUEBAS],
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
  encadenar('A', r04)
  paso('alta-f1-recargo', 'Alta F1 con recargo de equivalencia (21% + 5,2%)', [metaAlta(r04)], [r04.xml], correctoOCenso)

  // 05 · Rectificativa R1 por diferencias sobre la factura 03.
  const r05 = alta('A', `${serieA}-05`, {
    tipoFactura: 'R1',
    tipoRectificativa: 'I',
    facturasRectificadas: [{ numSerieFactura: r03.numSerieFactura, fechaExpedicion: r03.fechaExpedicionFactura }],
    destinatarios: [DESTINATARIO_PRUEBAS],
    desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 10, cuotaRepercutida: 2.1 }],
  })
  encadenar('A', r05)
  paso('rectificativa-r1', 'Rectificativa R1 por diferencias de la factura 03', [metaAlta(r05)], [r05.xml], correctoOCenso)

  // 06 · Anulación de la factura 02.
  const r06 = construirRegistroAnulacion(
    {
      emisor: { nif: OBLIGADO.nif },
      numSerieFacturaAnulada: r02.numSerieFactura,
      fechaExpedicionFacturaAnulada: r02.fechaExpedicionFactura,
    },
    opciones('A')
  )
  encadenar('A', r06)
  paso(
    'anulacion',
    'Anulación de la factura 02',
    [
      {
        tipo: 'anulacion',
        numSerieFactura: r06.numSerieFacturaAnulada,
        fechaExpedicionFactura: r06.fechaExpedicionFacturaAnulada,
        huellaGenerada: r06.huella,
        huellaEnviada: r06.huella,
      },
    ],
    [r06.xml],
    soloCorrecto
  )

  // 07 · Envío múltiple: dos altas encadenadas en un mismo RegFactu.
  const r07a = alta('A', `${serieA}-07A`, {
    tipoFactura: 'F2',
    desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 10, baseImponible: 20, cuotaRepercutida: 2 }],
  })
  encadenar('A', r07a)
  const r07b = alta('A', `${serieA}-07B`, {
    tipoFactura: 'F2',
    desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 4, baseImponible: 20, cuotaRepercutida: 0.8 }],
  })
  encadenar('A', r07b)
  paso(
    'envio-multiple',
    'Envío múltiple: dos altas encadenadas en un solo RegFactuSistemaFacturacion',
    [metaAlta(r07a), metaAlta(r07b)],
    [r07a.xml, r07b.xml],
    { estadoEnvio: ['Correcto'], lineas: [{ estados: ['Correcto'], codigos: [] }, { estados: ['Correcto'], codigos: [] }] }
  )

  // 08 · Duplicado (reintento tras caída): se reenvía el envelope del paso 01.
  paso(
    'duplicado-reintento',
    'Reenvío del envelope del paso 01 (reintento tras caída → duplicado idempotente)',
    [metaAlta(r01)],
    null,
    {
      estadoEnvio: ['Incorrecto'],
      lineas: [{ estados: ['Incorrecto'], codigos: [3000], duplicadoEsperado: true }],
    },
    { envelopeDe: '01-alta-f2-basica' }
  )

  // ---- Cadena B: errores y reanudación de cadena -----------------------------------
  // 09 · Rechazo por validación: CuotaRepercutida manipulada tras generar el XML
  //      (100 × 21% ≠ 90) → 1142/1216. La huella NO se toca (usa CuotaTotal).
  const r09 = alta('B', `${serieB}-09`, {
    tipoFactura: 'F2',
    desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 100, cuotaRepercutida: 21 }],
  })
  encadenar('B', r09)
  const xml09 = reemplazarUnico(
    r09.xml,
    '<sf:CuotaRepercutida>21.00</sf:CuotaRepercutida>',
    '<sf:CuotaRepercutida>90.00</sf:CuotaRepercutida>',
    'caso 09'
  )
  paso(
    'rechazo-cuota',
    'Rechazo esperado: CuotaRepercutida incoherente con base×tipo (manipulada tras generar)',
    [metaAlta(r09, { manipulacion: 'CuotaRepercutida 21.00 → 90.00 (la huella usa CuotaTotal y no se altera)' })],
    [xml09],
    { estadoEnvio: ['Incorrecto'], lineas: [{ estados: ['Incorrecto'], codigos: [1142, 1143, 1216, 1210] }] }
  )

  // 10 · Reanudación de cadena tras rechazo: mismo IDFactura corregido con
  //      Subsanacion=S + RechazoPrevio=S, encadenado al registro rechazado.
  const r10 = alta('B', r09.numSerieFactura, {
    tipoFactura: 'F2',
    subsanacion: 'S',
    rechazoPrevio: 'S',
    desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 100, cuotaRepercutida: 21 }],
  })
  encadenar('B', r10)
  paso(
    'subsanacion-rechazo',
    'Reenvío corregido del caso 09 (Subsanacion=S, RechazoPrevio=S): la cadena se reanuda',
    [metaAlta(r10, { subsanacion: 'S', rechazoPrevio: 'S' })],
    [r10.xml],
    { estadoEnvio: ['Correcto', 'ParcialmenteCorrecto'], lineas: [{ estados: ['Correcto', 'AceptadoConErrores'], codigos: [] }] }
  )

  // 11 · Aceptado con errores: huella corrompida tras generar (→ 2000). El
  //      registro queda REGISTRADO en la AEAT y debe subsanarse (V12).
  const r11 = alta('B', `${serieB}-11`, {
    tipoFactura: 'F2',
    desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 30, cuotaRepercutida: 6.3 }],
  })
  const huella11Enviada = corromperHuella(r11.huella)
  encadenar('B', r11, huella11Enviada)
  const xml11 = reemplazarUnico(
    r11.xml,
    `<sf:Huella>${r11.huella}</sf:Huella>`,
    `<sf:Huella>${huella11Enviada}</sf:Huella>`,
    'caso 11'
  )
  paso(
    'aceptado-con-errores',
    'Aceptado con errores esperado: huella corrompida tras generar (código 2000)',
    [metaAlta(r11, { huellaEnviada: huella11Enviada, manipulacion: 'Último carácter de la huella alterado' })],
    [xml11],
    {
      estadoEnvio: ['ParcialmenteCorrecto', 'Correcto'],
      lineas: [{ estados: ['AceptadoConErrores'], codigos: [2000, 2002, 2003] }],
    }
  )

  // 12 · Subsanación del aceptado con errores: mismo IDFactura, huella correcta,
  //      Subsanacion=S (sin RechazoPrevio: el registro 11 SÍ está registrado).
  const r12 = alta('B', r11.numSerieFactura, {
    tipoFactura: 'F2',
    subsanacion: 'S',
    desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 30, cuotaRepercutida: 6.3 }],
  })
  encadenar('B', r12)
  paso(
    'subsanacion-ace',
    'Subsanación del caso 11 (Subsanacion=S): sustituye al registro aceptado con errores',
    [metaAlta(r12, { subsanacion: 'S' })],
    [r12.xml],
    { estadoEnvio: ['Correcto', 'ParcialmenteCorrecto'], lineas: [{ estados: ['Correcto', 'AceptadoConErrores'], codigos: [2003, 2008] }] }
  )

  // ---- Caso C: envío rechazado completo (XML fuera de esquema) ---------------------
  const r13 = construirRegistroAlta(
    {
      emisor: OBLIGADO,
      numSerieFactura: `${serieC}-13`,
      fechaExpedicion: fechaHoy,
      tipoFactura: 'F2',
      descripcionOperacion: DESCRIPCION,
      desglose: [{ claveRegimen: '01', calificacionOperacion: 'S1', tipoImpositivo: 21, baseImponible: 5, cuotaRepercutida: 1.05 }],
    },
    { encadenamiento: { primerRegistro: true }, sistemaInformatico: sistema }
  )
  const xml13 = reemplazarUnico(
    r13.xml,
    '<sf:CalificacionOperacion>S1</sf:CalificacionOperacion>',
    '<sf:CalificacionOperacion>XX</sf:CalificacionOperacion>',
    'caso 13'
  )
  paso(
    'envio-xsd-invalido',
    'Rechazo del envío completo esperado: CalificacionOperacion fuera del esquema (manipulada)',
    [metaAlta(r13, { manipulacion: 'CalificacionOperacion S1 → XX (rompe el XSD)' })],
    [xml13],
    { faultAceptable: true, estadoEnvio: ['Incorrecto'], codigosEnvio: [4102, 4103], lineas: [{ estados: ['Incorrecto'], codigos: [4102, 4103, 1181] }] }
  )

  // ---- Cotejo QR público del caso 01 (tras la remisión) -----------------------------
  orden += 1
  pasos.push({
    orden,
    id: `${String(orden).padStart(2, '0')}-cotejo-qr`,
    titulo: 'Cotejo público del caso 01 en el servicio ValidarQR de pruebas',
    tipo: 'cotejo',
    url: construirUrlCotejo(
      { nif: OBLIGADO.nif, numSerie: r01.numSerieFactura, fecha: r01.fechaExpedicionFactura, importe: r01.importeTotal },
      'pruebas'
    ),
    esperado: { textoEsperado: 'Encontrada', textoProhibido: 'No encontrada' },
  })

  const plan = {
    version: 'V18',
    generado: new Date().toISOString(),
    entorno: 'pruebas',
    urlEnvio: ENDPOINTS_VERIFACTU.pruebas.normal,
    obligado: OBLIGADO,
    numeroInstalacion: NUMERO_INSTALACION,
    esperaEntreEnviosS: ESPERA_ENTRE_ENVIOS_S,
    series: { A: serieA, B: serieB, C: serieC },
    pasos,
  }
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2), 'utf8')
  return plan
}

// --- Evaluación --------------------------------------------------------------------
function evaluarLinea(esperadoLinea, linea) {
  const problemas = []
  if (!esperadoLinea.estados.includes(linea.estadoRegistro)) {
    problemas.push(`estadoRegistro «${linea.estadoRegistro}» ∉ {${esperadoLinea.estados.join(', ')}}`)
  }
  if (linea.codigoErrorRegistro !== undefined && esperadoLinea.codigos.length > 0) {
    if (!esperadoLinea.codigos.includes(linea.codigoErrorRegistro)) {
      problemas.push(
        `código ${descripcionErrorAeat(linea.codigoErrorRegistro)} ∉ {${esperadoLinea.codigos.join(', ')}}`
      )
    }
  }
  if (linea.estadoRegistro !== 'Correcto' && linea.codigoErrorRegistro === undefined) {
    problemas.push('estado no Correcto sin código de error')
  }
  if (esperadoLinea.duplicadoEsperado) {
    if (!linea.registroDuplicado) problemas.push('se esperaba RegistroDuplicado en la respuesta')
    else if (estadoSiDuplicado(linea) !== 'accepted') {
      problemas.push(`estadoSiDuplicado devolvió «${estadoSiDuplicado(linea)}» (esperado accepted)`)
    }
  }
  return problemas
}

function evaluarPaso(paso, dir) {
  const resultado = { id: paso.id, titulo: paso.titulo, ok: false, observado: {}, problemas: [] }

  if (paso.tipo === 'cotejo') {
    const fichero = join(dir, `${paso.id}.respuesta.html`)
    if (!existsSync(fichero)) {
      resultado.problemas.push('sin respuesta guardada (¿se ejecutó el cotejo?)')
      return resultado
    }
    const html = readFileSync(fichero, 'utf8')
    const prohibido = html.includes(paso.esperado.textoProhibido)
    const encontrado = !prohibido && html.includes(paso.esperado.textoEsperado)
    resultado.observado = { cotejo: prohibido ? paso.esperado.textoProhibido : encontrado ? paso.esperado.textoEsperado : 'sin coincidencia' }
    if (!encontrado) resultado.problemas.push(`el cotejo no devolvió «${paso.esperado.textoEsperado}»`)
    resultado.ok = resultado.problemas.length === 0
    return resultado
  }

  const fichero = join(dir, `${paso.id}.respuesta.xml`)
  if (!existsSync(fichero)) {
    resultado.problemas.push('sin respuesta guardada (¿se ejecutó la remisión?)')
    return resultado
  }
  const xml = readFileSync(fichero, 'utf8')

  let respuesta
  try {
    respuesta = parsearRespuestaSoap(xml)
  } catch (e) {
    if (e instanceof ErrorSoapAeat && paso.esperado.faultAceptable) {
      const codigos = (paso.esperado.codigosEnvio ?? []).filter((c) => `${e.faultString} ${e.detalle ?? ''}`.includes(String(c)))
      resultado.observado = { fault: `${e.faultCode}: ${e.faultString}`, codigosDetectados: codigos }
      resultado.ok = true
      return resultado
    }
    resultado.problemas.push(`respuesta no interpretable: ${e instanceof Error ? e.message : e}`)
    return resultado
  }

  resultado.observado = {
    estadoEnvio: respuesta.estadoEnvio,
    csv: respuesta.csv ?? null,
    tiempoEsperaEnvio: respuesta.tiempoEsperaEnvio,
    lineas: respuesta.lineas.map((l) => ({
      idFactura: `${l.idFactura.numSerieFactura} (${l.idFactura.fechaExpedicionFactura})`,
      operacion: l.operacion.tipoOperacion,
      estadoRegistro: l.estadoRegistro,
      error: l.codigoErrorRegistro !== undefined ? descripcionErrorAeat(l.codigoErrorRegistro) : null,
      ambitoError: l.codigoErrorRegistro !== undefined ? (errorAeat(l.codigoErrorRegistro)?.ambito ?? 'no_catalogado') : null,
      duplicado: l.registroDuplicado ? l.registroDuplicado.estadoRegistroDuplicado : null,
    })),
  }

  if (!paso.esperado.estadoEnvio.includes(respuesta.estadoEnvio)) {
    resultado.problemas.push(`estadoEnvio «${respuesta.estadoEnvio}» ∉ {${paso.esperado.estadoEnvio.join(', ')}}`)
  }
  const esperadas = paso.esperado.lineas ?? []
  if (paso.esperado.faultAceptable && respuesta.lineas.length === 0) {
    // Rechazo de envío completo devuelto como respuesta sin líneas: aceptable.
  } else if (respuesta.lineas.length !== esperadas.length) {
    resultado.problemas.push(`líneas: ${respuesta.lineas.length} (esperadas ${esperadas.length})`)
  } else {
    esperadas.forEach((esp, i) => {
      for (const p of evaluarLinea(esp, respuesta.lineas[i])) {
        resultado.problemas.push(`línea ${i + 1}: ${p}`)
      }
    })
  }
  resultado.ok = resultado.problemas.length === 0
  return resultado
}

function evaluar(dir, json) {
  const plan = JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8'))
  const resultados = plan.pasos.map((p) => evaluarPaso(p, dir))
  const ok = resultados.filter((r) => r.ok).length

  const informe = {
    version: plan.version,
    generado: plan.generado,
    evaluado: new Date().toISOString(),
    series: plan.series,
    total: resultados.length,
    superados: ok,
    resultado: ok === resultados.length ? 'CONFORME' : 'NO CONFORME',
    casos: resultados,
  }
  writeFileSync(join(dir, 'resultado.json'), JSON.stringify(informe, null, 2), 'utf8')

  if (json) {
    console.log(JSON.stringify(informe, null, 2))
  } else {
    console.log(`--- Batería de conformidad V18 · ${informe.resultado} (${ok}/${resultados.length}) ---`)
    for (const r of resultados) {
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id} · ${r.titulo}`)
      const obs = r.observado
      if (obs.estadoEnvio) {
        console.log(`      EstadoEnvio ${obs.estadoEnvio}${obs.csv ? ` · CSV ${obs.csv}` : ''}`)
        for (const l of obs.lineas ?? []) {
          console.log(
            `      · ${l.operacion} ${l.idFactura} → ${l.estadoRegistro}${l.error ? ` ${l.error}` : ''}${l.duplicado ? ` (duplicado: ${l.duplicado})` : ''}`
          )
        }
      } else if (obs.fault) {
        console.log(`      SOAP Fault: ${obs.fault}`)
      } else if (obs.cotejo) {
        console.log(`      Cotejo: ${obs.cotejo}`)
      }
      for (const p of r.problemas) console.log(`      !! ${p}`)
    }
    console.log(`Informe completo: ${join(dir, 'resultado.json')}`)
  }
  return informe.resultado === 'CONFORME' ? 0 : 1
}

// --- Programa -----------------------------------------------------------------------
function main() {
  const argv = process.argv
  if (process.env.VERIFACTU_ENTORNO === 'produccion') {
    console.error('VERIFACTU_ENTORNO=produccion detectado: la batería de conformidad es SOLO para el entorno de pruebas.')
    process.exit(2)
  }
  const idx = (flag) => argv.indexOf(flag)
  if (idx('--plan') !== -1) {
    const dir = argv[idx('--plan') + 1]
    if (!dir) {
      console.error('--plan requiere un directorio de salida')
      process.exit(2)
    }
    mkdirSync(dir, { recursive: true })
    const plan = construirPlan(dir)
    console.log(`Plan V18 generado en ${dir}: ${plan.pasos.length} pasos (series ${plan.series.A} / ${plan.series.B} / ${plan.series.C}).`)
    console.log('NO se ha enviado nada. Remisión: scripts/verifactu-conformidad.ps1 (certificado del almacén de Windows).')
    process.exit(0)
  }
  if (idx('--evaluar') !== -1) {
    const dir = argv[idx('--evaluar') + 1]
    if (!dir) {
      console.error('--evaluar requiere el directorio del plan')
      process.exit(2)
    }
    process.exit(evaluar(dir, idx('--json') !== -1))
  }
  console.log(
    'Uso: node scripts/verifactu-conformidad.mjs --plan <dir>     (genera envelopes + plan.json, sin red)\n' +
      '     node scripts/verifactu-conformidad.mjs --evaluar <dir> [--json]'
  )
  process.exit(2)
}

main()
