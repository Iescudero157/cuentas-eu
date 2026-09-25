// V10 — Batería de verificación de la cola de remisión sobre PGlite (Postgres
// real embebido, mismo entorno Supabase simulado que v03/v07).
// Verifica las funciones SQL de 20260918100000_sif_remision.sql: reclamo
// atómico de lotes (pendiente→en_envio, registros→sending), control de flujo
// TiempoEsperaEnvio, resolución con estados internos/CSV, fallos con backoff
// exponencial (cap 60 min) e incidencia, circuit breaker por obligado, rescate
// de lotes zombis, rechazos finales y aislamiento multi-tenant.
//
// Ejecutar:  npm i --no-save @electric-sql/pglite   (ya en devDependencies)
//            node supabase/tests/v10-remision.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { sistemaInformaticoKuentas } from '../../lib/verifactu/registro-alta.ts'
import { prepararEntradaAlta, validarEmision } from '../../lib/verifactu/emision.ts'

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

// ---------- 1. Esquema + migraciones (V03 + V07 + V10) ----------
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
]
for (const [name, path] of files) {
  await expectOk(`aplica ${name}`, readFileSync(path, 'utf8'))
}
await expectOk('re-aplica m7 sif_remision (idempotente)',
  readFileSync(`${REPO}/migrations/20260918100000_sif_remision.sql`, 'utf8'))

// ---------- 2. Backoff ----------
for (const [intentos, minutos] of [[null, 2], [0, 2], [1, 2], [2, 4], [3, 8], [5, 32], [6, 60], [10, 60]]) {
  const r = await db.query('select extract(epoch from public.sif_backoff_remision($1))/60 as m', [intentos])
  check(`backoff(${intentos}) = ${minutos} min (cap 60: reintento ≥1/hora, art. 16 Orden)`,
    Number(r.rows[0].m) === minutos, String(r.rows[0].m))
}

// ---------- 3. Datos semilla + emisiones (mismo camino que V07) ----------
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const NIF_A = 'B98407901'
const NIF_B = 'A58818501'
const INVS_A = Array.from({ length: 5 }, (_, i) => `33333333-3333-3333-3333-33333333333${i + 1}`)
const INV_B = '44444444-4444-4444-4444-444444444441'

const ITEMS = '[{"description":"Desarrollo web","quantity":1,"unitPrice":100,"total":100}]'
await expectOk('alta usuarios y configuraciones activas A y B', `
  insert into auth.users (id, email) values ('${A}', 'a@test.es'), ('${B}', 'b@test.es');
  insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion, activo)
  values ('${A}', '${NIF_A}', 'Empresa A SL', 'KU-TESTA', true),
         ('${B}', '${NIF_B}', 'Empresa B SL', 'KU-TESTB', true);
  insert into invoices (id, user_id, number, client_name, client_nif, items,
    subtotal, iva, iva_rate, irpf, irpf_rate, total, date)
  values ${INVS_A.map((id, i) => `('${id}', '${A}', 'PROV-${i + 1}', 'Cliente SL', '12345678Z', '${ITEMS}', 100, 21, 21, 0, 0, 121, '2026-09-18')`).join(',\n         ')},
         ('${INV_B}', '${B}', 'PROV-B1', 'Cliente B', null, '${ITEMS}', 100, 21, 21, 0, 0, 121, '2026-09-18');
`)

const CONFIGS = {
  [A]: { user_id: A, nif_obligado: NIF_A, nombre_razon: 'Empresa A SL', numero_instalacion: 'KU-TESTA', modalidad: 'verifactu', entorno_aeat: 'pruebas', activo: true },
  [B]: { user_id: B, nif_obligado: NIF_B, nombre_razon: 'Empresa B SL', numero_instalacion: 'KU-TESTB', modalidad: 'verifactu', entorno_aeat: 'pruebas', activo: true },
}

async function emitir(invoiceId, userId) {
  const config = CONFIGS[userId]
  const si = sistemaInformaticoKuentas(config.numero_instalacion)
  const r0 = await db.query(`
    select id, user_id, number, date::text as date, client_name, client_nif, items,
           subtotal::float8 as subtotal, iva::float8 as iva, iva_rate, irpf::float8 as irpf,
           irpf_rate, total::float8 as total, verifactu_estado, numero_fiscal,
           tipo_factura, rectifica_invoice_id, tipo_rectificativa
      from invoices where id = $1`, [invoiceId])
  const entrada = prepararEntradaAlta(r0.rows[0], config, {}, null)
  const dry = validarEmision(entrada, si)
  const r = await db.query(
    'select * from public.sif_emitir_factura($1, $2, $3, $4, $5, null)',
    [userId, invoiceId, JSON.stringify({ entrada, sistemaInformatico: si }),
     Number(dry.cuotaTotal), Number(dry.importeTotal)]
  )
  return r.rows[0]
}

const regsA = []
for (const inv of INVS_A.slice(0, 3)) regsA.push(await emitir(inv, A))
const regB = await emitir(INV_B, B)
// El XML lo fija la capa Next tras la emisión (V07); aquí lo fijamos solo para
// el primer registro, para cubrir ambos caminos del worker: XML fijado y XML
// null (regenerable determinista desde el jsonb).
await db.query('select public.sif_fijar_xml($1, $2, $3)',
  [A, regsA[0].registro_id, '<sf:RegistroAlta>fijado-en-emision</sf:RegistroAlta>'])
check('3 emisiones de A y 1 de B encoladas en el outbox',
  (await db.query(`select count(*)::int as n from sif_outbox where estado = 'pendiente'`)).rows[0].n === 4)

// ---------- 4. sif_remision_pendientes ----------
{
  const r = await db.query('select * from public.sif_remision_pendientes()')
  check('pendientes: A con 3 y B con 1', r.rows.length === 2
    && r.rows.some((x) => x.user_id === A && Number(x.pendientes) === 3)
    && r.rows.some((x) => x.user_id === B && Number(x.pendientes) === 1), JSON.stringify(r.rows))
}

// ---------- 5. Reclamo de lote (≤1000, atómico) ----------
let lote1
{
  const r = await db.query('select * from public.sif_outbox_reclamar_lote($1, $2)', [A, 2])
  check('reclama 2 de 3 (límite del lote respetado)', r.rows.length === 2, String(r.rows.length))
  lote1 = r.rows[0]?.lote_id
  check('  lote_id único asignado a las filas', Boolean(lote1) && r.rows.every((x) => x.lote_id === lote1))
  check('  orden por correlativo de cadena',
    r.rows[0].registro_id === regsA[0].registro_id && r.rows[1].registro_id === regsA[1].registro_id,
    JSON.stringify(r.rows.map((x) => x.registro_id)))
  check('  devuelve el XML fijado (fila 1) y null regenerable con su jsonb (fila 2)',
    r.rows[0].xml === '<sf:RegistroAlta>fijado-en-emision</sf:RegistroAlta>'
    && r.rows[1].xml === null && r.rows[1].registro?.entrada?.numSerieFactura === regsA[1].num_serie_factura
    && r.rows[1].huella === regsA[1].huella,
    JSON.stringify({ xml0: r.rows[0].xml, xml1: r.rows[1].xml }))
  check('  intentos incrementado a 1', r.rows.every((x) => x.intentos === 1))
  const o = await db.query(`select count(*)::int as n from sif_outbox where lote_id = $1 and estado = 'en_envio'`, [lote1])
  check('  outbox pendiente→en_envio', o.rows[0].n === 2)
  const s = await db.query(`select count(*)::int as n from sif_registros r join sif_outbox o on o.registro_id = r.id
    where o.lote_id = $1 and r.estado_remision = 'sending'`, [lote1])
  check('  sif_registros generated→sending', s.rows[0].n === 2)
}

// Segundo reclamo inmediato: solo queda la 3ª (las en_envio no son reclamables)
let lote2
{
  const r = await db.query('select * from public.sif_outbox_reclamar_lote($1, 1000)', [A])
  check('segundo reclamo devuelve solo la 3ª fila (en_envio excluidas)',
    r.rows.length === 1 && r.rows[0].registro_id === regsA[2].registro_id, String(r.rows.length))
  lote2 = r.rows[0]?.lote_id
  check('  lote nuevo distinto', Boolean(lote2) && lote2 !== lote1)
}

await expectErr('reclamo con p_max=1001 rechazado (art. 16 Orden: máx. 1000)',
  () => db.query('select * from public.sif_outbox_reclamar_lote($1, 1001)', [A]), 'SIF_LOTE')

await expectErr('reclamo con JWT de usuario rechazado (solo service_role)', async () => {
  await db.exec(`set request.jwt.claim.sub = '${A}'`)
  try { await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [A]) }
  finally { await db.exec(`reset request.jwt.claim.sub`) }
}, 'SIF_SOLO_SERVICIO')

// ---------- 6. Resolución del lote 1 (respuesta AEAT) ----------
{
  const lineas = JSON.stringify([
    { registro_id: regsA[0].registro_id, estado: 'accepted', codigo_error: null, descripcion: null, respuesta: { estadoRegistro: 'Correcto' } },
    { registro_id: regsA[1].registro_id, estado: 'accepted_with_errors', codigo_error: '2001', descripcion: 'Valor no censado', respuesta: { estadoRegistro: 'AceptadoConErrores' } },
  ])
  const r = await db.query(
    'select public.sif_outbox_resolver_lote($1, $2, $3, $4, $5, $6) as n',
    [A, lote1, 'ParcialmenteCorrecto', 'CSVPRUEBA01', 120, lineas]
  )
  check('resolver_lote devuelve 2 registros resueltos', r.rows[0].n === 2, String(r.rows[0].n))

  const regs = await db.query(`select id, estado_remision, csv_aeat, codigo_error_registro, descripcion_error,
      remitido_at, incidencia from sif_registros where id in ($1, $2) order by correlativo`,
    [regsA[0].registro_id, regsA[1].registro_id])
  check('  registro 1 accepted con CSV y remitido_at',
    regs.rows[0].estado_remision === 'accepted' && regs.rows[0].csv_aeat === 'CSVPRUEBA01'
    && regs.rows[0].remitido_at !== null && regs.rows[0].incidencia === false,
    JSON.stringify(regs.rows[0]))
  check('  registro 2 accepted_with_errors con código de error admisible',
    regs.rows[1].estado_remision === 'accepted_with_errors' && regs.rows[1].codigo_error_registro === '2001'
    && regs.rows[1].descripcion_error === 'Valor no censado' && regs.rows[1].csv_aeat === 'CSVPRUEBA01',
    JSON.stringify(regs.rows[1]))

  const o = await db.query(`select count(*)::int as n from sif_outbox where lote_id = $1 and estado = 'enviado'`, [lote1])
  check('  outbox en_envio→enviado', o.rows[0].n === 2)

  const c = await db.query(`select tiempo_espera_envio, proximo_envio_desde, fallos_consecutivos, circuito_abierto_hasta
      from sif_config where user_id = $1`, [A])
  check('  control de flujo: TiempoEsperaEnvio=120 obedecido y próximo envío en el futuro',
    c.rows[0].tiempo_espera_envio === 120 && new Date(c.rows[0].proximo_envio_desde) > new Date()
    && c.rows[0].fallos_consecutivos === 0 && c.rows[0].circuito_abierto_hasta === null,
    JSON.stringify(c.rows[0]))
}

// Control de flujo activo: A no aparece en pendientes ni entrega lotes
{
  const p = await db.query('select * from public.sif_remision_pendientes()')
  check('control de flujo: A fuera de pendientes hasta proximo_envio_desde (art. 16 Orden)',
    !p.rows.some((x) => x.user_id === A) && p.rows.some((x) => x.user_id === B), JSON.stringify(p.rows))
  const r = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [A])
  check('  reclamar_lote devuelve 0 filas con el flujo en espera', r.rows.length === 0)
}

// ---------- 7. Fallo del lote 2 (sin respuesta AEAT): backoff + incidencia ----------
{
  const r = await db.query('select public.sif_outbox_fallar_lote($1, $2, $3, true) as n',
    [A, lote2, 'Transporte AEAT: ECONNREFUSED'])
  check('fallar_lote devuelve 1 fila a la cola', r.rows[0].n === 1, String(r.rows[0].n))
  const o = await db.query(`select estado, incidencia, ultimo_error, intentos,
      proximo_intento_at > now() as backoff_futuro,
      proximo_intento_at <= now() + interval '61 minutes' as backoff_max_1h
      from sif_outbox where lote_id = $1`, [lote2])
  check('  fila pendiente con incidencia=true (Incidencia=S en el reenvío, art. 16 Orden)',
    o.rows[0].estado === 'pendiente' && o.rows[0].incidencia === true
    && o.rows[0].ultimo_error.includes('ECONNREFUSED'), JSON.stringify(o.rows[0]))
  check('  backoff en el futuro y ≤1 hora', o.rows[0].backoff_futuro === true && o.rows[0].backoff_max_1h === true)
  const s = await db.query(`select estado_remision from sif_registros where id = $1`, [regsA[2].registro_id])
  check('  registro sending→queued', s.rows[0].estado_remision === 'queued', s.rows[0].estado_remision)
  const c = await db.query(`select fallos_consecutivos, circuito_abierto_hasta from sif_config where user_id = $1`, [A])
  check('  fallos_consecutivos=1, breaker aún cerrado',
    c.rows[0].fallos_consecutivos === 1 && c.rows[0].circuito_abierto_hasta === null, JSON.stringify(c.rows[0]))
}

// fallar_lote sobre un lote ya resuelto: no-op (no toca el breaker)
{
  const r = await db.query('select public.sif_outbox_fallar_lote($1, $2, $3, true) as n', [A, lote1, 'tarde'])
  const c = await db.query(`select fallos_consecutivos from sif_config where user_id = $1`, [A])
  check('fallar un lote ya resuelto es no-op (0 filas, breaker intacto)',
    r.rows[0].n === 0 && c.rows[0].fallos_consecutivos === 1)
}

// ---------- 8. Rechazo definitivo: outbox→error, fuera de la cola ----------
let regRechazado
{
  await db.query(`update sif_config set proximo_envio_desde = now() - interval '1 second' where user_id = $1`, [A])
  regRechazado = await emitir(INVS_A[3], A)
  // la fila 3 sigue en backoff → solo se reclama la nueva
  const r = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [A])
  check('la fila en backoff no se reclama; solo la nueva emisión',
    r.rows.length === 1 && r.rows[0].registro_id === regRechazado.registro_id, String(r.rows.length))
  const lote3 = r.rows[0].lote_id
  const lineas = JSON.stringify([{
    registro_id: regRechazado.registro_id, estado: 'rejected', codigo_error: '3000',
    descripcion: 'Registro de facturación inválido', respuesta: { estadoRegistro: 'Incorrecto' },
  }])
  await db.query('select public.sif_outbox_resolver_lote($1, $2, $3, null, $4, $5) as n',
    [A, lote3, 'Incorrecto', 60, lineas])
  const s = await db.query(`select estado_remision, csv_aeat, codigo_error_registro from sif_registros where id = $1`,
    [regRechazado.registro_id])
  check('registro rechazado: estado rejected, sin CSV, con código de error',
    s.rows[0].estado_remision === 'rejected' && s.rows[0].csv_aeat === null
    && s.rows[0].codigo_error_registro === '3000', JSON.stringify(s.rows[0]))
  const o = await db.query(`select estado from sif_outbox where registro_id = $1`, [regRechazado.registro_id])
  check('  outbox en estado error (el reenvío corregido llega en V12, RechazoPrevio=S)',
    o.rows[0].estado === 'error', o.rows[0].estado)
  await db.query(`update sif_config set proximo_envio_desde = now() - interval '1 second' where user_id = $1`, [A])
  const r2 = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [A])
  check('  los rechazados NO vuelven a reclamarse automáticamente', r2.rows.length === 0, String(r2.rows.length))
}

// ---------- 9. Circuit breaker: 5 fallos consecutivos abren el circuito ----------
{
  // fallos_consecutivos está en 0 (hubo respuesta en el paso 8); provocamos 5
  for (let i = 1; i <= 5; i++) {
    await db.query(`update sif_config set proximo_envio_desde = null where user_id = $1`, [A])
    await db.query(`update sif_outbox set proximo_intento_at = now() - interval '1 second'
      where registro_id = $1`, [regsA[2].registro_id])
    const r = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [A])
    if (r.rows.length !== 1) { ko(`breaker: reclamo del intento ${i}`, String(r.rows.length)); continue }
    await db.query('select public.sif_outbox_fallar_lote($1, $2, $3, true)', [A, r.rows[0].lote_id, `fallo ${i}`])
  }
  const c = await db.query(`select fallos_consecutivos, circuito_abierto_hasta from sif_config where user_id = $1`, [A])
  check('tras 5 fallos consecutivos el circuito se abre',
    c.rows[0].fallos_consecutivos === 5 && c.rows[0].circuito_abierto_hasta !== null
    && new Date(c.rows[0].circuito_abierto_hasta) > new Date(), JSON.stringify(c.rows[0]))

  await db.query(`update sif_outbox set proximo_intento_at = now() - interval '1 second'
    where registro_id = $1`, [regsA[2].registro_id])
  const r = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [A])
  check('  con el circuito abierto no se reclaman lotes', r.rows.length === 0, String(r.rows.length))
  const p = await db.query('select * from public.sif_remision_pendientes()')
  check('  y el obligado desaparece de pendientes', !p.rows.some((x) => x.user_id === A))

  // La respuesta válida de la AEAT (resolver) resetea el breaker
  await db.query(`update sif_config set circuito_abierto_hasta = now() - interval '1 second' where user_id = $1`, [A])
  const r2 = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [A])
  check('  circuito expirado: se vuelve a reclamar', r2.rows.length === 1, String(r2.rows.length))
  const lineas = JSON.stringify([{
    registro_id: regsA[2].registro_id, estado: 'accepted', codigo_error: null, descripcion: null,
    respuesta: { estadoRegistro: 'Correcto' },
  }])
  await db.query('select public.sif_outbox_resolver_lote($1, $2, $3, $4, $5, $6)',
    [A, r2.rows[0].lote_id, 'Correcto', 'CSVPRUEBA02', 60, lineas])
  const c2 = await db.query(`select fallos_consecutivos, circuito_abierto_hasta from sif_config where user_id = $1`, [A])
  check('  la respuesta AEAT resetea fallos y cierra el breaker',
    c2.rows[0].fallos_consecutivos === 0 && c2.rows[0].circuito_abierto_hasta === null, JSON.stringify(c2.rows[0]))
  const s = await db.query(`select estado_remision, incidencia from sif_registros where id = $1`, [regsA[2].registro_id])
  check('  el registro remitido tras la incidencia queda accepted con incidencia=true (constancia Incidencia=S)',
    s.rows[0].estado_remision === 'accepted' && s.rows[0].incidencia === true, JSON.stringify(s.rows[0]))
}

// ---------- 10. Rescate de lotes zombis (worker caído en pleno envío) ----------
{
  await db.query(`update sif_config set proximo_envio_desde = null where user_id = $1`, [A])
  const reg = await emitir(INVS_A[4], A)
  const r1 = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [A])
  check('zombi: lote reclamado y dejado en_envio', r1.rows.length === 1 && r1.rows[0].registro_id === reg.registro_id)
  // sin resolver ni fallar; recién reclamado → no reclamable aún
  const r2 = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [A])
  check('  en_envio reciente no se reclama (evita doble envío)', r2.rows.length === 0, String(r2.rows.length))
  // el worker murió: 16 minutos después la fila se rescata en un lote nuevo
  await db.query(`update sif_outbox set ultimo_intento_at = now() - interval '16 minutes'
    where registro_id = $1`, [reg.registro_id])
  const r3 = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [A])
  check('  en_envio >15 min se rescata con lote nuevo e intentos=2 (reenvío idempotente, SPEC §5.4)',
    r3.rows.length === 1 && r3.rows[0].lote_id !== r1.rows[0].lote_id && r3.rows[0].intentos === 2,
    JSON.stringify(r3.rows.map((x) => ({ lote: x.lote_id, intentos: x.intentos }))))
  // cerrar limpio
  const lineas = JSON.stringify([{ registro_id: reg.registro_id, estado: 'accepted', codigo_error: null, descripcion: null, respuesta: {} }])
  await db.query('select public.sif_outbox_resolver_lote($1, $2, $3, $4, $5, $6)',
    [A, r3.rows[0].lote_id, 'Correcto', 'CSVPRUEBA03', 60, lineas])
}

// ---------- 11. Filas del lote sin línea de respuesta → reintento ----------
{
  const r1 = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [B])
  check('lote de B reclamado', r1.rows.length === 1 && r1.rows[0].registro_id === regB.registro_id)
  // La AEAT “no contesta” esa línea: resolver con array vacío
  const r2 = await db.query('select public.sif_outbox_resolver_lote($1, $2, $3, $4, $5, $6) as n',
    [B, r1.rows[0].lote_id, 'Correcto', 'CSVB1', 60, '[]'])
  check('  resolver sin líneas devuelve 0 resueltos', r2.rows[0].n === 0)
  const o = await db.query(`select estado, incidencia, ultimo_error from sif_outbox where registro_id = $1`, [regB.registro_id])
  check('  la fila sin respuesta vuelve a pendiente con incidencia y motivo',
    o.rows[0].estado === 'pendiente' && o.rows[0].incidencia === true
    && o.rows[0].ultimo_error.includes('Sin RespuestaLinea'), JSON.stringify(o.rows[0]))
  const s = await db.query(`select estado_remision from sif_registros where id = $1`, [regB.registro_id])
  check('  su registro vuelve a queued', s.rows[0].estado_remision === 'queued', s.rows[0].estado_remision)
}

// ---------- 12. Aislamiento multi-tenant ----------
{
  await db.query(`update sif_outbox set proximo_intento_at = now() - interval '1 second'
    where registro_id = $1`, [regB.registro_id])
  await db.query(`update sif_config set proximo_envio_desde = null where user_id = $1`, [B])
  const r = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [B])
  check('B reclama SOLO sus filas', r.rows.length === 1 && r.rows[0].registro_id === regB.registro_id)
  await expectErr('A no puede resolver el lote de B (SIF_LOTE_LINEA)', () =>
    db.query('select public.sif_outbox_resolver_lote($1, $2, $3, $4, $5, $6)',
      [A, r.rows[0].lote_id, 'Correcto', 'X', 60,
       JSON.stringify([{ registro_id: regB.registro_id, estado: 'accepted' }])]), 'SIF_LOTE_LINEA')
  const n = await db.query('select public.sif_outbox_fallar_lote($1, $2, $3, true) as n', [A, r.rows[0].lote_id, 'x'])
  check('A no puede fallar el lote de B (0 filas)', n.rows[0].n === 0)
  // cierre limpio del lote de B
  await db.query('select public.sif_outbox_resolver_lote($1, $2, $3, $4, $5, $6)',
    [B, r.rows[0].lote_id, 'Correcto', 'CSVB2', 60,
     JSON.stringify([{ registro_id: regB.registro_id, estado: 'accepted', codigo_error: null, descripcion: null, respuesta: {} }])])
}

// ---------- 13. Validaciones de resolver ----------
await expectErr('resolver con EstadoEnvio inválido', () =>
  db.query('select public.sif_outbox_resolver_lote($1, $2, $3, null, 60, $4)',
    [A, '99999999-9999-9999-9999-999999999999', 'Regular', '[]']), 'SIF_ESTADO_ENVIO')
await expectErr('resolver con estado interno inválido', () =>
  db.query('select public.sif_outbox_resolver_lote($1, $2, $3, null, 60, $4)',
    [A, '99999999-9999-9999-9999-999999999999', 'Correcto',
     JSON.stringify([{ registro_id: regsA[0].registro_id, estado: 'maybe' }])]), 'SIF_LINEA_ESTADO')

// ---------- 14. Obligado inactivo: sin reclamo y fuera de pendientes ----------
{
  await db.query(`update sif_config set activo = false where user_id = $1`, [B])
  const r = await db.query('select * from public.sif_outbox_reclamar_lote($1, 10)', [B])
  const p = await db.query('select * from public.sif_remision_pendientes()')
  check('obligado inactivo: reclamar devuelve 0 y no aparece en pendientes',
    r.rows.length === 0 && !p.rows.some((x) => x.user_id === B))
  await db.query(`update sif_config set activo = true where user_id = $1`, [B])
}

// ---------- 15. Endpoint de estado ----------
{
  const r = await db.query('select public.sif_remision_estado() as e')
  const e = r.rows[0].e
  check('sif_remision_estado: contadores del outbox y de registros',
    e.outbox && e.registros && Number(e.outbox.enviado) >= 5
    && Number(e.registros.accepted) >= 4 && Number(e.registros.rejected) === 1,
    JSON.stringify(e))
  check('  situación por obligado con breaker y control de flujo',
    Array.isArray(e.obligados) && e.obligados.length === 2
    && e.obligados.every((o) => 'fallos_consecutivos' in o && 'circuito_abierto_hasta' in o
      && 'tiempo_espera_envio' in o && 'pendientes' in o),
    JSON.stringify(e.obligados))
}

// ---------- Resumen ----------
console.log(`\n${pass} PASS / ${fail} FAIL`)
if (fail > 0) process.exit(1)
