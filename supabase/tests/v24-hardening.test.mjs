// V24 — Batería de verificación del hardening de seguridad sobre PGlite
// (Postgres real embebido, mismo entorno Supabase simulado que v03..v15).
// Verifica la migración 20260924100000_sif_hardening.sql:
//  - sif_config_guard_control: el usuario final (auth.uid() no nulo) NO puede
//    tocar el plano de control de remisión (activo, entorno_aeat, modalidad,
//    tiempo_espera_envio, proximo_envio_desde, fallos_consecutivos,
//    circuito_abierto_hasta, certificado_ref, fechas inicio/fin); sí puede
//    gestionar su identificación (nombre_razon).
//  - El backend (auth.uid() nulo, service_role) mantiene control total.
//  - anon pierde todo privilegio sobre las tablas sif_* aunque los default
//    privileges se lo hubieran concedido.
//
// Ejecutar:  node supabase/tests/v24-hardening.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } })

let pass = 0, fail = 0
const ok = (name) => { pass++; console.log(`PASS  ${name}`) }
const ko = (name, e) => { fail++; console.log(`FAIL  ${name} :: ${e}`) }
const check = (name, cond, detalle = '') => (cond ? ok(name) : ko(name, detalle))

async function expectOk(name, sql) {
  try { const r = await db.exec(sql); ok(name); return r } catch (e) { ko(name, e.message) }
}
async function expectErr(name, fn, needle) {
  try {
    await (typeof fn === 'string' ? db.exec(fn) : fn())
    ko(name, 'no lanzó error y debía')
  } catch (e) {
    if (!needle || e.message.toLowerCase().includes(needle.toLowerCase())) ok(name)
    else ko(name, `error distinto: ${e.message}`)
  }
}

// ---------- 0. Mock del entorno Supabase ----------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`)

// ---------- 1. Esquema + TODAS las migraciones (V03..V24) ----------
const files = [
  ['schema.sql', `${REPO}/schema.sql`],
  ['schema-update.sql', `${REPO}/schema-update.sql`],
  ['m1 sif_config', `${REPO}/migrations/20260911100000_sif_config.sql`],
  ['m2 sif_series', `${REPO}/migrations/20260911100100_sif_series_numeracion.sql`],
  ['m3 sif_cadena_registros', `${REPO}/migrations/20260911100200_sif_cadena_registros.sql`],
  ['m4 sif_outbox_eventos', `${REPO}/migrations/20260911100300_sif_outbox_eventos.sql`],
  ['m5 invoices_estados', `${REPO}/migrations/20260911100400_invoices_estados_fiscales.sql`],
  ['m6 sif_emision (V07)', `${REPO}/migrations/20260913100000_sif_emision.sql`],
  ['m7 sif_remision (V10)', `${REPO}/migrations/20260918100000_sif_remision.sql`],
  ['m8 sif_certificados (V11)', `${REPO}/migrations/20260918110000_sif_certificados.sql`],
  ['m9 sif_incidencias (V12)', `${REPO}/migrations/20260919100000_sif_incidencias.sql`],
  ['m10 sif_multitenant (V15)', `${REPO}/migrations/20260919110000_sif_multitenant.sql`],
  ['m11 sif_hardening (V24)', `${REPO}/migrations/20260924100000_sif_hardening.sql`],
]
for (const [name, path] of files) {
  await expectOk(`aplica ${name}`, readFileSync(path, 'utf8'))
}
await expectOk('re-aplica m11 sif_hardening (idempotente)',
  readFileSync(`${REPO}/migrations/20260924100000_sif_hardening.sql`, 'utf8'))

// ---------- 2. Datos semilla (contexto backend: auth.uid() nulo) ----------
const A = '11111111-1111-1111-1111-111111111111'
const C = '33333333-3333-3333-3333-333333333333'

await expectOk('alta usuario A y su sif_config (backend)', `
  insert into auth.users (id, email) values ('${A}', 'a@test.es'), ('${C}', 'c@test.es');
  insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion)
  values ('${A}', 'B98407901', 'Empresa A SL', 'KU-TESTA');
`)

// ---------- 3. Usuario final: identificación sí, plano de control no ----------
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${A}', false);`)

await expectOk('usuario A puede actualizar nombre_razon',
  `update sif_config set nombre_razon = 'Empresa A Renombrada SL' where user_id = '${A}';`)

const bloqueadas = [
  ['activo', `activo = true`],
  ['entorno_aeat', `entorno_aeat = 'produccion'`],
  ['tiempo_espera_envio', `tiempo_espera_envio = 1`],
  ['proximo_envio_desde', `proximo_envio_desde = now() + interval '10 years'`],
  ['circuito_abierto_hasta', `circuito_abierto_hasta = now() + interval '10 years'`],
  ['fallos_consecutivos', `fallos_consecutivos = 99`],
  ['certificado_ref', `certificado_ref = 'ref-ajena'`],
  ['fecha_inicio_verifactu', `fecha_inicio_verifactu = current_date`],
]
for (const [col, setSql] of bloqueadas) {
  await expectErr(`usuario A NO puede cambiar ${col}`,
    `update sif_config set ${setSql} where user_id = '${A}';`, 'SIF_CONFIG_CONTROL')
}

// modalidad: el CHECK solo admite verifactu/no_verifactu; probar el cambio de valor
await expectErr('usuario A NO puede cambiar modalidad',
  `update sif_config set modalidad = 'no_verifactu' where user_id = '${A}';`, 'SIF_CONFIG_CONTROL')

// INSERT propio: solo con el plano de control en valores seguros
await db.exec(`select set_config('request.jwt.claim.sub', '${C}', false);`)
await expectErr('usuario C NO puede autoactivarse al insertar su config',
  `insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion, activo)
   values ('${C}', 'A58818501', 'Empresa C SL', 'KU-TESTC', true);`, 'SIF_CONFIG_CONTROL')
await expectErr('usuario C NO puede insertarse en produccion',
  `insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion, entorno_aeat)
   values ('${C}', 'A58818501', 'Empresa C SL', 'KU-TESTC', 'produccion');`, 'SIF_CONFIG_CONTROL')
await expectOk('usuario C SÍ puede insertar su config con valores seguros',
  `insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion)
   values ('${C}', 'A58818501', 'Empresa C SL', 'KU-TESTC');`)

// ---------- 4. Backend: control total ----------
await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
await expectOk('backend puede activar y pasar a produccion',
  `update sif_config set activo = true, entorno_aeat = 'produccion',
     fecha_inicio_verifactu = current_date where user_id = '${A}';`)
await expectOk('backend puede ajustar control de flujo',
  `update sif_config set tiempo_espera_envio = 120, proximo_envio_desde = now()
   where user_id = '${A}';`)

// ---------- 5. anon sin privilegio alguno sobre sif_* ----------
for (const tabla of ['sif_config', 'sif_series', 'sif_cadena', 'sif_registros', 'sif_outbox', 'sif_eventos']) {
  const r = await db.query(
    `select bool_or(has_table_privilege('anon', 'public.${tabla}', p)) as alguno
       from unnest(array['select','insert','update','delete','truncate','references','trigger']) p`
  )
  check(`anon sin privilegios en ${tabla}`, r.rows[0].alguno === false, JSON.stringify(r.rows[0]))
}

// ---------- Resumen ----------
console.log(`\n${pass} PASS / ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
