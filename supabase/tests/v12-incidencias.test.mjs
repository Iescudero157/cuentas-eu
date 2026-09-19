// V12 — Batería de verificación de incidencias e integridad sobre PGlite
// (Postgres real embebido, mismo entorno Supabase simulado que v03/v07/v10).
// Verifica la migración 20260919100000_sif_incidencias.sql:
//   · sif_subsanar_registro: subsanación de altas (accepted_with_errors →
//     'subsanado', rejected → 'resent' + RechazoPrevio=S) y reenvío de
//     anulaciones rechazadas, con encadenamiento y outbox atómicos y huella
//     SQL ≡ huella TS (reconstrucción determinista).
//   · sif_detectar_anomalias: huecos, roturas, huellas, jsonb, fechas y
//     desincronización de sif_cadena — contrastado con el verificador TS.
//   · sif_registrar_evento: cadena propia de eventos con huella oficial
//     idéntica a la de lib/verifactu/huella.ts (cadenaEntradaEvento).
//
// Ejecutar:  node supabase/tests/v12-incidencias.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { sistemaInformaticoKuentas } from '../../lib/verifactu/registro-alta.ts'
import {
  prepararEntradaAlta,
  reconstruirRegistroAlta,
  reconstruirRegistroAnulacion,
  validarEmision,
} from '../../lib/verifactu/emision.ts'
import { prepararEntradaSubsanacion } from '../../lib/verifactu/subsanacion.ts'
import { facturaAppARegistroAnulacion } from '../../lib/verifactu/factura-app.ts'
import { verificarRegistrosObligado } from '../../lib/verifactu/integridad.ts'
import { huellaAlta, huellaEvento } from '../../lib/verifactu/huella.ts'

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

// ---------- 1. Esquema + migraciones (V03..V12) ----------
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
]
for (const [name, path] of files) {
  await expectOk(`aplica ${name}`, readFileSync(path, 'utf8'))
}
await expectOk('re-aplica m9 sif_incidencias (idempotente)',
  readFileSync(`${REPO}/migrations/20260919100000_sif_incidencias.sql`, 'utf8'))

// ---------- 2. Datos semilla + emisiones (mismo camino que V07/V10) ----------
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const C = '55555555-5555-5555-5555-555555555555' // cadena corrupta fabricada
const NIF_A = 'B98407901'
const NIF_B = 'A58818501'
const NIF_C = 'B12345674'
const INVS_A = Array.from({ length: 4 }, (_, i) => `33333333-3333-3333-3333-33333333333${i + 1}`)
const INV_B = '44444444-4444-4444-4444-444444444441'

const ITEMS = '[{"description":"Desarrollo web","quantity":1,"unitPrice":100,"total":100}]'
await expectOk('alta usuarios, configuraciones y facturas', `
  insert into auth.users (id, email) values
    ('${A}', 'a@test.es'), ('${B}', 'b@test.es'), ('${C}', 'c@test.es');
  insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion, activo)
  values ('${A}', '${NIF_A}', 'Empresa A SL', 'KU-TESTA', true),
         ('${B}', '${NIF_B}', 'Empresa B SL', 'KU-TESTB', true),
         ('${C}', '${NIF_C}', 'Empresa C SL', 'KU-TESTC', true);
  insert into invoices (id, user_id, number, client_name, client_nif, items,
    subtotal, iva, iva_rate, irpf, irpf_rate, total, date)
  values ${INVS_A.map((id, i) => `('${id}', '${A}', 'PROV-${i + 1}', 'Cliente SL', '12345678Z', '${ITEMS}', 100, 21, 21, 0, 0, 121, '2026-09-18')`).join(',\n         ')},
         ('${INV_B}', '${B}', 'PROV-B1', 'Cliente B', null, '${ITEMS}', 100, 21, 21, 0, 0, 121, '2026-09-18');
`)

const CONFIGS = {
  [A]: { user_id: A, nif_obligado: NIF_A, nombre_razon: 'Empresa A SL', numero_instalacion: 'KU-TESTA', modalidad: 'verifactu', entorno_aeat: 'pruebas', activo: true },
  [B]: { user_id: B, nif_obligado: NIF_B, nombre_razon: 'Empresa B SL', numero_instalacion: 'KU-TESTB', modalidad: 'verifactu', entorno_aeat: 'pruebas', activo: true },
}

async function filaInvoice(invoiceId) {
  const r = await db.query(`
    select id, user_id, number, date::text as date, client_name, client_nif, items,
           subtotal::float8 as subtotal, iva::float8 as iva, iva_rate, irpf::float8 as irpf,
           irpf_rate, total::float8 as total, verifactu_estado, numero_fiscal,
           tipo_factura, rectifica_invoice_id, tipo_rectificativa
      from invoices where id = $1`, [invoiceId])
  return r.rows[0]
}

async function emitir(invoiceId, userId) {
  const config = CONFIGS[userId]
  const si = sistemaInformaticoKuentas(config.numero_instalacion)
  const inv = await filaInvoice(invoiceId)
  const entrada = prepararEntradaAlta(inv, config, {}, null)
  const dry = validarEmision(entrada, si)
  const r = await db.query(
    'select * from public.sif_emitir_factura($1, $2, $3, $4, $5, null)',
    [userId, invoiceId, JSON.stringify({ entrada, sistemaInformatico: si }),
     Number(dry.cuotaTotal), Number(dry.importeTotal)]
  )
  return r.rows[0]
}

async function registro(id) {
  const r = await db.query('select * from sif_registros where id = $1', [id])
  return r.rows[0]
}

const regsA = []
for (const inv of INVS_A.slice(0, 3)) regsA.push(await emitir(inv, A))
const regB = await emitir(INV_B, B)
check('3 emisiones de A y 1 de B', regsA.length === 3 && Boolean(regB.registro_id))

// Estados AEAT simulados tras la remisión V10: reg1 aceptado con errores,
// reg2 rechazado, reg3 aceptado (el guard permite mutar SOLO estado_remision).
await expectOk('respuestas AEAT simuladas (awe / rejected / accepted)', `
  update sif_registros set estado_remision = 'accepted_with_errors',
    codigo_error_registro = '2001', descripcion_error = 'NIF destinatario no identificado'
    where id = '${regsA[0].registro_id}';
  update sif_registros set estado_remision = 'rejected',
    codigo_error_registro = '4102', descripcion_error = 'Registro rechazado'
    where id = '${regsA[1].registro_id}';
  update sif_registros set estado_remision = 'accepted' where id = '${regsA[2].registro_id}';
  update sif_registros set estado_remision = 'accepted' where id = '${regB.registro_id}';
  update sif_outbox set estado = 'enviado' where user_id in ('${A}', '${B}');
`)

// ---------- 3. Subsanación de un alta aceptado con errores ----------
async function subsanar(userId, invoiceId, registroPrevId, estadoPrev) {
  const config = CONFIGS[userId]
  const si = sistemaInformaticoKuentas(config.numero_instalacion)
  const inv = await filaInvoice(invoiceId)
  const prev = await registro(registroPrevId)
  const entrada = prepararEntradaSubsanacion(inv, config, {
    num_serie_factura: prev.num_serie_factura,
    estado_remision: estadoPrev,
    tipo_factura: prev.tipo_factura,
  })
  const dry = validarEmision(entrada, si)
  const r = await db.query(
    'select * from public.sif_subsanar_registro($1, $2, $3, $4, $5)',
    [userId, registroPrevId, JSON.stringify({ entrada, sistemaInformatico: si }),
     Number(dry.cuotaTotal), Number(dry.importeTotal)]
  )
  return r.rows[0]
}

{
  const antes = await db.query(`select correlativo_ultimo, ultima_huella from sif_cadena where user_id = '${A}'`)
  const sub = await subsanar(A, INVS_A[0], regsA[0].registro_id, 'accepted_with_errors')
  check('subsanación AWE: nuevo correlativo consecutivo',
    Number(sub.correlativo) === Number(antes.rows[0].correlativo_ultimo) + 1, JSON.stringify(sub))
  check('subsanación AWE: mismo IDFactura (num_serie del registro previo)',
    sub.num_serie_factura === (await registro(regsA[0].registro_id)).num_serie_factura)
  check('subsanación AWE: encadena con la última huella de la cadena',
    sub.huella_anterior === antes.rows[0].ultima_huella, `${sub.huella_anterior} vs ${antes.rows[0].ultima_huella}`)

  const nuevo = await registro(sub.registro_id)
  check('registro subsanador: subsanacion=true, sin rechazo_previo, enlaza subsana_registro_id',
    nuevo.subsanacion === true && nuevo.rechazo_previo === null
    && nuevo.subsana_registro_id === regsA[0].registro_id, JSON.stringify(nuevo))
  check('registro subsanador: jsonb con Subsanacion=S',
    nuevo.registro.entrada.subsanacion === 'S' && !nuevo.registro.entrada.rechazoPrevio)

  const prev = await registro(regsA[0].registro_id)
  check('el registro previo pasa a estado terminal «subsanado»', prev.estado_remision === 'subsanado')

  const outbox = await db.query(`select estado from sif_outbox where registro_id = '${sub.registro_id}'`)
  check('el registro subsanador queda encolado en el outbox', outbox.rows[0]?.estado === 'pendiente')

  const cadena = await db.query(`select correlativo_ultimo, ultima_huella from sif_cadena where user_id = '${A}'`)
  check('sif_cadena avanza al registro subsanador',
    Number(cadena.rows[0].correlativo_ultimo) === Number(sub.correlativo)
    && cadena.rows[0].ultima_huella === sub.huella)

  // Huella SQL ≡ huella TS (reconstrucción determinista desde el jsonb)
  const ts = reconstruirRegistroAlta(nuevo.registro)
  check('huella SQL ≡ huella TS del registro subsanador', ts.huella === nuevo.huella,
    `${ts.huella} vs ${nuevo.huella}`)
  check('el XML reconstruido lleva Subsanacion=S', ts.xml.includes('<sf:Subsanacion>S</sf:Subsanacion>'))
}

// ---------- 4. Reenvío de un alta rechazado (RechazoPrevio=S) ----------
{
  const sub = await subsanar(A, INVS_A[1], regsA[1].registro_id, 'rejected')
  const nuevo = await registro(sub.registro_id)
  check('reenvío de rechazado: rechazo_previo=S y subsanacion=true',
    nuevo.rechazo_previo === 'S' && nuevo.subsanacion === true, JSON.stringify(nuevo))
  const prev = await registro(regsA[1].registro_id)
  check('el registro rechazado pasa a estado terminal «resent»', prev.estado_remision === 'resent')
  const ts = reconstruirRegistroAlta(nuevo.registro)
  check('XML del reenvío: Subsanacion=S + RechazoPrevio=S',
    ts.xml.includes('<sf:Subsanacion>S</sf:Subsanacion>') && ts.xml.includes('<sf:RechazoPrevio>S</sf:RechazoPrevio>'))
}

// ---------- 5. Guardas de la subsanación ----------
await expectErr('no se subsana un registro accepted', () =>
  subsanar(A, INVS_A[2], regsA[2].registro_id, 'accepted_with_errors'), 'SIF_NO_SUBSANABLE')
await expectErr('no se subsana dos veces (previo ya «subsanado»)', () =>
  subsanar(A, INVS_A[0], regsA[0].registro_id, 'accepted_with_errors'), 'SIF_NO_SUBSANABLE')
await expectErr('multi-tenant: B no puede subsanar un registro de A', () => db.query(
  'select * from public.sif_subsanar_registro($1, $2, $3, $4, $5)',
  [B, regsA[2].registro_id, JSON.stringify({ entrada: {}, sistemaInformatico: {} }), 21, 121]
), 'SIF_REGISTRO')

{
  // Entrada sin subsanacion=S → la RPC la rechaza (defensa aunque el TS valide)
  const config = CONFIGS[B]
  const si = sistemaInformaticoKuentas(config.numero_instalacion)
  await db.query(`update sif_registros set estado_remision = 'accepted_with_errors' where id = '${regB.registro_id}'`)
  const inv = await filaInvoice(INV_B)
  const entrada = prepararEntradaAlta(inv, config, {}, null)
  entrada.numSerieFactura = (await registro(regB.registro_id)).num_serie_factura
  const dry = validarEmision(entrada, si)
  await expectErr('la RPC exige subsanacion=S en la entrada', () => db.query(
    'select * from public.sif_subsanar_registro($1, $2, $3, $4, $5)',
    [B, regB.registro_id, JSON.stringify({ entrada, sistemaInformatico: si }),
     Number(dry.cuotaTotal), Number(dry.importeTotal)]
  ), 'SIF_SUBSANACION')

  entrada.subsanacion = 'S'
  entrada.numSerieFactura = 'F-9999-999999'
  await expectErr('la RPC exige el numSerieFactura del registro subsanado', () => db.query(
    'select * from public.sif_subsanar_registro($1, $2, $3, $4, $5)',
    [B, regB.registro_id, JSON.stringify({ entrada, sistemaInformatico: si }),
     Number(dry.cuotaTotal), Number(dry.importeTotal)]
  ), 'SIF_IDFACTURA')
}

// ---------- 6. Reenvío de una anulación rechazada ----------
{
  const config = CONFIGS[A]
  const si = sistemaInformaticoKuentas(config.numero_instalacion)
  // Emitir y anular la 4ª factura de A
  const alta = await emitir(INVS_A[3], A)
  await db.query(`update sif_registros set estado_remision = 'accepted' where id = '${alta.registro_id}'`)
  const inv = await filaInvoice(INVS_A[3])
  const entradaAnul = facturaAppARegistroAnulacion(
    { invoice_number: inv.numero_fiscal, date: inv.date },
    { nif: config.nif_obligado, nombreRazon: config.nombre_razon }, {}
  )
  const anul = (await db.query('select * from public.sif_anular_factura($1, $2, $3)',
    [A, INVS_A[3], JSON.stringify({ entrada: entradaAnul, sistemaInformatico: si })])).rows[0]

  await expectErr('una anulación no rechazada no se reenvía', () => db.query(
    'select * from public.sif_subsanar_registro($1, $2, $3, null, null)',
    [A, anul.registro_id, JSON.stringify({
      entrada: { ...entradaAnul, rechazoPrevio: 'S' }, sistemaInformatico: si })]
  ), 'SIF_NO_SUBSANABLE')

  await db.query(`update sif_registros set estado_remision = 'rejected' where id = '${anul.registro_id}'`)
  await expectErr('el reenvío de anulación exige rechazoPrevio=S', () => db.query(
    'select * from public.sif_subsanar_registro($1, $2, $3, null, null)',
    [A, anul.registro_id, JSON.stringify({ entrada: entradaAnul, sistemaInformatico: si })]
  ), 'SIF_RECHAZO_PREVIO')

  const reenvio = (await db.query('select * from public.sif_subsanar_registro($1, $2, $3, null, null)',
    [A, anul.registro_id, JSON.stringify({
      entrada: { ...entradaAnul, rechazoPrevio: 'S' }, sistemaInformatico: si })])).rows[0]
  const nuevo = await registro(reenvio.registro_id)
  check('reenvío de anulación: tipo anulacion, rechazo_previo=S, enlaza al previo',
    nuevo.tipo_registro === 'anulacion' && nuevo.rechazo_previo === 'S'
    && nuevo.subsana_registro_id === anul.registro_id, JSON.stringify(reenvio))
  check('la anulación rechazada pasa a «resent»',
    (await registro(anul.registro_id)).estado_remision === 'resent')
  const ts = reconstruirRegistroAnulacion(nuevo.registro)
  check('huella SQL ≡ huella TS del reenvío de anulación', ts.huella === nuevo.huella)
  check('XML del reenvío de anulación lleva RechazoPrevio=S',
    ts.xml.includes('<sf:RechazoPrevio>S</sf:RechazoPrevio>'))
}

// ---------- 7. Inmutabilidad de los campos nuevos ----------
await expectErr('subsana_registro_id es inmutable (guard V03 ampliado)', `
  update sif_registros set subsana_registro_id = null
   where subsana_registro_id is not null`, 'inmutable')

// ---------- 8. sif_detectar_anomalias: cadenas íntegras → 0 anomalías ----------
{
  const r = await db.query(`select * from public.sif_detectar_anomalias('${A}')`)
  check('cadena de A (con subsanaciones y anulaciones) sin anomalías', r.rows.length === 0,
    JSON.stringify(r.rows))
  const rb = await db.query(`select * from public.sif_detectar_anomalias('${B}')`)
  check('cadena de B sin anomalías', rb.rows.length === 0, JSON.stringify(rb.rows))
}

// ---------- 9. Cadena corrupta fabricada (usuario C) ----------
const FH1 = '2026-09-18T10:00:00+02:00'
const FH3 = '2026-09-18T08:00:00+02:00' // retrocede respecto a FH1
const HUELLA_C1 = huellaAlta({
  IDEmisorFactura: NIF_C,
  NumSerieFactura: 'C-1',
  FechaExpedicionFactura: '18-09-2026',
  TipoFactura: 'F1',
  CuotaTotal: '21.00',
  ImporteTotal: '121.00',
  FechaHoraHusoGenRegistro: FH1,
}, null)
await expectOk('se fabrica una cadena corrupta para C (hueco, huella falsa, jsonb roto, fecha atrás)', `
  insert into sif_registros (user_id, correlativo, tipo_registro,
    id_emisor_factura, num_serie_factura, fecha_expedicion, tipo_factura,
    cuota_total, importe_total, registro, primer_registro, huella_anterior,
    huella, fecha_hora_huso_gen)
  values
    ('${C}', 1, 'alta', '${NIF_C}', 'C-1', '2026-09-18', 'F1', 21, 121,
     '{"huella":"${HUELLA_C1}","fechaHoraHusoGenRegistro":"${FH1}"}'::jsonb,
     true, null, '${HUELLA_C1}', '${FH1}'),
    ('${C}', 3, 'alta', '${NIF_C}', 'C-3', '2026-09-18', 'F1', 21, 121,
     '{}'::jsonb, false, '${'B'.repeat(64)}', '${'A'.repeat(64)}', '${FH3}');
  insert into sif_cadena (user_id, nif_obligado, correlativo_ultimo, ultima_huella)
  values ('${C}', '${NIF_C}', 9, '${'C'.repeat(64)}');
`)

{
  const r = await db.query(`select * from public.sif_detectar_anomalias('${C}')`)
  const codigos = r.rows.map((x) => x.codigo)
  for (const esperado of ['HUECO_CORRELATIVO', 'HUELLA_NO_COINCIDE', 'JSONB_INCONSISTENTE',
                          'FECHA_RETROCEDIDA', 'CADENA_DESINCRONIZADA']) {
    check(`detector SQL acusa ${esperado} en C`, codigos.includes(esperado), JSON.stringify(codigos))
  }
  check('detector SQL: sin ENCADENADO_ROTO al no ser contiguos (el hueco ya está acusado)',
    !codigos.includes('ENCADENADO_ROTO'), JSON.stringify(codigos))

  // Contraste con el verificador TS (misma cadena, mismos códigos)
  const filas = (await db.query(`
    select id, correlativo, tipo_registro, id_emisor_factura, num_serie_factura,
           fecha_expedicion::text as fecha_expedicion, tipo_factura,
           cuota_total::float8 as cuota_total, importe_total::float8 as importe_total,
           primer_registro, huella_anterior, huella, fecha_hora_huso_gen, registro, estado_remision
      from sif_registros where user_id = '${C}' order by correlativo`)).rows
  const cadenaC = (await db.query(`
    select correlativo_ultimo, ultima_huella from sif_cadena where user_id = '${C}'`)).rows[0]
  const ts = verificarRegistrosObligado(filas, cadenaC)
  const codigosTs = new Set(ts.anomalias.map((a) => a.codigo))
  for (const esperado of ['HUECO_CORRELATIVO', 'HUELLA_NO_COINCIDE', 'JSONB_INCONSISTENTE',
                          'FECHA_RETROCEDIDA', 'CADENA_DESINCRONIZADA']) {
    check(`verificador TS acusa ${esperado} en C (contraste SQL≡TS)`, codigosTs.has(esperado),
      JSON.stringify([...codigosTs]))
  }
  // El detector global también ve a C y respeta el aislamiento por usuario
  const todos = await db.query('select distinct user_id from public.sif_detectar_anomalias(null)')
  check('detector global: solo C tiene anomalías',
    todos.rows.length === 1 && todos.rows[0].user_id === C, JSON.stringify(todos.rows))
}

// ---------- 10. sif_registrar_evento: cadena propia con huella oficial ----------
{
  const e1 = (await db.query(
    `select * from public.sif_registrar_evento($1, 'deteccion_anomalias_registros', $2)`,
    [A, JSON.stringify({ procesoIntegridadHuellas: 'S', anomaliasDetectadas: 0 })])).rows[0]
  check('evento 1: primer evento de la cadena (huella_anterior null)',
    e1.primer_evento === true && e1.huella_anterior === null, JSON.stringify(e1))

  const e2 = (await db.query(
    `select * from public.sif_registrar_evento($1, 'anomalia_registro', $2)`,
    [A, JSON.stringify({ tipoAnomalia: '01', detalle: 'prueba' })])).rows[0]
  check('evento 2: encadena con el evento 1',
    Number(e2.correlativo) === 2 && e2.huella_anterior === e1.huella, JSON.stringify(e2))

  // Huella SQL ≡ huella TS (cadenaEntradaEvento de huella.ts, doc. AEAT §3.c)
  const huellaTs = huellaEvento({
    NIFSistemaInformatico: 'B98407901',
    ID: '',
    IdSistemaInformatico: '01',
    Version: '1.0.0',
    NumeroInstalacion: 'KU-TESTA',
    NIFObligadoEmision: NIF_A,
    TipoEvento: '04',
    FechaHoraHusoGenEvento: e2.fecha_hora_huso_gen,
  }, e1.huella)
  check('huella de evento SQL ≡ huella TS (fórmula oficial)', e2.huella === huellaTs,
    `${e2.huella} vs ${huellaTs}`)

  const fila = (await db.query(
    `select tipo_evento, datos from sif_eventos where user_id = '${A}' and correlativo = 2`)).rows[0]
  check('el evento persiste tipo interno + TipoEvento oficial en datos',
    fila.tipo_evento === 'anomalia_registro' && fila.datos.tipoEventoOficial === '04',
    JSON.stringify(fila))

  await expectErr('tipo de evento desconocido → error', () => db.query(
    `select * from public.sif_registrar_evento($1, 'tipo_inventado', '{}')`, [A]), 'SIF_TIPO_EVENTO')

  await db.exec(`select set_config('request.jwt.claim.sub', '${A}', false)`)
  await expectErr('un usuario autenticado no registra eventos (solo servicio)', () => db.query(
    `select * from public.sif_registrar_evento($1, 'anomalia_registro', '{}')`, [A]), 'SIF_SOLO_SERVICIO')
  await db.exec(`select set_config('request.jwt.claim.sub', '', false)`)

  // sif_eventos sigue siendo append-only (guard V03)
  await expectErr('sif_eventos: UPDATE prohibido', `
    update sif_eventos set datos = '{}'::jsonb where user_id = '${A}'`, 'append-only')
}

// ---------- Resumen ----------
console.log(`\n${pass} PASS / ${fail} FAIL`)
process.exit(fail > 0 ? 1 : 0)
