// V03 — Batería de verificación de las migraciones Verifactu sobre PGlite
// (Postgres real embebido). Simula el entorno Supabase: schema auth, auth.uid(),
// roles anon/authenticated/service_role y default privileges de Supabase.
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { readFileSync } from 'node:fs'

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const db = new PGlite({ extensions: { uuid_ossp } })

let pass = 0, fail = 0
const ok = (name) => { pass++; console.log(`PASS  ${name}`) }
const ko = (name, e) => { fail++; console.log(`FAIL  ${name} :: ${e}`) }

async function expectOk(name, sql) {
  try { const r = await db.exec(sql); ok(name); return r } catch (e) { ko(name, e.message) }
}
async function expectErr(name, sql, needle) {
  try {
    await db.exec(sql)
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

// ---------- 1. Esquema actual de producción + migraciones V03 ----------
const files = [
  ['schema.sql', `${REPO}/schema.sql`],
  ['schema-update.sql', `${REPO}/schema-update.sql`],
  ['m1 sif_config', `${REPO}/migrations/20260911100000_sif_config.sql`],
  ['m2 sif_series', `${REPO}/migrations/20260911100100_sif_series_numeracion.sql`],
  ['m3 sif_cadena_registros', `${REPO}/migrations/20260911100200_sif_cadena_registros.sql`],
  ['m4 sif_outbox_eventos', `${REPO}/migrations/20260911100300_sif_outbox_eventos.sql`],
  ['m5 invoices_estados', `${REPO}/migrations/20260911100400_invoices_estados_fiscales.sql`],
]
for (const [name, path] of files) {
  await expectOk(`aplica ${name}`, readFileSync(path, 'utf8'))
}
// Idempotencia razonable: re-aplicar las migraciones no debe romper
for (const [name, path] of files.slice(2)) {
  await expectOk(`re-aplica ${name} (idempotente)`, readFileSync(path, 'utf8'))
}

// ---------- 2. Datos semilla ----------
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
await expectOk('alta usuarios A y B (trigger de profiles)', `
  insert into auth.users (id, email) values ('${A}', 'a@test.es'), ('${B}', 'b@test.es');
`)
const profs = await db.query('select count(*)::int as n from profiles')
profs.rows[0].n === 2 ? ok('profiles auto-creados por trigger') : ko('profiles auto-creados por trigger', `n=${profs.rows[0].n}`)

// ---------- 3. sif_config ----------
await expectOk('sif_config insert A', `
  insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion)
  values ('${A}', 'B98407901', 'Empresa A SL', 'KU-TESTA');
`)
await expectErr('sif_config NIF inválido rechazado', `
  insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion)
  values ('${B}', 'mal', 'Empresa B', 'KU-TESTB');
`, 'check')
await expectOk('sif_config update nombre (sin registros) permitido',
  `update sif_config set nombre_razon = 'Empresa A renombrada SL' where user_id = '${A}';`)

// ---------- 4. Numeración atómica ----------
for (let i = 1; i <= 3; i++) {
  const r = await db.query(`select * from sif_reservar_numero('${A}', 'F', 2026)`)
  const { numero, num_serie_factura } = r.rows[0]
  const expected = `F-2026-${String(i).padStart(6, '0')}`
  numero === i && num_serie_factura === expected
    ? ok(`sif_reservar_numero F #${i} -> ${num_serie_factura}`)
    : ko(`sif_reservar_numero F #${i}`, JSON.stringify(r.rows[0]))
}
const rR = await db.query(`select * from sif_reservar_numero('${A}', 'R', 2026, 'rectificativa')`)
rR.rows[0].num_serie_factura === 'R-2026-000001'
  ? ok('sif_reservar_numero serie R independiente')
  : ko('sif_reservar_numero serie R independiente', JSON.stringify(rR.rows[0]))

// ---------- 5. Factura borrador (comportamiento actual intacto) ----------
await expectOk('invoice borrador insert + update libre', `
  insert into invoices (id, user_id, number, client_name, items, subtotal, iva, total, date)
  values ('33333333-3333-3333-3333-333333333333', '${A}', 'FACT-2026-006', 'Cliente X',
          '[{"desc":"serv","qty":1,"price":100}]', 100, 21, 121, '2026-09-11');
  update invoices set total = 121.00, subtotal = 100.00
    where id = '33333333-3333-3333-3333-333333333333';
`)

// ---------- 6. Cadena + registro de alta ----------
const H1 = 'A'.repeat(64)
await expectOk('sif_cadena init + registro alta #1 (primer registro)', `
  insert into sif_cadena (user_id, nif_obligado) values ('${A}', 'B98407901');
  insert into sif_registros (id, user_id, correlativo, tipo_registro, invoice_id,
    id_emisor_factura, num_serie_factura, fecha_expedicion, tipo_factura,
    cuota_total, importe_total, registro, primer_registro, huella,
    fecha_hora_huso_gen)
  values ('44444444-4444-4444-4444-444444444444', '${A}', 1, 'alta',
    '33333333-3333-3333-3333-333333333333', 'B98407901', 'F-2026-000001',
    '2026-09-11', 'F1', 21.00, 121.00,
    '{"IDVersion":"1.0","TipoFactura":"F1"}', true, '${H1}',
    '2026-09-11T10:00:00+02:00');
  update sif_cadena set correlativo_ultimo = 1,
    ultimo_registro_id = '44444444-4444-4444-4444-444444444444',
    ultima_huella = '${H1}', ultimo_num_serie_factura = 'F-2026-000001',
    ultima_fecha_expedicion = '2026-09-11'
    where user_id = '${A}';
`)
await expectOk('registro: estado_remision -> queued + csv (mutable) permitido', `
  update sif_registros set estado_remision = 'queued' where correlativo = 1 and user_id = '${A}';
  update sif_registros set estado_remision = 'accepted', csv_aeat = 'CSV123', remitido_at = now()
    where correlativo = 1 and user_id = '${A}';
`)
await expectErr('registro: UPDATE de huella bloqueado',
  `update sif_registros set huella = '${'B'.repeat(64)}' where correlativo = 1 and user_id = '${A}';`,
  'inmutable')
await expectErr('registro: UPDATE de importe_total bloqueado',
  `update sif_registros set importe_total = 999 where correlativo = 1 and user_id = '${A}';`,
  'inmutable')
await expectErr('registro: DELETE bloqueado',
  `delete from sif_registros where correlativo = 1 and user_id = '${A}';`,
  'append-only')
await expectErr('registro: TRUNCATE CASCADE bloqueado por trigger', `truncate sif_registros cascade;`, 'TRUNCATE prohibido')
await expectErr('registro: correlativo duplicado por obligado (unique)', `
  insert into sif_registros (user_id, correlativo, tipo_registro, id_emisor_factura,
    num_serie_factura, fecha_expedicion, tipo_factura, cuota_total, importe_total,
    registro, primer_registro, huella_anterior, huella, fecha_hora_huso_gen)
  values ('${A}', 1, 'alta', 'B98407901', 'F-2026-000002', '2026-09-11', 'F1', 1, 1,
    '{}', false, '${H1}', '${'C'.repeat(64)}', '2026-09-11T10:01:00+02:00');
`, 'duplicate key')
await expectErr('registro: huella en minúsculas rechazada (check)', `
  insert into sif_registros (user_id, correlativo, tipo_registro, id_emisor_factura,
    num_serie_factura, fecha_expedicion, tipo_factura, cuota_total, importe_total,
    registro, primer_registro, huella_anterior, huella, fecha_hora_huso_gen)
  values ('${A}', 2, 'alta', 'B98407901', 'F-2026-000002', '2026-09-11', 'F1', 1, 1,
    '{}', false, '${H1}', '${'c'.repeat(64)}', '2026-09-11T10:01:00+02:00');
`, 'check')
await expectErr('registro: primer_registro con huella_anterior rechazado (check)', `
  insert into sif_registros (user_id, correlativo, tipo_registro, id_emisor_factura,
    num_serie_factura, fecha_expedicion, tipo_factura, cuota_total, importe_total,
    registro, primer_registro, huella_anterior, huella, fecha_hora_huso_gen)
  values ('${A}', 2, 'alta', 'B98407901', 'F-2026-000002', '2026-09-11', 'F1', 1, 1,
    '{}', true, '${H1}', '${'C'.repeat(64)}', '2026-09-11T10:01:00+02:00');
`, 'check')
await expectErr('registro: alta sin tipo_factura/importes rechazada (check)', `
  insert into sif_registros (user_id, correlativo, tipo_registro, id_emisor_factura,
    num_serie_factura, fecha_expedicion, registro, primer_registro, huella_anterior,
    huella, fecha_hora_huso_gen)
  values ('${A}', 2, 'alta', 'B98407901', 'F-2026-000002', '2026-09-11',
    '{}', false, '${H1}', '${'C'.repeat(64)}', '2026-09-11T10:01:00+02:00');
`, 'check')
await expectOk('registro: xml fijado una única vez (NULL -> valor)',
  `update sif_registros set xml = '<RegistroAlta/>' where correlativo = 1 and user_id = '${A}';`)
await expectErr('registro: cambiar xml ya fijado bloqueado',
  `update sif_registros set xml = '<Otro/>' where correlativo = 1 and user_id = '${A}';`,
  'inmutable')
await expectErr('sif_config: cambiar NIF con cadena iniciada bloqueado',
  `update sif_config set nif_obligado = 'B00000000' where user_id = '${A}';`,
  'cadena')

// ---------- 7. Outbox ----------
await expectOk('outbox: encolar registro', `
  insert into sif_outbox (user_id, registro_id)
  values ('${A}', '44444444-4444-4444-4444-444444444444');
`)
await expectErr('outbox: mismo registro dos veces rechazado (unique)', `
  insert into sif_outbox (user_id, registro_id)
  values ('${A}', '44444444-4444-4444-4444-444444444444');
`, 'duplicate key')

// ---------- 8. Eventos ----------
await expectOk('eventos: insert primer evento', `
  insert into sif_eventos (user_id, correlativo, tipo_evento, primer_evento, huella, fecha_hora_huso_gen)
  values ('${A}', 1, 'export_registros', true, '${'D'.repeat(64)}', '2026-09-11T10:05:00+02:00');
`)
await expectErr('eventos: UPDATE bloqueado',
  `update sif_eventos set datos = '{"x":1}' where user_id = '${A}';`, 'append-only')
await expectErr('eventos: DELETE bloqueado',
  `delete from sif_eventos where user_id = '${A}';`, 'append-only')

// ---------- 9. invoices: emisión e inmutabilidad ----------
await expectOk('invoice: emitir (borrador -> emitida, fija numero_fiscal)', `
  update invoices set verifactu_estado = 'emitida', serie = 'F', ejercicio = 2026,
    numero_fiscal = 'F-2026-000001', emitida_at = now(), tipo_factura = 'F1',
    registro_alta_id = '44444444-4444-4444-4444-444444444444', pdf_path = 'facturas/a/f1.pdf'
  where id = '33333333-3333-3333-3333-333333333333';
`)
await expectErr('invoice emitida: cambiar total bloqueado',
  `update invoices set total = 500 where id = '33333333-3333-3333-3333-333333333333';`,
  'inmutable')
await expectErr('invoice emitida: cambiar items bloqueado',
  `update invoices set items = '[]' where id = '33333333-3333-3333-3333-333333333333';`,
  'inmutable')
await expectOk('invoice emitida: marcar cobrada permitido (metadato de cobro)',
  `update invoices set status = 'cobrada', payment_date = '2026-09-12', payment_method = 'transferencia'
   where id = '33333333-3333-3333-3333-333333333333';`)
await expectErr('invoice emitida: DELETE bloqueado',
  `delete from invoices where id = '33333333-3333-3333-3333-333333333333';`,
  'anulaci')
await expectErr('invoice emitida: volver a borrador bloqueado',
  `update invoices set verifactu_estado = 'borrador' where id = '33333333-3333-3333-3333-333333333333';`,
  'Transici')
await expectErr('invoice: numero_fiscal duplicado mismo usuario rechazado', `
  insert into invoices (user_id, number, client_name, items, subtotal, iva, total, date, numero_fiscal)
  values ('${A}', 'X', 'C', '[]', 1, 0, 1, '2026-09-11', 'F-2026-000001');
`, 'duplicate key')
await expectOk('invoice: mismo numero_fiscal en OTRO usuario permitido (multi-tenant)', `
  insert into invoices (user_id, number, client_name, items, subtotal, iva, total, date, numero_fiscal)
  values ('${B}', 'X', 'C', '[]', 1, 0, 1, '2026-09-11', 'F-2026-000001');
`)
// anulación: registro de anulación + transición
const H2 = 'E'.repeat(64)
await expectOk('registro anulación #2 encadenado + invoice -> anulada', `
  insert into sif_registros (id, user_id, correlativo, tipo_registro, invoice_id,
    id_emisor_factura, num_serie_factura, fecha_expedicion, registro, primer_registro,
    huella_anterior, huella, fecha_hora_huso_gen)
  values ('55555555-5555-5555-5555-555555555555', '${A}', 2, 'anulacion',
    '33333333-3333-3333-3333-333333333333', 'B98407901', 'F-2026-000001',
    '2026-09-11', '{"tipo":"anulacion"}', false, '${H1}', '${H2}',
    '2026-09-11T11:00:00+02:00');
  update invoices set verifactu_estado = 'anulada',
    registro_anulacion_id = '55555555-5555-5555-5555-555555555555'
  where id = '33333333-3333-3333-3333-333333333333';
`)
await expectErr('invoice anulada: cualquier transición posterior bloqueada',
  `update invoices set verifactu_estado = 'emitida' where id = '33333333-3333-3333-3333-333333333333';`,
  'Transici')
await expectErr('invoice anulada: DELETE bloqueado',
  `delete from invoices where id = '33333333-3333-3333-3333-333333333333';`,
  'anulaci')

// ---------- 10. RLS multi-tenant ----------
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${A}', false);`)
const own = await db.query('select count(*)::int as n from sif_registros')
own.rows[0].n === 2 ? ok('RLS: usuario A ve sus 2 registros') : ko('RLS: usuario A ve sus 2 registros', `n=${own.rows[0].n}`)
await db.exec(`select set_config('request.jwt.claim.sub', '${B}', false);`)
const other = await db.query('select count(*)::int as n from sif_registros')
other.rows[0].n === 0 ? ok('RLS: usuario B no ve registros de A') : ko('RLS: usuario B no ve registros de A', `n=${other.rows[0].n}`)
await expectErr('RLS: authenticated no puede INSERT directo en sif_registros', `
  insert into sif_registros (user_id, correlativo, tipo_registro, id_emisor_factura,
    num_serie_factura, fecha_expedicion, tipo_factura, cuota_total, importe_total,
    registro, primer_registro, huella, fecha_hora_huso_gen)
  values ('${B}', 1, 'alta', 'B00000001', 'F-1', '2026-09-11', 'F1', 1, 1, '{}',
    true, '${'F'.repeat(64)}', '2026-09-11T10:00:00+02:00');
`, 'denied')
await expectErr('RLS: authenticated no puede UPDATE sif_outbox',
  `update sif_outbox set intentos = 99;`, 'denied')
await expectErr('RLS: B no puede reservar números de A',
  `select * from sif_reservar_numero('${A}', 'F', 2026);`, 'no coincide')
const rB = await db.query(`select * from sif_reservar_numero('${B}', 'F', 2026)`)
rB.rows[0].num_serie_factura === 'F-2026-000001'
  ? ok('RLS: B reserva su propio número vía función')
  : ko('RLS: B reserva su propio número vía función', JSON.stringify(rB.rows[0]))
await db.exec('reset role;')

// ---------- Resumen ----------
console.log(`\nTOTAL: ${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
