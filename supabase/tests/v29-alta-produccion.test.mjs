// V29 — Alta de MILBROTES y MERCADONET como obligados VERI*FACTU en producción (26-nov-2026, versión 2).
// Ejecuta scripts/verifactu-alta-produccion.sql (el mismo que Iván pega en Supabase) sobre PGlite con el
// esquema y TODAS las migraciones. Flujo en dos pasadas: la 1.ª crea la configuración inactiva (sin ella la app
// no deja subir el certificado: CONFIG_FALTA en lib/verifactu/cert-store.ts); la 2.ª, con el certificado
// subido, la activa en producción. Nunca desactiva una configuración activa.
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SUPA = join(dirname(fileURLToPath(import.meta.url)), '..')
const SQL_ALTA = readFileSync(join(SUPA, '..', 'scripts', 'verifactu-alta-produccion.sql'), 'utf8')
const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } })
let fallos = 0
const ok = (n) => console.log(`  ok  ${n}`)
const ko = (n, m) => {
  fallos++
  console.log(`  MAL ${n}: ${m}`)
}
const check = (n, cond, det = '') => (cond ? ok(n) : ko(n, det))

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create or replace function auth.role() returns text language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
`)
const ficheros = [
  join(SUPA, 'schema.sql'),
  join(SUPA, 'schema-update.sql'),
  ...readdirSync(join(SUPA, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(SUPA, 'migrations', f)),
]
for (const f of ficheros) {
  try {
    await db.exec(readFileSync(f, 'utf8'))
  } catch (e) {
    ko(`aplica ${f.split(/[\\/]/).pop()}`, e.message)
  }
}
check(`esquema y ${ficheros.length - 2} migraciones aplicadas`, fallos === 0)

async function alta() {
  const res = await db.exec(SQL_ALTA)
  const tabla = res.find((r) => r.fields?.some((f) => f.name === 'estado'))
  return Object.fromEntries(tabla.rows.map((r) => [r.correo, r]))
}
const fecha = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10))
const config = async (u) =>
  (await db.query(`select activo, entorno_aeat, fecha_inicio_verifactu::text as f, certificado_ref, nif_obligado from sif_config where user_id = '${u}'`)).rows[0]
const M = '05772710-0000-4000-8000-000000000001'
const N = '98407901-0000-4000-8000-000000000002'
const CM = 'c0000000-0000-4000-8000-000000000001'
const CN = 'c0000000-0000-4000-8000-000000000002'
const HUELLA = 'A'.repeat(64)
const cert = (id, user, nif) => `insert into sif_certificados (id, user_id, formato, material_cifrado, subject_cn,
  nif_certificado, nif_representado, numero_serie, huella_sha256, valido_desde, valido_hasta)
  values ('${id}', '${user}', 'pem', 'v1.deadbeef.aXY=.Y3Q=.dGFn', 'Representante', '00000000T', '${nif}', '01AB',
  '${HUELLA}', now() - interval '1 day', now() + interval '2 years');`
const hoy = (await db.query(`select (now() at time zone 'Europe/Madrid')::date::text as d`)).rows[0].d

// 1. Sin cuentas: no toca nada
let t = await alta()
check(
  'sin cuentas: las dos «FALTA LA CUENTA» y ninguna configuración',
  t['info@milbrotes.com'].estado === 'FALTA LA CUENTA' &&
    t['info@mercadonet.es'].estado === 'FALTA LA CUENTA' &&
    (await db.query('select count(*)::int as n from sif_config')).rows[0].n === 0
)

// 2. 1.ª pasada con las cuentas y sin certificados: perfil y configuración creados, INACTIVOS
await db.exec(`insert into auth.users (id, email) values ('${M}', 'info@milbrotes.com'), ('${N}', 'info@mercadonet.es');
  insert into profiles (id, email, name) values ('${M}', 'info@milbrotes.com', 'Claudia'), ('${N}', 'info@mercadonet.es', 'Ivan')
  on conflict (id) do update set name = excluded.name;`)
t = await alta()
let m = t['info@milbrotes.com']
check('1.ª pasada: MILBROTES «FALTA EL CERTIFICADO…»', m.estado.startsWith('FALTA EL CERTIFICADO'), m.estado)
let cm = await config(M)
check(
  '1.ª pasada: configuración de MILBROTES creada, inactiva, en producción y sin fecha de inicio',
  cm && cm.activo === false && cm.entorno_aeat === 'produccion' && cm.f === null && cm.nif_obligado === 'B05772710' && cm.certificado_ref === null,
  JSON.stringify(cm)
)
check(
  '1.ª pasada: perfil con razón social, NIF y domicilio de la escritura',
  m.perfil_nombre === 'MILBROTES, S.L.' && m.perfil_nif === 'B05772710' && m.perfil_domicilio === 'Calle Belalcázar, 14, 28006 Madrid',
  JSON.stringify(m)
)
const pm = (await db.query(`select plan, plan_expires_at, retencion_irpf from profiles where id = '${M}'`)).rows[0]
check(
  '1.ª pasada: plan Business sin caducidad y sin retención por defecto',
  pm.plan === 'business' && pm.plan_expires_at === null && pm.retencion_irpf === 0,
  JSON.stringify(pm)
)
check('1.ª pasada: MERCADONET también configurada e inactiva', (await config(N))?.activo === false)

// 3. Certificado de MILBROTES subido (ya hay configuración) y 2.ª pasada: MILBROTES activa; MERCADONET no
await db.exec(cert(CM, M, 'B05772710'))
t = await alta()
m = t['info@milbrotes.com']
cm = await config(M)
check('2.ª pasada: MILBROTES «ALTA HECHA»', m.estado === 'ALTA HECHA', m.estado)
check(
  '2.ª pasada: activa en producción, fecha de inicio de hoy (España) y referencia al certificado',
  cm.activo === true && cm.entorno_aeat === 'produccion' && cm.f === hoy && cm.certificado_ref === CM,
  `${JSON.stringify(cm)} hoy=${hoy}`
)
check(
  '2.ª pasada: MERCADONET sin certificado sigue inactiva',
  t['info@mercadonet.es'].estado.startsWith('FALTA EL CERTIFICADO') && (await config(N)).activo === false
)

// 4. Repetir: idempotente y conserva la fecha de inicio ya fijada en producción
await db.exec(`update sif_config set fecha_inicio_verifactu = date '2026-11-20' where user_id = '${M}'`)
t = await alta()
const n2 = (await db.query('select count(*)::int as n from sif_config')).rows[0].n
check(
  'repetir: sigue «ALTA HECHA», una fila por empresa y la fecha de inicio no cambia',
  t['info@milbrotes.com'].estado === 'ALTA HECHA' && n2 === 2 && (await config(M)).f === '2026-11-20',
  `${n2} ${(await config(M)).f}`
)

// 5. Certificado de MERCADONET: las dos dadas de alta
await db.exec(cert(CN, N, 'B98407901'))
t = await alta()
const n = t['info@mercadonet.es']
check(
  'MERCADONET con certificado: «ALTA HECHA» con su razón social y domicilio',
  n.estado === 'ALTA HECHA' &&
    n.perfil_nombre === 'MERCADONET GLOBAL S.L.' &&
    n.perfil_nif === 'B98407901' &&
    n.perfil_domicilio === 'Ptda. Cortixelles, núm. 98, 46900 Torrent (Valencia)',
  JSON.stringify(n)
)
check(
  'las dos activas en producción',
  (await db.query(`select count(*)::int as n from sif_config where activo and entorno_aeat = 'produccion'`)).rows[0].n === 2
)

// 6. Si se retira el certificado de MILBROTES, el SQL NO desactiva su configuración (art. 17): solo lo avisa
try {
  await db.exec(`update sif_certificados set estado = 'retirado' where id = '${CM}'`)
  t = await alta()
  check(
    'certificado retirado: sigue activa y avisa «ACTIVA PERO SIN CERTIFICADO»',
    (await config(M)).activo === true && t['info@milbrotes.com'].estado.startsWith('ACTIVA PERO SIN CERTIFICADO'),
    t['info@milbrotes.com'].estado
  )
} catch (e) {
  ko('certificado retirado', e.message)
}

console.log(fallos ? `\nV29: ${fallos} FALLOS` : '\nV29: todo correcto')
process.exit(fallos ? 1 : 0)
