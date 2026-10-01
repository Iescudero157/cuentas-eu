// V11 — Batería de verificación de sif_certificados sobre PGlite (Postgres
// real embebido, mismo entorno Supabase simulado que v03/v07/v10).
// Verifica la migración 20260918110000_sif_certificados.sql: RLS deny-all
// para anon/authenticated (ni SELECT), un único certificado activo por
// obligado, metadatos write-once, retirada con purga de material y sellado de
// retirado_at, inmutabilidad tras retirar, DELETE/TRUNCATE bloqueados y
// constraints de forma (huella, validez, coherencia estado/material).
//
// Ejecutar:  node supabase/tests/v11-certificados.test.mjs
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
  create role service_role nologin bypassrls; -- como en Supabase real
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

// ---------- 1. Esquema + migraciones (V03..V11) ----------
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
]
for (const [name, path] of files) {
  await expectOk(`aplica ${name}`, readFileSync(path, 'utf8'))
}
await expectOk('re-aplica m8 sif_certificados (idempotente)',
  readFileSync(`${REPO}/migrations/20260918110000_sif_certificados.sql`, 'utf8'))

// ---------- 2. Datos semilla ----------
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const CERT1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const CERT2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const CERT_B = 'bbbbbbbb-0000-0000-0000-000000000001'
const HUELLA = 'A'.repeat(64)

await expectOk('alta usuarios y sif_config', `
  insert into auth.users (id, email) values ('${A}', 'a@test.es'), ('${B}', 'b@test.es');
  insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion)
  values ('${A}', 'B98407901', 'Empresa A SL', 'KU-TESTA'),
         ('${B}', 'A58818501', 'Empresa B SL', 'KU-TESTB');
`)

function insertCert(id, user, extra = '') {
  return `
    insert into sif_certificados (id, user_id, formato, material_cifrado, subject_cn,
      nif_certificado, numero_serie, huella_sha256, valido_desde, valido_hasta ${extra ? ',' + extra.split('=')[0] : ''})
    values ('${id}', '${user}', 'pem', 'v1.deadbeef.aXY=.Y3Q=.dGFn', 'Empresa Test',
      'B98407901', '01AB', '${HUELLA}', now() - interval '1 day', now() + interval '2 years'
      ${extra ? ',' + extra.split('=')[1] : ''});
  `
}

// ---------- 3. Altas y unicidad de activo ----------
await expectOk('inserta certificado activo de A', insertCert(CERT1, A))
await expectOk('inserta certificado activo de B (otro tenant)', insertCert(CERT_B, B))
await expectErr('segundo certificado ACTIVO de A rechazado (índice parcial)',
  insertCert(CERT2, A), 'sif_certificados_activo_unico')

// ---------- 4. Constraints de forma ----------
await expectErr('huella no-SHA256 rechazada', `
  insert into sif_certificados (user_id, formato, material_cifrado, subject_cn, numero_serie,
    huella_sha256, valido_desde, valido_hasta)
  values ('${B}', 'pem', 'x', 'Y', '01', 'zz', now(), now() + interval '1 year');
`, 'check')
await expectErr('validez invertida rechazada', `
  insert into sif_certificados (user_id, formato, material_cifrado, subject_cn, numero_serie,
    huella_sha256, valido_desde, valido_hasta)
  values ('${B}', 'pem', 'x', 'Y', '01', '${HUELLA}', now(), now() - interval '1 year');
`, 'check')
await expectErr('activo sin material rechazado', `
  insert into sif_certificados (user_id, formato, subject_cn, numero_serie,
    huella_sha256, valido_desde, valido_hasta)
  values ('${B}', 'pem', 'Y', '01', '${HUELLA}', now(), now() + interval '1 year');
`, 'check')
await expectErr('estado retirado sin retirado_at rechazado (insert directo)', `
  insert into sif_certificados (user_id, formato, subject_cn, numero_serie,
    huella_sha256, valido_desde, valido_hasta, estado)
  values ('${B}', 'pem', 'Y', '01', '${HUELLA}', now(), now() + interval '1 year', 'retirado');
`, 'check')

// ---------- 5. Write-once: metadatos y material inmutables ----------
await expectErr('cambiar metadatos (nif) bloqueado',
  `update sif_certificados set nif_certificado = 'X0000000X' where id = '${CERT1}';`, 'inmutables')
await expectErr('cambiar material cifrado bloqueado',
  `update sif_certificados set material_cifrado = 'v1.otro.a=.b=.c=' where id = '${CERT1}';`, 'no se modifica')
await expectErr('fijar retirado_at sin retirar bloqueado',
  `update sif_certificados set retirado_at = now() where id = '${CERT1}';`, 'solo se fija al retirar')
await expectErr('transición a estado inventado bloqueada',
  `update sif_certificados set estado = 'roto' where id = '${CERT1}';`, 'no permitida')

// ---------- 6. Retirada: purga material y sella retirado_at ----------
await expectOk('retirar certificado de A', `
  update sif_certificados set estado = 'retirado' where id = '${CERT1}';
`)
{
  const r = await db.query(
    `select material_cifrado, retirado_at from sif_certificados where id = $1`, [CERT1])
  check('retirada purga material_cifrado', r.rows[0].material_cifrado === null)
  check('retirada sella retirado_at', r.rows[0].retirado_at !== null)
}
await expectErr('un certificado retirado es inmutable',
  `update sif_certificados set estado = 'activo' where id = '${CERT1}';`, 'inmutable')
await expectOk('tras retirar, A puede tener un nuevo activo', insertCert(CERT2, A))

// ---------- 7. DELETE / TRUNCATE bloqueados (también service_role) ----------
await expectErr('DELETE bloqueado por guard',
  `delete from sif_certificados where id = '${CERT2}';`, 'solo adición')
await expectErr('TRUNCATE bloqueado por guard',
  `truncate table sif_certificados;`, 'TRUNCATE prohibido')
await db.exec(`set role service_role;`)
await expectErr('DELETE bloqueado también para service_role',
  `delete from sif_certificados where id = '${CERT2}';`, 'solo adición')
await db.exec(`reset role;`)

// ---------- 8. RLS deny-all para clientes ----------
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${A}', false);`)
await expectErr('authenticated NO puede ni hacer SELECT de su propio certificado',
  `select id from sif_certificados;`, 'denied')
await expectErr('authenticated NO puede insertar certificados',
  insertCert('cccccccc-0000-0000-0000-000000000001', A), 'denied')
await expectErr('authenticated NO puede retirar certificados',
  `update sif_certificados set estado = 'retirado' where user_id = '${A}';`, 'denied')
await db.exec(`reset role; set role anon;`)
await expectErr('anon NO puede hacer SELECT',
  `select id from sif_certificados;`, 'denied')
await db.exec(`reset role;`)

// service_role sí opera (custodia desde la API del servidor)
await db.exec(`set role service_role;`)
{
  const r = await db.query(`select count(*)::int as n from sif_certificados`)
  check('service_role lee la tabla (API de servidor)', r.rows[0].n === 3, `n=${r.rows[0].n}`)
}
await expectOk('service_role retira (transición permitida)', `
  update sif_certificados set estado = 'retirado' where id = '${CERT_B}';
`)
await db.exec(`reset role;`)

// ---------- Resumen ----------
console.log(`\nTOTAL: ${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
