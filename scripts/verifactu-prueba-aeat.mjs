#!/usr/bin/env node
// ---------------------------------------------------------------------------
// V17 · Prueba de conexión al entorno de PRUEBAS de la AEAT (VERI*FACTU).
//
// Construye un registro de facturación de PRUEBA (alta F2 o su anulación),
// lo envuelve en RegFactuSistemaFacturacion + SOAP 1.1 y lo remite al portal
// de pruebas (prewww1.aeat.es) con el cliente V09 (mTLS). SOLO entorno de
// pruebas: este script se niega a hablar con producción.
//
//   npm run verifactu:prueba-aeat                          → alta de prueba y envío (cert de env)
//   npm run verifactu:prueba-aeat -- --envelope <fich.xml> → solo generar el Envelope SOAP (sin red)
//   npm run verifactu:prueba-aeat -- --parsear <resp.xml>  → informe de una respuesta SOAP guardada
//   npm run verifactu:prueba-aeat -- --anular --num <NumSerie> --fecha <dd-mm-aaaa> --huella <h64>
//
// Certificado (envío directo): VERIFACTU_CERT_PFX_BASE64 + VERIFACTU_CERT_PFX_PASSWORD
// (o par PEM, ver aeat-cliente.ts) en el entorno o en .env.local/.env.
// Si el certificado vive en el almacén de Windows con clave NO exportable,
// use scripts/verifactu-prueba-aeat.ps1 (flujo --envelope → curl schannel →
// --parsear), que reutiliza este mismo script para generar y parsear.
//
// El registro generado es inequívocamente de prueba: serie PRUEBA-V17-*,
// importe 12,10 €, descripción «Prueba de conexión…». El entorno de pruebas
// de la AEAT no tiene efectos tributarios, pero exige certificado real y un
// NIF censado (obligado: Mercadonet Global S.L., B98407901).
// ---------------------------------------------------------------------------

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  construirRegistroAlta,
  xmlRegFactuSistemaFacturacion,
  sistemaInformaticoKuentas,
} from '../lib/verifactu/registro-alta.ts'
import { construirRegistroAnulacion } from '../lib/verifactu/registro-anulacion.ts'
import {
  ClienteAeat,
  ENDPOINTS_VERIFACTU,
  certificadoDesdeEnv,
  envolverSoap,
  parsearRespuestaSoap,
  ErrorSoapAeat,
  ErrorHttpAeat,
  ErrorTransporteAeat,
} from '../lib/verifactu/aeat-cliente.ts'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

const OBLIGADO = { nif: 'B98407901', nombreRazon: 'Mercadonet Global S.L.' }
// Instalación reservada a pruebas de conexión (no colisiona con instalaciones reales).
const NUMERO_INSTALACION_PRUEBAS = 'KU-PRUEBAS-V17'

// --- Entorno (sin dependencia de dotenv; mismo patrón que verifactu-exportar) ---
function cargarEnvLocal() {
  for (const nombre of ['.env.local', '.env']) {
    const ruta = join(RAIZ, nombre)
    if (!existsSync(ruta)) continue
    for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(linea)
      if (!m || m[1].startsWith('#')) continue
      const valor = m[2].replace(/^["']|["']$/g, '')
      if (!(m[1] in process.env)) process.env[m[1]] = valor
    }
  }
}

// --- Argumentos --------------------------------------------------------------
function parsearArgs(argv) {
  const args = {
    envelope: null,
    parsear: null,
    anular: false,
    num: null,
    fecha: null,
    huella: null,
    serie: null,
    json: false,
  }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--envelope') args.envelope = argv[++i] ?? null
    else if (argv[i] === '--parsear') args.parsear = argv[++i] ?? null
    else if (argv[i] === '--anular') args.anular = true
    else if (argv[i] === '--num') args.num = argv[++i] ?? null
    else if (argv[i] === '--fecha') args.fecha = argv[++i] ?? null
    else if (argv[i] === '--huella') args.huella = argv[++i] ?? null
    else if (argv[i] === '--serie') args.serie = argv[++i] ?? null
    else if (argv[i] === '--json') args.json = true
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(
        'Uso: node scripts/verifactu-prueba-aeat.mjs                       (alta de prueba + envío)\n' +
          '     node scripts/verifactu-prueba-aeat.mjs --envelope <f.xml>  (solo generar SOAP)\n' +
          '     node scripts/verifactu-prueba-aeat.mjs --parsear <resp.xml>\n' +
          '     node scripts/verifactu-prueba-aeat.mjs --anular --num <NumSerie> --fecha <dd-mm-aaaa> --huella <h> [--envelope <f.xml>]'
      )
      process.exit(0)
    } else {
      console.error(`Argumento desconocido: ${argv[i]} (use --help)`)
      process.exit(2)
    }
  }
  return args
}

// --- Construcción del registro de prueba --------------------------------------
function serieDePrueba(prefijo) {
  const d = new Date()
  const p = (n, l = 2) => String(n).padStart(l, '0')
  return `${prefijo ?? 'PRUEBA-V17'}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function fechaHoyOficial() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`
}

function construirAltaDePrueba(serie) {
  const numSerieFactura = serieDePrueba(serie)
  const registro = construirRegistroAlta(
    {
      emisor: OBLIGADO,
      numSerieFactura,
      fechaExpedicion: new Date(),
      tipoFactura: 'F2', // simplificada: sin destinatario, nada que inventar
      descripcionOperacion:
        'Prueba de conexion al entorno de pruebas VERI*FACTU (Kuentas V17). Sin efectos tributarios.',
      desglose: [
        {
          claveRegimen: '01',
          calificacionOperacion: 'S1',
          tipoImpositivo: 21,
          baseImponible: 10,
          cuotaRepercutida: 2.1,
        },
      ],
    },
    {
      // Cada ejecución abre una cadena nueva (serie única): el contraste de
      // encadenamiento del portal se prueba de verdad con la cola V10.
      encadenamiento: { primerRegistro: true },
      sistemaInformatico: sistemaInformaticoKuentas(NUMERO_INSTALACION_PRUEBAS),
    }
  )
  return { registro, numSerieFactura }
}

function construirAnulacionDePrueba(args) {
  if (!args.num || !args.fecha || !args.huella) {
    console.error('--anular requiere --num <NumSerie>, --fecha <dd-mm-aaaa> y --huella <huella del alta>')
    process.exit(2)
  }
  return construirRegistroAnulacion(
    {
      emisor: { nif: OBLIGADO.nif },
      numSerieFacturaAnulada: args.num,
      fechaExpedicionFacturaAnulada: args.fecha,
    },
    {
      encadenamiento: {
        registroAnterior: {
          idEmisorFactura: OBLIGADO.nif,
          numSerieFactura: args.num,
          fechaExpedicion: args.fecha,
          huella: args.huella,
        },
      },
      sistemaInformatico: sistemaInformaticoKuentas(NUMERO_INSTALACION_PRUEBAS),
    }
  )
}

// --- Informe -------------------------------------------------------------------
function imprimirInforme(respuesta, json) {
  if (json) {
    console.log(JSON.stringify(respuesta, null, 2))
  } else {
    console.log('--- Respuesta de la AEAT (entorno de pruebas) ---')
    console.log(`EstadoEnvio      : ${respuesta.estadoEnvio}`)
    if (respuesta.csv) console.log(`CSV              : ${respuesta.csv}`)
    if (respuesta.datosPresentacion) {
      console.log(
        `Presentación     : NIF ${respuesta.datosPresentacion.nifPresentador} · ${respuesta.datosPresentacion.timestampPresentacion}`
      )
    }
    console.log(`TiempoEsperaEnvio: ${respuesta.tiempoEsperaEnvio} s`)
    for (const linea of respuesta.lineas) {
      const id = `${linea.idFactura.numSerieFactura} (${linea.idFactura.fechaExpedicionFactura})`
      let detalle = `${linea.operacion.tipoOperacion} ${id} → ${linea.estadoRegistro}`
      if (linea.codigoErrorRegistro !== undefined) {
        detalle += ` [${linea.codigoErrorRegistro}] ${linea.descripcionErrorRegistro ?? ''}`
      }
      if (linea.registroDuplicado) {
        detalle += ` (duplicado: ${linea.registroDuplicado.estadoRegistroDuplicado})`
      }
      console.log(`  · ${detalle}`)
    }
  }
  return respuesta.estadoEnvio === 'Correcto' ? 0 : 1
}

function informeDeError(e) {
  if (e instanceof ErrorSoapAeat) {
    console.error(`SOAP Fault [${e.faultCode}]: ${e.faultString}${e.detalle ? `\n  detalle: ${e.detalle}` : ''}`)
  } else if (e instanceof ErrorHttpAeat) {
    console.error(`HTTP ${e.status} sin SOAP interpretable. Cuerpo (500 primeros chars):\n${e.cuerpo.slice(0, 500)}`)
  } else if (e instanceof ErrorTransporteAeat) {
    console.error(`${e.message} (¿certificado mTLS correcto? ¿red?)`)
  } else {
    console.error(e instanceof Error ? e.message : String(e))
  }
  return 1
}

// --- Programa --------------------------------------------------------------------
async function main() {
  cargarEnvLocal()
  const args = parsearArgs(process.argv)

  // Candado de entorno: este script SOLO habla con pruebas.
  if (process.env.VERIFACTU_ENTORNO === 'produccion') {
    console.error(
      'VERIFACTU_ENTORNO=produccion detectado: este script es SOLO para el entorno de pruebas. ' +
        'La remisión real la hace la cola V10 (cron verifactu-remision).'
    )
    process.exit(2)
  }
  const url = ENDPOINTS_VERIFACTU.pruebas.normal

  // Modo informe de una respuesta guardada (flujo curl/schannel del .ps1).
  if (args.parsear) {
    const xml = readFileSync(args.parsear, 'utf8')
    try {
      process.exit(imprimirInforme(parsearRespuestaSoap(xml), args.json))
    } catch (e) {
      process.exit(informeDeError(e))
    }
  }

  // Construcción del registro (alta de prueba o anulación del alta indicada).
  let registroXml
  let meta
  if (args.anular) {
    const r = construirAnulacionDePrueba(args)
    registroXml = r.xml
    meta = { tipo: 'anulacion', numSerieFacturaAnulada: args.num, huella: r.huella }
  } else {
    const { registro, numSerieFactura } = construirAltaDePrueba(args.serie)
    registroXml = registro.xml
    meta = {
      tipo: 'alta',
      numSerieFactura,
      fechaExpedicionFactura: registro.fechaExpedicionFactura,
      importeTotal: registro.importeTotal,
      huella: registro.huella,
    }
  }
  const cuerpo = xmlRegFactuSistemaFacturacion({ obligadoEmision: OBLIGADO }, [registroXml])

  console.log(`Registro de ${meta.tipo} de prueba generado:`)
  if (meta.tipo === 'alta') {
    console.log(`  NumSerieFactura : ${meta.numSerieFactura}`)
    console.log(`  FechaExpedicion : ${meta.fechaExpedicionFactura}`)
    console.log(`  ImporteTotal    : ${meta.importeTotal}`)
  } else {
    console.log(`  Factura anulada : ${meta.numSerieFacturaAnulada}`)
  }
  console.log(`  Huella          : ${meta.huella}`)
  console.log(`  Endpoint        : ${url}`)

  // Modo solo-envelope: guarda el SOAP y los metadatos, sin tocar la red.
  if (args.envelope) {
    writeFileSync(args.envelope, envolverSoap(cuerpo), 'utf8')
    writeFileSync(`${args.envelope}.meta.json`, JSON.stringify({ ...meta, url, fechaHoy: fechaHoyOficial() }, null, 2))
    console.log(`Envelope SOAP escrito en ${args.envelope} (y .meta.json). NO se ha enviado nada.`)
    process.exit(0)
  }

  // Envío directo con el cliente V09 (cert del entorno).
  const certificado = certificadoDesdeEnv()
  if (!certificado) {
    console.error(
      'Sin certificado en el entorno (VERIFACTU_CERT_PFX_BASE64 + VERIFACTU_CERT_PFX_PASSWORD o par PEM).\n' +
        'Si el certificado está en el almacén de Windows con clave NO exportable, use:\n' +
        '  powershell -File scripts/verifactu-prueba-aeat.ps1'
    )
    process.exit(2)
  }
  const cliente = new ClienteAeat({ entorno: 'pruebas', tipoCertificado: 'normal', certificado })
  try {
    const respuesta = await cliente.enviarCuerpoXml(cuerpo)
    process.exit(imprimirInforme(respuesta, args.json))
  } catch (e) {
    process.exit(informeDeError(e))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
