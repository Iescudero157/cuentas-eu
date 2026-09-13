// V07 — Batería de verificación del servicio de emisión sobre PGlite (Postgres
// real embebido, entorno Supabase simulado como en v03-migraciones.test.mjs).
// Verifica la transacción atómica sif_emitir_factura / sif_anular_factura:
// numeración correlativa, huella SQL === huella TypeScript (lib/verifactu),
// encadenamiento, outbox, inmutabilidad post-emisión, feature flag sif_config
// .activo, rectificativas, aislamiento multi-tenant y reconstrucción del XML
// (validado contra los XSD oficiales AEAT).
//
// Ejecutar:  npm i --no-save @electric-sql/pglite
//            node supabase/tests/v07-emision.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { huellaAlta, huellaAnulacion, formatearImporte, fechaHoraHusoGenRegistro } from '../../lib/verifactu/huella.ts'
import { sistemaInformaticoKuentas } from '../../lib/verifactu/registro-alta.ts'
import {
  prepararEntradaAlta,
  validarEmision,
  reconstruirRegistroAlta,
  reconstruirRegistroAnulacion,
} from '../../lib/verifactu/emision.ts'
import { facturaAppARegistroAnulacion } from '../../lib/verifactu/factura-app.ts'
import { validarRegistroXsd } from '../../lib/verifactu/tests/helpers/xsd-validator.mjs'

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

// ---------- 1. Esquema + migraciones (V03 completas + V07) ----------
const files = [
  ['schema.sql', `${REPO}/schema.sql`],
  ['schema-update.sql', `${REPO}/schema-update.sql`],
  ['m1 sif_config', `${REPO}/migrations/20260911100000_sif_config.sql`],
  ['m2 sif_series', `${REPO}/migrations/20260911100100_sif_series_numeracion.sql`],
  ['m3 sif_cadena_registros', `${REPO}/migrations/20260911100200_sif_cadena_registros.sql`],
  ['m4 sif_outbox_eventos', `${REPO}/migrations/20260911100300_sif_outbox_eventos.sql`],
  ['m5 invoices_estados', `${REPO}/migrations/20260911100400_invoices_estados_fiscales.sql`],
  ['m6 sif_emision (V07)', `${REPO}/migrations/20260913100000_sif_emision.sql`],
]
for (const [name, path] of files) {
  await expectOk(`aplica ${name}`, readFileSync(path, 'utf8'))
}
await expectOk('re-aplica m6 sif_emision (idempotente)',
  readFileSync(`${REPO}/migrations/20260913100000_sif_emision.sql`, 'utf8'))

// ---------- 2. Primitivas SQL === implementación TypeScript ----------
const CADENA_OFICIAL =
  'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00'
const HUELLA_OFICIAL = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60'
{
  const r = await db.query('select public.sif_sha256($1) as h', [CADENA_OFICIAL])
  check('sif_sha256 reproduce el vector oficial AEAT §6.1', r.rows[0].h === HUELLA_OFICIAL, r.rows[0].h)
}
for (const v of [0, 12.35, -12.3, 1234567.89, 100.5, 99999999.99]) {
  const r = await db.query('select public.sif_formatear_importe($1) as t', [v])
  check(`sif_formatear_importe(${v}) === formatearImporte TS`, r.rows[0].t === formatearImporte(v),
    `${r.rows[0].t} ≠ ${formatearImporte(v)}`)
}
for (const iso of ['2026-01-15T09:21:33Z', '2026-07-15T09:21:33Z']) {
  const r = await db.query(`select public.sif_fecha_hora_huso(timestamptz '${iso}') as t`)
  const esperado = fechaHoraHusoGenRegistro(new Date(iso))
  check(`sif_fecha_hora_huso(${iso}) === huella.ts (${esperado})`, r.rows[0].t === esperado, r.rows[0].t)
}

// ---------- 3. Datos semilla ----------
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const INV1 = '33333333-3333-3333-3333-333333333331'
const INV2 = '33333333-3333-3333-3333-333333333332'
const INV3 = '33333333-3333-3333-3333-333333333333'
const INVB = '44444444-4444-4444-4444-444444444441'
const NIF_A = 'B98407901'
const NIF_B = 'A58818501'

await expectOk('alta usuarios A y B + sif_config A (activo)', `
  insert into auth.users (id, email) values ('${A}', 'a@test.es'), ('${B}', 'b@test.es');
  insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion, activo)
  values ('${A}', '${NIF_A}', 'Empresa A SL', 'KU-TESTA', true);
`)

const ITEMS = '[{"description":"Desarrollo web","quantity":1,"unitPrice":100,"total":100}]'
await expectOk('facturas borrador de A', `
  insert into invoices (id, user_id, number, client_name, client_nif, items,
    subtotal, iva, iva_rate, irpf, irpf_rate, total, date)
  values
    ('${INV1}', '${A}', 'PROV-1', 'Cliente Uno SL', '12345678Z', '${ITEMS}', 100, 21, 21, 0, 0, 121, '2026-09-13'),
    ('${INV2}', '${A}', 'PROV-2', 'Cliente Dos', null, '${ITEMS}', 100, 10, 10, 0, 0, 110, '2026-09-13');
`)

// ---------- 4. Helper de emisión (mismo camino que lib/verifactu/emision.ts) ----------
const SI_A = sistemaInformaticoKuentas('KU-TESTA')
const CONFIG_A = {
  user_id: A, nif_obligado: NIF_A, nombre_razon: 'Empresa A SL',
  numero_instalacion: 'KU-TESTA', modalidad: 'verifactu', entorno_aeat: 'pruebas', activo: true,
}

async function filaInvoice(id) {
  const r = await db.query(`
    select id, user_id, number, date::text as date, client_name, client_nif, items,
           subtotal::float8 as subtotal, iva::float8 as iva, iva_rate, irpf::float8 as irpf,
           irpf_rate, total::float8 as total, verifactu_estado, numero_fiscal,
           tipo_factura, rectifica_invoice_id, tipo_rectificativa
      from invoices where id = $1`, [id])
  return r.rows[0]
}

async function emitir(invoiceId, { config = CONFIG_A, si = SI_A, opciones = {}, rectificadaId = null } = {}) {
  const inv = await filaInvoice(invoiceId)
  const rectificada = rectificadaId ? await filaInvoice(rectificadaId) : null
  const entrada = prepararEntradaAlta(inv, config, opciones, rectificada)
  const dry = validarEmision(entrada, si)
  const r = await db.query(
    'select * from public.sif_emitir_factura($1, $2, $3, $4, $5, $6)',
    [config.user_id, invoiceId, JSON.stringify({ entrada, sistemaInformatico: si }),
     Number(dry.cuotaTotal), Number(dry.importeTotal), opciones.serie ?? null]
  )
  return r.rows[0]
}

async function anular(invoiceId, { config = CONFIG_A, si = SI_A } = {}) {
  const inv = await filaInvoice(invoiceId)
  const entrada = facturaAppARegistroAnulacion(
    { invoice_number: inv.numero_fiscal, date: inv.date },
    { nif: config.nif_obligado, nombreRazon: config.nombre_razon }
  )
  const r = await db.query(
    'select * from public.sif_anular_factura($1, $2, $3)',
    [config.user_id, invoiceId, JSON.stringify({ entrada, sistemaInformatico: si })]
  )
  return r.rows[0]
}

function ddmmaaaa(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

// ---------- 5. Emisión del primer registro ----------
let r1
try {
  r1 = await emitir(INV1)
  ok('emisión #1 ejecutada')
} catch (e) { ko('emisión #1 ejecutada', e.message) }

if (r1) {
  check('  número correlativo F-2026-000001', r1.num_serie_factura === 'F-2026-000001', r1.num_serie_factura)
  check('  correlativo de cadena = 1', Number(r1.correlativo) === 1, String(r1.correlativo))
  check('  primer registro de la cadena', r1.primer_registro === true)
  check('  huella_anterior vacía', r1.huella_anterior === null)
  const huellaTS = huellaAlta({
    IDEmisorFactura: NIF_A,
    NumSerieFactura: r1.num_serie_factura,
    FechaExpedicionFactura: ddmmaaaa('2026-09-13'),
    TipoFactura: 'F1',
    CuotaTotal: '21.00',
    ImporteTotal: '121.00',
    FechaHoraHusoGenRegistro: r1.fecha_hora_huso_gen,
  }, null)
  check('  huella SQL === huellaAlta TypeScript', r1.huella === huellaTS, `${r1.huella} ≠ ${huellaTS}`)

  const inv = await filaInvoice(INV1)
  check('  factura → emitida', inv.verifactu_estado === 'emitida')
  check('  numero_fiscal y number actualizados', inv.numero_fiscal === 'F-2026-000001' && inv.number === 'F-2026-000001')
  check('  tipo_factura F1 persistido', inv.tipo_factura === 'F1')

  const outbox = await db.query('select estado from sif_outbox where registro_id = $1', [r1.registro_id])
  check('  registro encolado en outbox (pendiente)', outbox.rows[0]?.estado === 'pendiente')

  const cad = await db.query('select * from sif_cadena where user_id = $1', [A])
  check('  sif_cadena actualizada', Number(cad.rows[0].correlativo_ultimo) === 1 && cad.rows[0].ultima_huella === r1.huella)
}

// ---------- 6. Segundo registro: encadenamiento ----------
let r2
try {
  r2 = await emitir(INV2)
  ok('emisión #2 ejecutada')
} catch (e) { ko('emisión #2 ejecutada', e.message) }

if (r1 && r2) {
  check('  número correlativo F-2026-000002', r2.num_serie_factura === 'F-2026-000002', r2.num_serie_factura)
  check('  correlativo de cadena = 2', Number(r2.correlativo) === 2)
  check('  huella_anterior = huella del registro #1', r2.huella_anterior === r1.huella)
  const huellaTS = huellaAlta({
    IDEmisorFactura: NIF_A,
    NumSerieFactura: r2.num_serie_factura,
    FechaExpedicionFactura: ddmmaaaa('2026-09-13'),
    TipoFactura: 'F2',
    CuotaTotal: '10.00',
    ImporteTotal: '110.00',
    FechaHoraHusoGenRegistro: r2.fecha_hora_huso_gen,
  }, r1.huella)
  check('  huella SQL encadenada === TypeScript', r2.huella === huellaTS, `${r2.huella} ≠ ${huellaTS}`)
  const reg = await db.query('select registro from sif_registros where id = $1', [r2.registro_id])
  const enc = reg.rows[0].registro.encadenamiento
  check('  jsonb: registroAnterior correcto',
    enc?.registroAnterior?.huella === r1.huella && enc?.registroAnterior?.numSerieFactura === 'F-2026-000001',
    JSON.stringify(enc))
}

// ---------- 7. Reconstrucción del XML + sif_fijar_xml ----------
if (r1) {
  const reg = await db.query('select registro from sif_registros where id = $1', [r1.registro_id])
  let gen
  try {
    gen = reconstruirRegistroAlta(reg.rows[0].registro)
    ok('XML de alta reconstruido desde el jsonb persistido')
  } catch (e) { ko('XML de alta reconstruido desde el jsonb persistido', e.message) }
  if (gen) {
    check('  huella del XML reconstruido === huella registrada', gen.huella === r1.huella, gen.huella)
    check('  FechaHoraHuso del XML === registrada', gen.fechaHoraHusoGenRegistro === r1.fecha_hora_huso_gen)
    const val = await validarRegistroXsd(gen.xml)
    check('  XML reconstruido VALIDA contra los XSD oficiales AEAT', val.valida, val.errores.join(' | '))
    const fijado = await db.query('select public.sif_fijar_xml($1, $2, $3) as f', [A, r1.registro_id, gen.xml])
    check('  sif_fijar_xml fija el XML (true)', fijado.rows[0].f === true)
    const otra = await db.query('select public.sif_fijar_xml($1, $2, $3) as f', [A, r1.registro_id, '<otro/>'])
    check('  segundo sif_fijar_xml no re-escribe (false)', otra.rows[0].f === false)
    await expectErr('  UPDATE directo del XML fijado bloqueado (inmutable)',
      `update sif_registros set xml = '<hack/>' where id = '${r1.registro_id}';`, 'inmutable')
  }
}

// ---------- 8. Inmutabilidad de la factura emitida ----------
await expectErr('factura emitida: UPDATE de importes bloqueado',
  `update invoices set total = 999 where id = '${INV1}';`, 'inmutable')
await expectErr('factura emitida: DELETE bloqueado',
  `delete from invoices where id = '${INV1}';`, 'prohibido')

// ---------- 9. Emisión única y sin números quemados ----------
await expectErr('re-emitir una factura emitida rechazado', () => emitir(INV1), 'SIF_NO_BORRADOR')
{
  const s = await db.query(`select ultimo_numero from sif_series where user_id = $1 and serie = 'F'`, [A])
  check('el intento fallido NO consumió número de serie', s.rows[0].ultimo_numero === 2, JSON.stringify(s.rows))
}

// ---------- 10. Anulación (D-12) ----------
let ra
try {
  ra = await anular(INV1)
  ok('anulación de la factura #1 ejecutada')
} catch (e) { ko('anulación de la factura #1 ejecutada', e.message) }

if (ra && r2) {
  check('  correlativo = 3 (misma cadena que las altas)', Number(ra.correlativo) === 3)
  check('  huella_anterior = huella del alta #2', ra.huella_anterior === r2.huella)
  const huellaTS = huellaAnulacion({
    IDEmisorFacturaAnulada: NIF_A,
    NumSerieFacturaAnulada: 'F-2026-000001',
    FechaExpedicionFacturaAnulada: ddmmaaaa('2026-09-13'),
    FechaHoraHusoGenRegistro: ra.fecha_hora_huso_gen,
  }, r2.huella)
  check('  huella de anulación SQL === TypeScript', ra.huella === huellaTS, `${ra.huella} ≠ ${huellaTS}`)
  const inv = await filaInvoice(INV1)
  check('  factura → anulada + registro_anulacion enlazado', inv.verifactu_estado === 'anulada')
  const reg = await db.query('select registro, tipo_registro from sif_registros where id = $1', [ra.registro_id])
  check('  tipo_registro = anulacion', reg.rows[0].tipo_registro === 'anulacion')
  let genA
  try {
    genA = reconstruirRegistroAnulacion(reg.rows[0].registro)
    check('  XML de anulación reconstruido, huella coincide', genA.huella === ra.huella, genA?.huella)
  } catch (e) { ko('  XML de anulación reconstruido, huella coincide', e.message) }
  if (genA) {
    const val = await validarRegistroXsd(genA.xml)
    check('  XML de anulación VALIDA contra los XSD oficiales', val.valida, val.errores.join(' | '))
  }
  await expectErr('  anular dos veces rechazado', () => anular(INV1), 'SIF_NO_EMITIDA')
}

// ---------- 11. Rectificativa (R1, serie R) ----------
await expectOk('borrador rectificativa (rectifica a la factura #2)', `
  insert into invoices (id, user_id, number, client_name, client_nif, items,
    subtotal, iva, iva_rate, irpf, irpf_rate, total, date,
    rectifica_invoice_id, tipo_rectificativa)
  values ('${INV3}', '${A}', 'PROV-3', 'Cliente Dos', '12345678Z', '${ITEMS}',
    -50, -5, 10, 0, 0, -55, '2026-09-14', '${INV2}', 'I');
`)
let r3
try {
  r3 = await emitir(INV3, { rectificadaId: INV2 })
  ok('emisión de la rectificativa ejecutada')
} catch (e) { ko('emisión de la rectificativa ejecutada', e.message) }

if (r3 && ra) {
  check('  serie rectificativa R-2026-000001', r3.num_serie_factura === 'R-2026-000001', r3.num_serie_factura)
  check('  tipo R1', r3.tipo_factura === 'R1')
  check('  correlativo = 4, encadenada tras la anulación',
    Number(r3.correlativo) === 4 && r3.huella_anterior === ra.huella)
  const inv2 = await filaInvoice(INV2)
  check('  factura rectificada → estado rectificada', inv2.verifactu_estado === 'rectificada')
  const reg = await db.query('select registro from sif_registros where id = $1', [r3.registro_id])
  const gen = reconstruirRegistroAlta(reg.rows[0].registro)
  check('  huella rectificativa reconstruida coincide', gen.huella === r3.huella)
  const val = await validarRegistroXsd(gen.xml)
  check('  XML rectificativa VALIDA contra XSD (FacturasRectificadas)', val.valida, val.errores.join(' | '))
}

// ---------- 12. Feature flag por empresa ----------
await expectOk('factura borrador de B', `
  insert into invoices (id, user_id, number, client_name, items, subtotal, iva, iva_rate,
    irpf, irpf_rate, total, date)
  values ('${INVB}', '${B}', 'PROV-B1', 'Cliente B', '${ITEMS}', 100, 21, 21, 0, 0, 121, '2026-09-13');
`)
const CONFIG_B = { ...CONFIG_A, user_id: B, nif_obligado: NIF_B, nombre_razon: 'Empresa B SA', numero_instalacion: 'KU-TESTB' }
const SI_B = sistemaInformaticoKuentas('KU-TESTB')

await expectErr('B sin sif_config → SIF_NO_CONFIGURADO',
  () => emitir(INVB, { config: CONFIG_B, si: SI_B }), 'SIF_NO_CONFIGURADO')
await expectOk('sif_config B con activo=false', `
  insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion, activo)
  values ('${B}', '${NIF_B}', 'Empresa B SA', 'KU-TESTB', false);
`)
await expectErr('B con módulo desactivado → SIF_INACTIVO',
  () => emitir(INVB, { config: CONFIG_B, si: SI_B }), 'SIF_INACTIVO')
await db.exec(`update sif_config set activo = true where user_id = '${B}';`)
let rb
try {
  rb = await emitir(INVB, { config: CONFIG_B, si: SI_B })
  ok('B activado emite con normalidad')
} catch (e) { ko('B activado emite con normalidad', e.message) }
if (rb) {
  check('  cadena de B independiente (correlativo 1, primer registro)',
    Number(rb.correlativo) === 1 && rb.primer_registro === true)
  check('  numeración de B independiente (F-2026-000001)', rb.num_serie_factura === 'F-2026-000001')
}

// ---------- 13. Autenticación: suplantación bloqueada ----------
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${B}', false);`)
await expectErr('authenticated B no puede emitir facturas de A',
  `select * from public.sif_emitir_factura('${A}', '${INV2}', '{"entrada":{"tipoFactura":"F1","emisor":{"nif":"${NIF_A}"}}}', 1, 1, null);`,
  'no coincide')
await expectErr('authenticated B no puede fijar XML de registros de A',
  `select public.sif_fijar_xml('${A}', '${r2?.registro_id ?? INV2}', '<x/>');`,
  'no coincide')
await db.exec('reset role;')

// ---------- Resumen ----------
console.log(`\nTOTAL: ${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
