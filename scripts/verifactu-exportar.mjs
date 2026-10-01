#!/usr/bin/env node
// ---------------------------------------------------------------------------
// V16 · Exportación y verificación de exports de registros de facturación
// (art. 8 Orden HAC/1177/2024).
//
//   npm run verifactu:exportar -- --user <uuid>                 → export completo a ZIP
//   npm run verifactu:exportar -- --user <uuid> --desde 2026-01-01 --hasta 2026-03-31
//   npm run verifactu:exportar -- --user <uuid> --out <dir>     → carpeta destino (def. .)
//   npm run verifactu:exportar -- --user <uuid> --evento        → anota eventos 08/09
//   npm run verifactu:exportar -- --verificar <fichero.zip>     → re-verifica un export
//
// El export es un ZIP con los lotes XML en el formato oficial de remisión
// (RegFactuSistemaFacturacion, SuministroLR.xsd), manifest.json con SHA-256
// por fichero, LEEME.txt y el volcado de eventos. Tras generarlo, el propio
// script re-verifica el fichero (huellas recalculadas con la librería V04) y
// sale con código 1 si el export no es íntegro.
//
// Credenciales: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY del
// entorno o de .env.local/.env (nunca se imprimen).
// ---------------------------------------------------------------------------

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

import { exportarObligado, verificarZipExport } from '../lib/verifactu/export.ts'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- Entorno (sin dependencia de dotenv) -----------------------------------
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

// --- Argumentos -------------------------------------------------------------
function parsearArgs(argv) {
  const args = { user: null, desde: null, hasta: null, out: '.', evento: false, verificar: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--user') args.user = argv[++i] ?? null
    else if (argv[i] === '--desde') args.desde = argv[++i] ?? null
    else if (argv[i] === '--hasta') args.hasta = argv[++i] ?? null
    else if (argv[i] === '--out') args.out = argv[++i] ?? '.'
    else if (argv[i] === '--evento') args.evento = true
    else if (argv[i] === '--verificar') args.verificar = argv[++i] ?? null
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(
        'Uso: node scripts/verifactu-exportar.mjs --user <uuid> [--desde YYYY-MM-DD] [--hasta YYYY-MM-DD] [--out <dir>] [--evento]\n' +
          '     node scripts/verifactu-exportar.mjs --verificar <fichero.zip>'
      )
      process.exit(0)
    } else {
      console.error(`Argumento desconocido: ${argv[i]}`)
      process.exit(2)
    }
  }
  return args
}

function imprimirInforme(informe) {
  console.log(
    `${informe.integra ? 'ÍNTEGRO   ' : 'ANOMALÍAS '} registros=${informe.registros} ` +
      `ficheros=${informe.ficherosComprobados} ` +
      `correlativos=${informe.manifiesto.alcance.correlativoDesde}-${informe.manifiesto.alcance.correlativoHasta}` +
      (informe.anclaHuellaAnterior ? ' (export parcial, anclado a la huella anterior)' : '')
  )
  for (const a of informe.anomalias) {
    console.log(`  ${a.codigo} posicion=${a.posicion ?? '-'} :: ${a.detalle}`)
  }
}

// --- Principal ---------------------------------------------------------------
async function main() {
  cargarEnvLocal()
  const args = parsearArgs(process.argv)

  // Modo verificación de un fichero ya exportado (no toca la BD)
  if (args.verificar) {
    const bytes = new Uint8Array(readFileSync(args.verificar))
    const informe = await verificarZipExport(bytes)
    imprimirInforme(informe)
    process.exit(informe.integra ? 0 : 1)
  }

  if (!args.user) {
    console.error('Falta --user <uuid> (o usa --verificar <fichero.zip>)')
    process.exit(2)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (entorno o .env.local)')
    process.exit(2)
  }
  const supabase = createClient(url, serviceKey)

  const resultado = await exportarObligado(supabase, args.user, {
    desde: args.desde,
    hasta: args.hasta,
  })

  const destino = join(args.out, resultado.nombreFichero)
  writeFileSync(destino, resultado.zip)
  console.log(`Export escrito en ${destino} (${resultado.zip.length} bytes)`)
  imprimirInforme(resultado.verificacionZip)

  if (args.evento) {
    const datos = {
      origen: 'cli',
      desde: args.desde,
      hasta: args.hasta,
      registros: resultado.manifiesto.registros.total,
      eventos: resultado.manifiesto.eventos?.total ?? 0,
      correlativoDesde: resultado.manifiesto.alcance.correlativoDesde,
      correlativoHasta: resultado.manifiesto.alcance.correlativoHasta,
      fichero: resultado.nombreFichero,
      integra: resultado.verificacionZip.integra,
    }
    const { error } = await supabase.rpc('sif_registrar_evento', {
      p_user_id: args.user,
      p_tipo_evento: 'export_registros',
      p_datos: datos,
    })
    if (error) console.error(`No se pudo anotar el evento de exportación: ${error.message}`)
    else if (datos.eventos > 0) {
      const { error: e2 } = await supabase.rpc('sif_registrar_evento', {
        p_user_id: args.user,
        p_tipo_evento: 'export_eventos',
        p_datos: { origen: 'cli', fichero: resultado.nombreFichero, eventos: datos.eventos },
      })
      if (e2) console.error(`No se pudo anotar el evento de exportación de eventos: ${e2.message}`)
    }
  }

  process.exit(resultado.verificacionZip.integra ? 0 : 1)
}

main().catch((e) => {
  console.error(`Error del exportador: ${e instanceof Error ? e.message : e}`)
  process.exit(2)
})
