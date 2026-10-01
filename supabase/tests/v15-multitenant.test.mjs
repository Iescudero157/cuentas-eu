// V15 — Batería multi-tenant y concurrencia sobre PGlite (Postgres real
// embebido, entorno Supabase simulado como en v03/v07/v10/v12).
//
// Cubre el ítem V15 del plan: una cadena por obligado (NIF) con aislamiento
// entre empresas, carreras de emisiones del mismo obligado y un lote de 100
// facturas, verificando la cadena resultante con el detector SQL de V12
// (sif_detectar_anomalias) Y con el verificador TypeScript independiente
// (lib/verifactu/integridad.ts).
//
// LÍMITE CONOCIDO: PGlite es mono-sesión, por lo que dos transacciones nunca
// están abiertas A LA VEZ; las llamadas concurrentes (Promise.all) se
// intercalan a nivel de sentencia. Eso equivale al resultado que garantiza el
// SELECT ... FOR UPDATE de sif_cadena en Postgres real (serialización por
// obligado), así que aquí se verifican los INVARIANTES tras la ráfaga
// (correlativos sin huecos, numeración única, huellas encadenadas) y, además,
// el ORDEN GLOBAL de bloqueos (invoices → sif_cadena) se comprueba de forma
// estática sobre el fuente de las funciones (guarda de regresión del
// interbloqueo rectificativa/anulación corregido en la migración V15).
//
// Ejecutar:  npm i --no-save @electric-sql/pglite
//            node supabase/tests/v15-multitenant.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { sistemaInformaticoKuentas } from '../../lib/verifactu/registro-alta.ts'
import { prepararEntradaAlta, validarEmision } from '../../lib/verifactu/emision.ts'
import { facturaAppARegistroAnulacion } from '../../lib/verifactu/factura-app.ts'
import { verificarRegistrosObligado } from '../../lib/verifactu/integridad.ts'

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

// ---------- 1. Esquema + TODAS las migraciones (V03..V15) ----------
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
]
for (const [name, path] of files) {
  await expectOk(`aplica ${name}`, readFileSync(path, 'utf8'))
}
await expectOk('re-aplica m10 sif_multitenant (idempotente)',
  readFileSync(`${REPO}/migrations/20260919110000_sif_multitenant.sql`, 'utf8'))

// ---------- 2. Guardas estáticas del orden de bloqueos ----------
// PGlite no puede reproducir un interbloqueo real (mono-sesión); esta guarda
// evita que una edición futura reordene los FOR UPDATE y reintroduzca el
// deadlock rectificativa/anulación que corrige la migración V15.
{
  const r = await db.query(
    `select proname, prosrc from pg_proc where proname in
     ('sif_emitir_factura','sif_anular_factura','sif_subsanar_registro')`)
  const src = Object.fromEntries(r.rows.map((x) => [x.proname, x.prosrc]))
  const CADENA_LOCK = 'from public.sif_cadena c where c.user_id = p_user_id for update'

  for (const fn of ['sif_emitir_factura', 'sif_anular_factura', 'sif_subsanar_registro']) {
    check(`${fn} serializa con FOR UPDATE de sif_cadena`,
      (src[fn] ?? '').includes(CADENA_LOCK), 'lock de cadena ausente')
  }
  const emitir = src.sif_emitir_factura ?? ''
  const posRect = emitir.indexOf('i.id = v_invoice.rectifica_invoice_id and i.user_id = p_user_id')
  const posCadena = emitir.indexOf(CADENA_LOCK)
  check('emisión bloquea la factura RECTIFICADA (scoped al usuario) con FOR UPDATE',
    posRect > 0 && emitir.slice(posRect, posRect + 200).includes('for update'),
    'lock de la rectificada ausente')
  check('orden global de locks: rectificada (invoices) ANTES que sif_cadena',
    posRect > 0 && posCadena > posRect, `posRect=${posRect} posCadena=${posCadena}`)
  const posInvoice = emitir.indexOf('i.id = p_invoice_id and i.user_id = p_user_id')
  check('orden global de locks: factura a emitir ANTES que sif_cadena',
    posInvoice > 0 && posCadena > posInvoice, `posInvoice=${posInvoice} posCadena=${posCadena}`)
}

// ---------- 3. Datos semilla: 4 obligados (tenants) ----------
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const C = '33333333-3333-3333-3333-333333333333'
const D = '44444444-4444-4444-4444-444444444444'
const TENANTS = {
  [A]: { nif: 'B98407901', razon: 'Empresa A SL', inst: 'KU-T15A' },
  [B]: { nif: 'A58818501', razon: 'Empresa B SA', inst: 'KU-T15B' },
  [C]: { nif: '00000001R', razon: 'Autonoma C', inst: 'KU-T15C' },
  [D]: { nif: '99999999R', razon: 'Autonomo D', inst: 'KU-T15D' },
}
const cfg = (uid) => ({
  user_id: uid, nif_obligado: TENANTS[uid].nif, nombre_razon: TENANTS[uid].razon,
  numero_instalacion: TENANTS[uid].inst, modalidad: 'verifactu', entorno_aeat: 'pruebas', activo: true,
})
const si = (uid) => sistemaInformaticoKuentas(TENANTS[uid].inst)

await expectOk('alta de los 4 usuarios + sif_config activos', `
  insert into auth.users (id, email) values
    ('${A}', 'a@t.es'), ('${B}', 'b@t.es'), ('${C}', 'c@t.es'), ('${D}', 'd@t.es');
  insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion, activo) values
    ('${A}', '${TENANTS[A].nif}', '${TENANTS[A].razon}', '${TENANTS[A].inst}', true),
    ('${B}', '${TENANTS[B].nif}', '${TENANTS[B].razon}', '${TENANTS[B].inst}', true),
    ('${C}', '${TENANTS[C].nif}', '${TENANTS[C].razon}', '${TENANTS[C].inst}', true),
    ('${D}', '${TENANTS[D].nif}', '${TENANTS[D].razon}', '${TENANTS[D].inst}', true);
`)

const ITEMS = '[{"description":"Servicio","quantity":1,"unitPrice":100,"total":100}]'
// Prefijos de UUID de factura por tenant (sufijo = nº secuencial)
const invId = (uid, n) => `${uid.slice(0, 8)}-0000-4000-8000-${String(n).padStart(12, '0')}`

async function crearBorradores(uid, desde, hasta) {
  const values = []
  for (let n = desde; n <= hasta; n++) {
    values.push(`('${invId(uid, n)}', '${uid}', 'PROV-${n}', 'Cliente ${n}', '${ITEMS}',
      100, 21, 21, 0, 0, 121, '2026-09-19')`)
  }
  await db.exec(`insert into invoices (id, user_id, number, client_name, items,
    subtotal, iva, iva_rate, irpf, irpf_rate, total, date)
    values ${values.join(',')};`)
}

// ---------- 4. Helpers de emisión/anulación (mismo camino que la API) ----------
async function filaInvoice(id) {
  const r = await db.query(`
    select id, user_id, number, date::text as date, client_name, client_nif, items,
           subtotal::float8 as subtotal, iva::float8 as iva, iva_rate, irpf::float8 as irpf,
           irpf_rate, total::float8 as total, verifactu_estado, numero_fiscal,
           tipo_factura, rectifica_invoice_id, tipo_rectificativa
      from invoices where id = $1`, [id])
  return r.rows[0]
}

async function emitir(uid, invoiceId, { opciones = {}, rectificadaId = null } = {}) {
  const config = cfg(uid)
  const inv = await filaInvoice(invoiceId)
  const rectificada = rectificadaId ? await filaInvoice(rectificadaId) : null
  const entrada = prepararEntradaAlta(inv, config, opciones, rectificada)
  const dry = validarEmision(entrada, si(uid))
  const r = await db.query(
    'select * from public.sif_emitir_factura($1, $2, $3, $4, $5, $6)',
    [uid, invoiceId, JSON.stringify({ entrada, sistemaInformatico: si(uid) }),
     Number(dry.cuotaTotal), Number(dry.importeTotal), opciones.serie ?? null]
  )
  return r.rows[0]
}

async function anular(uid, invoiceId) {
  const config = cfg(uid)
  const inv = await filaInvoice(invoiceId)
  const entrada = facturaAppARegistroAnulacion(
    { invoice_number: inv.numero_fiscal, date: inv.date },
    { nif: config.nif_obligado, nombreRazon: config.nombre_razon }
  )
  const r = await db.query(
    'select * from public.sif_anular_factura($1, $2, $3)',
    [uid, invoiceId, JSON.stringify({ entrada, sistemaInformatico: si(uid) })]
  )
  return r.rows[0]
}

async function estadoTenant(uid) {
  const regs = await db.query(
    `select correlativo, num_serie_factura, huella, huella_anterior, primer_registro,
            id_emisor_factura
       from sif_registros where user_id = $1 order by correlativo`, [uid])
  const cad = await db.query('select * from sif_cadena where user_id = $1', [uid])
  return { regs: regs.rows, cadena: cad.rows[0] ?? null }
}

/** Invariantes de cadena tras una ráfaga: correlativos 1..n sin huecos,
 *  numeración única, huellas encadenadas y NIF único (una cadena por obligado). */
function comprobarInvariantes(nombre, { regs, cadena }, nifEsperado) {
  const n = regs.length
  const correlativos = regs.map((r) => Number(r.correlativo))
  check(`${nombre}: correlativos 1..${n} sin huecos ni duplicados`,
    correlativos.length === n && correlativos.every((c, i) => c === i + 1),
    JSON.stringify(correlativos))
  const numeros = new Set(regs.map((r) => r.num_serie_factura))
  check(`${nombre}: ${n} NumSerieFactura únicos`, numeros.size === n, `${numeros.size} únicos`)
  let enlazada = n > 0 && regs[0].primer_registro === true && regs[0].huella_anterior === null
  for (let i = 1; i < n; i++) {
    if (regs[i].huella_anterior !== regs[i - 1].huella || regs[i].primer_registro) { enlazada = false; break }
  }
  check(`${nombre}: huellas encadenadas (huella_anterior[i] = huella[i-1])`, enlazada)
  check(`${nombre}: todos los registros con el NIF del obligado (${nifEsperado})`,
    regs.every((r) => r.id_emisor_factura === nifEsperado))
  check(`${nombre}: sif_cadena sincronizada con el último registro`,
    cadena && Number(cadena.correlativo_ultimo) === n && (n === 0 || cadena.ultima_huella === regs[n - 1].huella),
    JSON.stringify({ correlativo_ultimo: cadena?.correlativo_ultimo, n }))
}

async function anomalias(uid) {
  const r = await db.query('select codigo, correlativo, detalle from public.sif_detectar_anomalias($1)', [uid])
  return r.rows
}

// ---------- 5. Emisiones INTERCALADAS de 3 tenants (aislamiento bajo carrera) ----------
await crearBorradores(A, 1, 3)
await crearBorradores(B, 1, 3)
await crearBorradores(C, 1, 3)
{
  // 9 emisiones de 3 obligados disparadas a la vez, intercaladas al azar
  const tareas = []
  for (let n = 1; n <= 3; n++) for (const uid of [A, B, C]) tareas.push([uid, invId(uid, n)])
  tareas.sort(() => Math.random() - 0.5)
  const res = await Promise.allSettled(tareas.map(([uid, id]) => emitir(uid, id)))
  const fallos = res.filter((r) => r.status === 'rejected')
  check('ráfaga intercalada A/B/C: las 9 emisiones aceptadas', fallos.length === 0,
    fallos.map((f) => f.reason?.message).join(' | '))

  for (const uid of [A, B, C]) {
    comprobarInvariantes(`tenant ${TENANTS[uid].razon}`, await estadoTenant(uid), TENANTS[uid].nif)
  }
  // Las cadenas no se cruzan: las 3 primeras huellas (una por tenant) difieren
  const primeras = await db.query(
    `select huella from sif_registros where correlativo = 1 and user_id in ('${A}','${B}','${C}')`)
  check('cadenas independientes: 3 primeras huellas distintas',
    new Set(primeras.rows.map((r) => r.huella)).size === 3)
  // Numeración por obligado: cada uno arranca en F-2026-000001
  const primerosNum = await db.query(
    `select user_id, num_serie_factura from sif_registros where correlativo = 1`)
  check('numeración independiente por obligado (todas arrancan en F-2026-000001)',
    primerosNum.rows.every((r) => r.num_serie_factura === 'F-2026-000001'))
}

// ---------- 6. RLS: un tenant autenticado SOLO ve lo suyo ----------
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${B}', false);`)
{
  for (const [tabla, propias] of [
    ['sif_registros', 3], ['sif_cadena', 1], ['sif_series', 1], ['sif_outbox', 3], ['sif_config', 1],
  ]) {
    const r = await db.query(`select count(*)::int as n, count(*) filter (where user_id = '${B}')::int as own from ${tabla}`)
    check(`RLS ${tabla}: authenticated B ve ${propias} filas y todas suyas`,
      r.rows[0].n === propias && r.rows[0].own === propias,
      `ve ${r.rows[0].n} (${r.rows[0].own} suyas)`)
  }
  const inv = await db.query(`select count(*) filter (where user_id <> '${B}')::int as ajenas from invoices`)
  check('RLS invoices: authenticated B no ve facturas ajenas', inv.rows[0].ajenas === 0,
    `${inv.rows[0].ajenas} ajenas visibles`)
}

// ---------- 7. Suplantación: B no puede operar la cadena de A ----------
await expectErr('B no puede emitir facturas de A (sif_emitir_factura)',
  `select * from public.sif_emitir_factura('${A}', '${invId(A, 1)}',
     '{"entrada":{"tipoFactura":"F1","emisor":{"nif":"${TENANTS[A].nif}"}}}', 1, 1, null);`,
  'no coincide')
await expectErr('B no puede anular facturas de A (sif_anular_factura)',
  `select * from public.sif_anular_factura('${A}', '${invId(A, 1)}', '{}');`, 'no coincide')
await expectErr('B no puede subsanar registros de A (sif_subsanar_registro)',
  `select * from public.sif_subsanar_registro('${A}', '${invId(A, 1)}', '{}', 1, 1);`, 'no coincide')
await expectErr('B no puede reservar numeración de A (sif_reservar_numero)',
  `select * from public.sif_reservar_numero('${A}', 'F', 2026, 'ordinaria');`, 'no coincide')
// Volver a superusuario Y limpiar el claim JWT (set_config es de sesión y
// sobrevive al reset role; sin esto auth.uid() seguiría devolviendo B)
await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)

// ---------- 8. Identidad de la cadena: el NIF del obligado no puede cambiar ----------
await expectErr('sif_config_guard: cambiar nif_obligado con registros generados falla',
  `update sif_config set nif_obligado = 'B12345674' where user_id = '${A}';`, 'no pueden cambiar')

// ---------- 9. Rectificativa cross-tenant rechazada (SIF_RECTIFICADA) ----------
{
  // Borrador de A que "rectifica" una factura EMITIDA de B (la FK lo permite;
  // la función debe rechazarlo aunque la capa API fallara).
  const RX = invId(A, 900)
  await db.exec(`
    insert into invoices (id, user_id, number, client_name, client_nif, items, subtotal, iva, iva_rate,
      irpf, irpf_rate, total, date, rectifica_invoice_id, tipo_rectificativa)
    values ('${RX}', '${A}', 'PROV-RX', 'Cliente X', '12345678Z', '${ITEMS}',
      -50, -10.5, 21, 0, 0, -60.5, '2026-09-19', '${invId(B, 1)}', 'I');`)
  await expectErr('emitir rectificativa que apunta a factura de OTRO tenant → SIF_RECTIFICADA',
    () => emitir(A, RX, { rectificadaId: invId(B, 1) }), 'SIF_RECTIFICADA')
  const s = await db.query(`select ultimo_numero from sif_series where user_id = $1 and serie = 'R'`, [A])
  check('  el intento cross-tenant no quemó numeración R de A', s.rows.length === 0, JSON.stringify(s.rows))
  await db.exec(`delete from invoices where id = '${RX}';`)
}

// ---------- 10. Carrera rectificativa vs anulación de la rectificada ----------
// Escenario del interbloqueo corregido en la migración V15. En PGlite las dos
// llamadas se serializan (cualquier orden es válido); se verifica que el
// resultado final sea coherente y la cadena íntegra en ambos órdenes.
{
  const R1 = invId(A, 901)
  await db.exec(`
    insert into invoices (id, user_id, number, client_name, client_nif, items, subtotal, iva, iva_rate,
      irpf, irpf_rate, total, date, rectifica_invoice_id, tipo_rectificativa)
    values ('${R1}', '${A}', 'PROV-R1', 'Cliente 1', '12345678Z', '${ITEMS}',
      -50, -10.5, 21, 0, 0, -60.5, '2026-09-19', '${invId(A, 1)}', 'I');`)
  const [rEmitir, rAnular] = await Promise.allSettled([
    emitir(A, R1, { rectificadaId: invId(A, 1) }),
    anular(A, invId(A, 1)),
  ])
  check('carrera R/anulación: la rectificativa se emite', rEmitir.status === 'fulfilled',
    rEmitir.reason?.message)
  const anularOk = rAnular.status === 'fulfilled'
  const anularEsperado = anularOk ||
    String(rAnular.reason?.message ?? '').includes('SIF_NO_EMITIDA')
  check('carrera R/anulación: la anulación gana o falla con SIF_NO_EMITIDA (nunca deadlock)',
    anularEsperado, rAnular.reason?.message)
  const orig = await filaInvoice(invId(A, 1))
  check('carrera R/anulación: estado final coherente de la factura original',
    orig.verifactu_estado === (anularOk ? 'anulada' : 'rectificada'), orig.verifactu_estado)
  const an = await anomalias(A)
  check('carrera R/anulación: cadena de A sin anomalías (detector SQL V12)',
    an.length === 0, JSON.stringify(an))
}

// ---------- 11. Carreras sobre la MISMA factura ----------
{
  await crearBorradores(B, 10, 10)
  const doble = await Promise.allSettled([emitir(B, invId(B, 10)), emitir(B, invId(B, 10))])
  const emitidas = doble.filter((r) => r.status === 'fulfilled')
  const rechazadas = doble.filter((r) => r.status === 'rejected')
  check('doble emisión concurrente: exactamente UNA gana', emitidas.length === 1,
    `${emitidas.length} emitidas`)
  check('doble emisión concurrente: la otra falla con SIF_NO_BORRADOR',
    rechazadas.length === 1 && String(rechazadas[0].reason?.message).includes('SIF_NO_BORRADOR'),
    rechazadas[0]?.reason?.message)
  const s = await db.query(`select ultimo_numero from sif_series where user_id = $1 and serie = 'F'`, [B])
  check('doble emisión concurrente: solo se consumió UN número de serie',
    s.rows[0].ultimo_numero === 4, JSON.stringify(s.rows))

  const dobleAnul = await Promise.allSettled([anular(B, invId(B, 10)), anular(B, invId(B, 10))])
  const anuladas = dobleAnul.filter((r) => r.status === 'fulfilled')
  const rechAnul = dobleAnul.filter((r) => r.status === 'rejected')
  check('doble anulación concurrente: exactamente UNA gana', anuladas.length === 1,
    `${anuladas.length} anuladas`)
  check('doble anulación concurrente: la otra falla con SIF_NO_EMITIDA',
    rechAnul.length === 1 && String(rechAnul[0].reason?.message).includes('SIF_NO_EMITIDA'),
    rechAnul[0]?.reason?.message)
  const an = await anomalias(B)
  check('cadena de B sin anomalías tras las carreras', an.length === 0, JSON.stringify(an))
}

// ---------- 12. Lote de 100 facturas (mismo obligado, ráfaga total) ----------
{
  await crearBorradores(D, 1, 100)
  // Las 100 emisiones del tenant D + 5 de C disparadas A LA VEZ (el lote no
  // debe contaminar la cadena de otro obligado que emite en paralelo).
  await crearBorradores(C, 10, 14)
  const antes = Object.fromEntries((await db.query(`
    select user_id, count(*)::int as n from sif_registros
     where user_id in ('${A}','${B}','${C}') group by user_id`)).rows
    .map((r) => [r.user_id, r.n]))
  const tareas = []
  for (let n = 1; n <= 100; n++) tareas.push([D, invId(D, n)])
  for (let n = 10; n <= 14; n++) tareas.push([C, invId(C, n)])
  tareas.sort(() => Math.random() - 0.5)
  const t0 = Date.now()
  const res = await Promise.allSettled(tareas.map(([uid, id]) => emitir(uid, id)))
  const ms = Date.now() - t0
  const fallos = res.filter((r) => r.status === 'rejected')
  check(`lote: 105 emisiones concurrentes aceptadas (${ms} ms)`, fallos.length === 0,
    fallos.slice(0, 3).map((f) => f.reason?.message).join(' | '))

  const estD = await estadoTenant(D)
  comprobarInvariantes('lote D (100 registros)', estD, TENANTS[D].nif)
  check('lote D: numeración F-2026-000001..000100 completa',
    estD.regs.length === 100 &&
    estD.regs.map((r) => r.num_serie_factura).sort().join() ===
      Array.from({ length: 100 }, (_, i) => `F-2026-${String(i + 1).padStart(6, '0')}`).sort().join())
  const serie = await db.query(`select ultimo_numero from sif_series where user_id = $1 and serie = 'F'`, [D])
  check('lote D: contador de serie exacto (100, sin números quemados)',
    serie.rows[0].ultimo_numero === 100, JSON.stringify(serie.rows))
  const outbox = await db.query(
    `select count(*)::int as n from sif_outbox o join sif_registros r on r.id = o.registro_id
      where o.user_id = $1 and o.estado = 'pendiente'`, [D])
  check('lote D: 100 registros pendientes en el outbox', outbox.rows[0].n === 100,
    String(outbox.rows[0].n))

  // Verificación de integridad por partida doble: detector SQL (V12) y
  // verificador TypeScript independiente (misma librería de huella que V04).
  const anSql = await anomalias(D)
  check('lote D: 0 anomalías según sif_detectar_anomalias (SQL)', anSql.length === 0,
    JSON.stringify(anSql.slice(0, 3)))
  const filas = await db.query(`
    select id, correlativo, tipo_registro, id_emisor_factura, num_serie_factura,
           fecha_expedicion::text as fecha_expedicion, tipo_factura, cuota_total,
           importe_total, primer_registro, huella_anterior, huella,
           fecha_hora_huso_gen, registro, estado_remision
      from sif_registros where user_id = $1 order by correlativo`, [D])
  const cad = await db.query(
    'select correlativo_ultimo, ultima_huella from sif_cadena where user_id = $1', [D])
  const informe = verificarRegistrosObligado(filas.rows, cad.rows[0])
  check('lote D: 0 anomalías según el verificador TypeScript (integridad.ts)',
    informe.anomalias.length === 0, JSON.stringify(informe.anomalias.slice(0, 3)))
  check('lote D: última huella TS === sif_cadena.ultima_huella',
    informe.ultimaHuella === cad.rows[0].ultima_huella)

  // El lote no ha contaminado a los demás obligados: A y B intactos, C +5
  const despues = Object.fromEntries((await db.query(`
    select user_id, count(*)::int as n from sif_registros
     where user_id in ('${A}','${B}','${C}') group by user_id`)).rows
    .map((r) => [r.user_id, r.n]))
  check('lote D: A y B intactos, C exactamente +5',
    despues[A] === antes[A] && despues[B] === antes[B] && despues[C] === antes[C] + 5,
    JSON.stringify({ antes, despues }))
  comprobarInvariantes('tenant C tras emitir en paralelo con el lote', await estadoTenant(C), TENANTS[C].nif)
  const anTodos = await db.query('select count(*)::int as n from public.sif_detectar_anomalias(null)')
  check('0 anomalías en TODOS los obligados a la vez (detector global)',
    anTodos.rows[0].n === 0, String(anTodos.rows[0].n))
}

// ---------- Resumen ----------
console.log(`\nTOTAL: ${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
