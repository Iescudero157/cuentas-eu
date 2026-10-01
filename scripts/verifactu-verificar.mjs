#!/usr/bin/env node
// ---------------------------------------------------------------------------
// V12 · Verificador de integridad ejecutable de la cadena Verifactu.
//
//   npm run verifactu:verificar                    → todos los obligados
//   npm run verifactu:verificar -- --user <uuid>   → un obligado concreto
//   npm run verifactu:verificar -- --eventos       → anota eventos 03/04 en sif_eventos
//   npm run verifactu:verificar -- --json out.json → informe completo a fichero
//
// Recorre la cadena de cada obligado (sif_registros) y recalcula cada huella
// con la librería oficial V04 (independiente de SQL), detecta huecos de
// correlativo, roturas de encadenamiento, jsonb inconsistente, fechas no
// trazables y desincronización de sif_cadena; contrasta además con el
// detector SQL sif_detectar_anomalias(). Sale con código 1 si hay anomalías.
//
// Credenciales: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY del
// entorno o de .env.local/.env (nunca se imprimen).
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

import {
  verificarIntegridadObligado,
  verificarTodosLosObligados,
} from '../lib/verifactu/integridad.ts'

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
  const args = { user: null, eventos: false, json: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--user') args.user = argv[++i] ?? null
    else if (argv[i] === '--eventos') args.eventos = true
    else if (argv[i] === '--json') args.json = argv[++i] ?? null
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Uso: node scripts/verifactu-verificar.mjs [--user <uuid>] [--eventos] [--json <fichero>]')
      process.exit(0)
    } else {
      console.error(`Argumento desconocido: ${argv[i]}`)
      process.exit(2)
    }
  }
  return args
}

// --- Principal ---------------------------------------------------------------
async function main() {
  cargarEnvLocal()
  const args = parsearArgs(process.argv)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (entorno o .env.local)')
    process.exit(2)
  }
  const supabase = createClient(url, serviceKey)

  const opciones = { contrastarSql: true, registrarEventos: args.eventos }
  const informes = args.user
    ? [await verificarIntegridadObligado(supabase, args.user, opciones)]
    : await verificarTodosLosObligados(supabase, opciones)

  let totalAnomalias = 0
  for (const informe of informes) {
    const sql = informe.anomaliasSql?.length ?? 0
    const estado = informe.integra && sql === 0 ? 'ÍNTEGRA' : 'ANOMALÍAS'
    console.log(
      `${estado.padEnd(10)} obligado=${informe.userId} registros=${informe.registros} ` +
        `anomaliasTS=${informe.anomalias.length} anomaliasSQL=${sql}` +
        (informe.eventosRegistrados ? ` eventos=${informe.eventosRegistrados}` : '')
    )
    for (const a of informe.anomalias) {
      console.log(`  [TS ] ${a.codigo} correlativo=${a.correlativo ?? '-'} :: ${a.detalle}`)
    }
    for (const a of informe.anomaliasSql ?? []) {
      console.log(`  [SQL] ${a.codigo} correlativo=${a.correlativo ?? '-'} :: ${a.detalle}`)
    }
    totalAnomalias += informe.anomalias.length + sql
  }

  if (args.json) {
    writeFileSync(args.json, JSON.stringify({ generado: new Date().toISOString(), obligados: informes }, null, 2))
    console.log(`Informe JSON escrito en ${args.json}`)
  }

  if (informes.length === 0) console.log('Sin obligados con cadena iniciada.')
  console.log(totalAnomalias === 0 ? 'Verificación completada: todas las cadenas íntegras.'
    : `Verificación completada: ${totalAnomalias} anomalía(s) detectada(s).`)
  process.exit(totalAnomalias === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(`Error del verificador: ${e instanceof Error ? e.message : e}`)
  process.exit(2)
})
