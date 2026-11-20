// V28 — Cumplimiento 20-nov-2026 sobre PGlite (Postgres real embebido, con
// TODAS las migraciones, incluida 20261120100000_sif_cumplimiento_exentas_series).
// Verifica en la transacción real de emisión:
//   1. Exentas: columna operacion_exenta, coherencia factura ↔ registro
//      (SIF_EXENTA), inmutabilidad tras emitir y XML con OperacionExenta.
//   2. Rectificativas: R1-R4 en la serie R y R5 (de simplificadas) en la serie
//      RS; combinaciones cruzadas rechazadas; anulación encadenada.
//   3. Series separadas: completas F, simplificadas S; una serie no mezcla
//      clases de factura (SIF_SERIE_CLASE) y un rechazo no consume número.
// Todos los XML se validan contra los XSD oficiales de la AEAT, uno a uno y
// dentro del mensaje de remisión RegFactuSistemaFacturacion.
//
// Ejecutar:  node supabase/tests/v28-cumplimiento.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { huellaAlta, huellaAnulacion } from '../../lib/verifactu/huella.ts'
import { sistemaInformaticoKuentas, xmlRegFactuSistemaFacturacion } from '../../lib/verifactu/registro-alta.ts'
import { PRODUCTOR_PRUEBAS } from '../../lib/verifactu/tests/helpers/productor-pruebas.mjs'
import {
  prepararEntradaAlta,
  validarEmision,
  reconstruirRegistroAlta,
  reconstruirRegistroAnulacion,
} from '../../lib/verifactu/emision.ts'
import { facturaAppARegistroAnulacion } from '../../lib/verifactu/factura-app.ts'
import { construirBorradorRectificativa } from '../../lib/verifactu/rectificacion.ts'
import { validarRegistroXsd, validarEnvioXsd } from '../../lib/verifactu/tests/helpers/xsd-validator.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRACION = `${REPO}/migrations/20261120100000_sif_cumplimiento_exentas_series.sql`
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

// ---------- 1. Esquema + TODAS las migraciones ----------
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
  ['m12 sif_productor_milbrotes', `${REPO}/migrations/20261016100000_sif_productor_milbrotes.sql`],
  ['m14 sif_cumplimiento_exentas_series', MIGRACION],
]
for (const [name, path] of files) {
  await expectOk(`aplica ${name}`, readFileSync(path, 'utf8'))
}
await expectOk('re-aplica m14 (idempotente)', readFileSync(MIGRACION, 'utf8'))

// ---------- 2. Datos semilla ----------
const A = '11111111-1111-1111-1111-111111111111'
const NIF_A = 'B98407901'
const ITEMS = '[{"description":"Servicio de prueba","quantity":1,"unitPrice":100,"total":100}]'
const id = (n) => `33333333-3333-3333-3333-${String(n).padStart(12, '0')}`

await expectOk('alta del obligado A (sif_config activo)', `
  insert into auth.users (id, email) values ('${A}', 'a@test.es');
  insert into sif_config (user_id, nif_obligado, nombre_razon, numero_instalacion, activo)
  values ('${A}', '${NIF_A}', 'Empresa A SL', 'KU-TESTA', true);
`)

const SI_A = sistemaInformaticoKuentas('KU-TESTA', PRODUCTOR_PRUEBAS)
const CONFIG_A = {
  user_id: A, nif_obligado: NIF_A, nombre_razon: 'Empresa A SL',
  numero_instalacion: 'KU-TESTA', modalidad: 'verifactu', entorno_aeat: 'pruebas', activo: true,
}

/** Inserta un borrador. `f` = columnas que cambian respecto a la factura base al 21 %. */
async function borrador(n, f = {}) {
  const fila = {
    number: `PROV-${n}`, client_name: 'Cliente Uno SL', client_nif: '12345678Z', subtotal: 100, iva: 21,
    iva_rate: 21, irpf: 0, irpf_rate: 0, total: 121, date: '2026-11-20', operacion_exenta: null,
    exencion_detalle: null, rectifica_invoice_id: null, tipo_rectificativa: null, tipo_factura: null, ...f,
  }
  await db.query(
    `insert into invoices (id, user_id, number, client_name, client_nif, items, subtotal, iva, iva_rate,
       irpf, irpf_rate, total, date, operacion_exenta, exencion_detalle, rectifica_invoice_id,
       tipo_rectificativa, tipo_factura)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [id(n), A, fila.number, fila.client_name, fila.client_nif, fila.items ? JSON.stringify(fila.items) : ITEMS,
     fila.subtotal, fila.iva, fila.iva_rate, fila.irpf, fila.irpf_rate, fila.total, fila.date,
     fila.operacion_exenta, fila.exencion_detalle, fila.rectifica_invoice_id, fila.tipo_rectificativa,
     fila.tipo_factura]
  )
  return id(n)
}

async function filaInvoice(invoiceId) {
  const r = await db.query(`
    select id, user_id, number, date::text as date, client_id, client_name, client_nif, client_address,
           client_email, items, subtotal::float8 as subtotal, iva::float8 as iva, iva_rate,
           irpf::float8 as irpf, irpf_rate, total::float8 as total, verifactu_estado, numero_fiscal,
           tipo_factura, serie, rectifica_invoice_id, tipo_rectificativa, operacion_exenta, exencion_detalle
      from invoices where id = $1`, [invoiceId])
  return r.rows[0]
}

/** Mismo camino que lib/verifactu/emision.ts: dry-run en TS + RPC sif_emitir_factura. */
async function emitir(invoiceId, { opciones = {}, entradaForzada = null } = {}) {
  const inv = await filaInvoice(invoiceId)
  const rectificada = inv.rectifica_invoice_id ? await filaInvoice(inv.rectifica_invoice_id) : null
  const entrada = entradaForzada ?? prepararEntradaAlta(inv, CONFIG_A, { hoy: '2026-12-31', ...opciones }, rectificada)
  const dry = validarEmision(entrada, SI_A)
  const r = await db.query(
    'select * from public.sif_emitir_factura($1, $2, $3, $4, $5, $6)',
    [A, invoiceId, JSON.stringify({ entrada, sistemaInformatico: SI_A }),
     Number(dry.cuotaTotal), Number(dry.importeTotal), opciones.serie ?? null]
  )
  return r.rows[0]
}

async function anular(invoiceId) {
  const inv = await filaInvoice(invoiceId)
  const entrada = facturaAppARegistroAnulacion(
    { invoice_number: inv.numero_fiscal, date: inv.date },
    { nif: NIF_A, nombreRazon: 'Empresa A SL' }
  )
  const r = await db.query(
    'select * from public.sif_anular_factura($1, $2, $3)',
    [A, invoiceId, JSON.stringify({ entrada, sistemaInformatico: SI_A })]
  )
  return r.rows[0]
}

async function xmlAlta(registroId) {
  const reg = await db.query('select registro from sif_registros where id = $1', [registroId])
  return reconstruirRegistroAlta(reg.rows[0].registro)
}

async function ultimoNumero(serie) {
  const s = await db.query(
    'select ultimo_numero, tipo from sif_series where user_id = $1 and serie = $2 and ejercicio = 2026', [A, serie])
  return s.rows[0] ?? null
}

const ddmmaaaa = (iso) => iso.split('-').reverse().join('-')
const xmls = [] // todos los registros generados, en orden de cadena

// ---------- 3. Series separadas: completas F, simplificadas S ----------
const F1a = await borrador(1)
const S1 = await borrador(2, { client_name: 'Cliente de mostrador', client_nif: null, iva: 10, iva_rate: 10, total: 110 })
const F1b = await borrador(3)
let rF1a, rS1, rF1b
try {
  rF1a = await emitir(F1a)
  rS1 = await emitir(S1)
  rF1b = await emitir(F1b)
  ok('emitidas: completa, simplificada, completa')
} catch (e) { ko('emitidas: completa, simplificada, completa', e.message) }

if (rF1a && rS1 && rF1b) {
  check('  completa #1 → F-2026-000001 (F1)', rF1a.num_serie_factura === 'F-2026-000001' && rF1a.tipo_factura === 'F1', rF1a.num_serie_factura)
  check('  simplificada → S-2026-000001 (F2), serie propia', rS1.num_serie_factura === 'S-2026-000001' && rS1.tipo_factura === 'F2', rS1.num_serie_factura)
  check('  completa #2 → F-2026-000002: la simplificada no consume número de la serie F',
    rF1b.num_serie_factura === 'F-2026-000002', rF1b.num_serie_factura)
  check('  una sola cadena para todas las series (correlativos 1, 2, 3)',
    [rF1a, rS1, rF1b].map((r) => Number(r.correlativo)).join(',') === '1,2,3')
  check('  encadenadas: la simplificada apunta a la completa anterior', rS1.huella_anterior === rF1a.huella && rF1b.huella_anterior === rS1.huella)
  const invS = await filaInvoice(S1)
  check('  invoices: serie S, tipo F2, number = S-2026-000001',
    invS.serie === 'S' && invS.tipo_factura === 'F2' && invS.number === 'S-2026-000001', JSON.stringify(invS))
  const serieF = await ultimoNumero('F'), serieS = await ultimoNumero('S')
  check('  sif_series: F es «ordinaria» (2) y S es «simplificada» (1)',
    serieF?.tipo === 'ordinaria' && serieF?.ultimo_numero === 2 && serieS?.tipo === 'simplificada' && serieS?.ultimo_numero === 1,
    JSON.stringify({ serieF, serieS }))
  const huellaTS = huellaAlta({
    IDEmisorFactura: NIF_A, NumSerieFactura: 'S-2026-000001', FechaExpedicionFactura: ddmmaaaa('2026-11-20'),
    TipoFactura: 'F2', CuotaTotal: '10.00', ImporteTotal: '110.00', FechaHoraHusoGenRegistro: rS1.fecha_hora_huso_gen,
  }, rF1a.huella)
  check('  huella SQL de la simplificada === huellaAlta TypeScript', rS1.huella === huellaTS, `${rS1.huella} ≠ ${huellaTS}`)
  for (const [nombre, r] of [['completa', rF1a], ['simplificada', rS1], ['completa #2', rF1b]]) {
    const gen = await xmlAlta(r.registro_id)
    const val = await validarRegistroXsd(gen.xml)
    check(`  XML ${nombre} VALIDA contra el XSD oficial y la huella coincide`, val.valida && gen.huella === r.huella, val.errores.join(' | '))
    xmls.push(gen.xml)
  }
  const genS = await xmlAlta(rS1.registro_id)
  check('  XML simplificada: TipoFactura F2 y sin Destinatarios',
    genS.xml.includes('<sf:TipoFactura>F2</sf:TipoFactura>') && !genS.xml.includes('Destinatarios'))
}

// Una serie no mezcla clases de factura
const S2 = await borrador(4, { client_name: 'Otro cliente de mostrador', client_nif: null })
await expectErr('simplificada forzada a la serie F → rechazada (SIF_SERIE_CLASE)',
  () => emitir(S2, { opciones: { serie: 'F' } }), 'SIF_SERIE_CLASE')
{
  const serieF = await ultimoNumero('F')
  const inv = await filaInvoice(S2)
  check('  el rechazo no consume número ni emite la factura',
    serieF.ultimo_numero === 2 && inv.verifactu_estado === 'borrador', JSON.stringify({ serieF, estado: inv.verifactu_estado }))
}
const F1c = await borrador(5)
await expectErr('completa forzada a la serie S → rechazada (SIF_SERIE_CLASE)',
  () => emitir(F1c, { opciones: { serie: 's' } }), 'SIF_SERIE_CLASE')
await expectErr('clase de serie inexistente → rechazada',
  `select * from public.sif_reservar_numero('${A}', 'Z', 2026, 'inventada');`, 'SIF_SERIE_CLASE')
await expectErr('otro ejercicio no reabre la serie F para simplificadas',
  `select * from public.sif_reservar_numero('${A}', 'F', 2027, 'simplificada');`, 'SIF_SERIE_CLASE')
{
  const r = await db.query(`select * from public.sif_reservar_numero($1, 'T', 2026, 'simplificada')`, [A])
  check('una serie libre adicional de simplificadas sí se admite (T-2026-000001)', r.rows[0].num_serie_factura === 'T-2026-000001')
  await expectErr('  y queda reservada a esa clase',
    `select * from public.sif_reservar_numero('${A}', 'T', 2026, 'ordinaria');`, 'SIF_SERIE_CLASE')
}
let rS2
try {
  rS2 = await emitir(S2)
  check('la simplificada rechazada se emite después en su serie (S-2026-000002)', rS2.num_serie_factura === 'S-2026-000002', rS2.num_serie_factura)
  xmls.push((await xmlAlta(rS2.registro_id)).xml)
} catch (e) { ko('la simplificada rechazada se emite después en su serie', e.message) }

// ---------- 4. Operaciones exentas ----------
await expectErr('causa de exención fuera de la lista L10 (E7) → CHECK',
  () => borrador(90, { iva: 0, iva_rate: 0, total: 100, operacion_exenta: 'E7' }), 'check')
await expectErr('causa de exención con IVA repercutido → CHECK invoices_exenta_sin_iva',
  () => borrador(91, { operacion_exenta: 'E1' }), 'invoices_exenta_sin_iva')

const EX1 = await borrador(6, { iva: 0, iva_rate: 0, total: 100, operacion_exenta: 'E1', exencion_detalle: 'Art. 20.Uno.23.º' })
let rEX1
try {
  rEX1 = await emitir(EX1)
  ok('factura exenta (E1) emitida')
} catch (e) { ko('factura exenta (E1) emitida', e.message) }
if (rEX1) {
  check('  serie F (es una factura completa): F-2026-000003', rEX1.num_serie_factura === 'F-2026-000003', rEX1.num_serie_factura)
  const reg = await db.query('select registro, cuota_total::float8 as cuota, importe_total::float8 as importe from sif_registros where id = $1', [rEX1.registro_id])
  const linea = reg.rows[0].registro.entrada.desglose[0]
  check('  registro: OperacionExenta E1, sin calificación, tipo ni cuota',
    linea.operacionExenta === 'E1' && linea.calificacionOperacion === undefined &&
    linea.tipoImpositivo === undefined && linea.cuotaRepercutida === undefined, JSON.stringify(linea))
  check('  CuotaTotal 0 e ImporteTotal 100', reg.rows[0].cuota === 0 && reg.rows[0].importe === 100)
  const gen = await xmlAlta(rEX1.registro_id)
  const val = await validarRegistroXsd(gen.xml)
  check('  XML exenta VALIDA contra el XSD oficial', val.valida, val.errores.join(' | '))
  check('  XML: <OperacionExenta>E1</OperacionExenta> y ningún TipoImpositivo',
    gen.xml.includes('<sf:OperacionExenta>E1</sf:OperacionExenta>') && !gen.xml.includes('TipoImpositivo'))
  check('  huella del XML reconstruido === registrada', gen.huella === rEX1.huella)
  xmls.push(gen.xml)
  await expectErr('  la causa de exención queda congelada al emitir',
    `update invoices set operacion_exenta = 'E2' where id = '${EX1}';`, 'inmutable')
  await expectErr('  y también el detalle del precepto',
    `update invoices set exencion_detalle = 'otro' where id = '${EX1}';`, 'inmutable')
}

// La factura y su registro tienen que decir lo mismo
const EX2 = await borrador(7, { iva: 0, iva_rate: 0, total: 100, operacion_exenta: 'E1' })
{
  const inv = await filaInvoice(EX2)
  const entradaS1 = prepararEntradaAlta({ ...inv, operacion_exenta: null, iva_rate: 21, iva: 21 }, CONFIG_A, { hoy: '2026-12-31' })
  await expectErr('factura exenta con registro sujeto (S1) → SIF_EXENTA',
    () => emitir(EX2, { entradaForzada: entradaS1 }), 'SIF_EXENTA')
  const entradaE2 = prepararEntradaAlta({ ...inv, operacion_exenta: 'E2' }, CONFIG_A, { hoy: '2026-12-31' })
  await expectErr('factura exenta E1 con registro E2 → SIF_EXENTA',
    () => emitir(EX2, { entradaForzada: entradaE2 }), 'SIF_EXENTA')
}
const NOEX = await borrador(8)
{
  const inv = await filaInvoice(NOEX)
  const entradaE1 = prepararEntradaAlta({ ...inv, iva: 0, iva_rate: 0, operacion_exenta: 'E1' }, CONFIG_A, { hoy: '2026-12-31' })
  await expectErr('factura con IVA y registro exento → SIF_EXENTA',
    () => emitir(NOEX, { entradaForzada: entradaE1 }), 'SIF_EXENTA')
  const serieF = await ultimoNumero('F')
  check('  los tres rechazos no consumieron número de la serie F', serieF.ultimo_numero === 3, JSON.stringify(serieF))
}
{
  // IVA 0 % sin causa: el dry-run de TypeScript corta antes de llegar a la base de datos
  const SIN = await borrador(9, { iva: 0, iva_rate: 0, total: 100 })
  await expectErr('IVA al 0 % sin causa de exención → no se emite', () => emitir(SIN), 'sin causa de exención')
}
// Exportación exenta (E2): clave de régimen 02
const EX3 = await borrador(10, { iva: 0, iva_rate: 0, total: 100, operacion_exenta: 'E2' })
try {
  const r = await emitir(EX3)
  const gen = await xmlAlta(r.registro_id)
  const val = await validarRegistroXsd(gen.xml)
  check('exenta E2 (art. 21): ClaveRegimen 02 y XML válido',
    val.valida && gen.xml.includes('<sf:ClaveRegimen>02</sf:ClaveRegimen>') && gen.xml.includes('<sf:OperacionExenta>E2</sf:OperacionExenta>'),
    val.errores.join(' | '))
  xmls.push(gen.xml)
} catch (e) { ko('exenta E2 (art. 21): ClaveRegimen 02 y XML válido', e.message) }

// ---------- 5. Rectificativas ----------
/** Crea el borrador de la rectificativa con la misma función que usa la app. */
async function borradorRectificativa(n, originalId, parametros) {
  const original = await filaInvoice(originalId)
  const b = construirBorradorRectificativa(original, { hoy: '2026-11-21', ...parametros })
  return borrador(n, b)
}

// 5a. Rectificativa R1 de una completa → serie R
let rR1
try {
  const R1 = await borradorRectificativa(20, F1a, { modo: 'importe', baseCorrecta: 80, motivo: 'Descuento posterior', tipo: 'R1' })
  rR1 = await emitir(R1)
  ok('rectificativa de la completa #1 emitida')
} catch (e) { ko('rectificativa de la completa #1 emitida', e.message) }
if (rR1) {
  check('  serie R: R-2026-000001, tipo R1', rR1.num_serie_factura === 'R-2026-000001' && rR1.tipo_factura === 'R1', `${rR1.num_serie_factura} ${rR1.tipo_factura}`)
  const original = await filaInvoice(F1a)
  check('  la original pasa a «rectificada» y conserva su contenido',
    original.verifactu_estado === 'rectificada' && original.subtotal === 100 && original.numero_fiscal === 'F-2026-000001')
  const gen = await xmlAlta(rR1.registro_id)
  const val = await validarRegistroXsd(gen.xml)
  check('  XML rectificativa VALIDA contra el XSD oficial', val.valida, val.errores.join(' | '))
  check('  XML: TipoRectificativa I, factura rectificada F-2026-000001 y base −20,00',
    gen.xml.includes('<sf:TipoRectificativa>I</sf:TipoRectificativa>') &&
    gen.xml.includes('<sf:NumSerieFactura>F-2026-000001</sf:NumSerieFactura>') &&
    gen.xml.includes('<sf:BaseImponibleOimporteNoSujeto>-20.00</sf:BaseImponibleOimporteNoSujeto>') &&
    gen.xml.includes('<sf:CuotaRepercutida>-4.20</sf:CuotaRepercutida>'))
  check('  huella de la rectificativa reconstruida === registrada', gen.huella === rR1.huella)
  check('  sif_series: R es «rectificativa»', (await ultimoNumero('R'))?.tipo === 'rectificativa')
  xmls.push(gen.xml)
}

// 5b. Segunda rectificativa de la misma factura: cuenta con la anterior
try {
  const original = await filaInvoice(F1a)
  const b = construirBorradorRectificativa(original, { modo: 'total', motivo: 'Operación sin efecto', tipo: 'R1', hoy: '2026-11-22' },
    { subtotal: -20, iva: -4.2, irpf: 0 })
  check('segunda rectificativa «todo el importe»: solo lo que sigue vigente (−80 y −16,80)', b.subtotal === -80 && b.iva === -16.8, JSON.stringify(b))
  const r = await emitir(await borrador(21, b))
  check('  emitida como R-2026-000002', r.num_serie_factura === 'R-2026-000002', r.num_serie_factura)
  xmls.push((await xmlAlta(r.registro_id)).xml)
} catch (e) { ko('segunda rectificativa de la misma factura', e.message) }

// 5c. Rectificativa de una simplificada → R5 en la serie RS
let rR5
try {
  const R5 = await borradorRectificativa(22, S1, { modo: 'total', motivo: 'Devolución completa', tipo: 'R1' })
  rR5 = await emitir(R5)
  ok('rectificativa de la simplificada emitida')
} catch (e) { ko('rectificativa de la simplificada emitida', e.message) }
if (rR5) {
  check('  serie RS: RS-2026-000001, tipo R5', rR5.num_serie_factura === 'RS-2026-000001' && rR5.tipo_factura === 'R5', `${rR5.num_serie_factura} ${rR5.tipo_factura}`)
  const gen = await xmlAlta(rR5.registro_id)
  const val = await validarRegistroXsd(gen.xml)
  check('  XML R5 VALIDA contra el XSD oficial y va sin Destinatarios', val.valida && !gen.xml.includes('Destinatarios'), val.errores.join(' | '))
  check('  sif_series: RS es «rectificativa_simplificada»', (await ultimoNumero('RS'))?.tipo === 'rectificativa_simplificada')
  check('  la serie R de las rectificativas completas no se ha movido', (await ultimoNumero('R'))?.ultimo_numero === 2)
  xmls.push(gen.xml)
}

// 5d. Combinaciones cruzadas rechazadas en la base de datos
{
  const original = await filaInvoice(S2)
  const b = construirBorradorRectificativa(original, { modo: 'total', motivo: 'Devolución completa', hoy: '2026-11-22' })
  const idR = await borrador(23, b)
  const inv = await filaInvoice(idR)
  const entradaR1 = prepararEntradaAlta({ ...inv, client_nif: '12345678Z' }, CONFIG_A, { hoy: '2026-12-31', tipoFactura: 'R1' }, original)
  await expectErr('R1 sobre una simplificada → SIF_RECTIFICATIVA', () => emitir(idR, { entradaForzada: entradaR1 }), 'SIF_RECTIFICATIVA')
}
{
  const original = await filaInvoice(F1b)
  const b = construirBorradorRectificativa(original, { modo: 'total', motivo: 'Operación sin efecto', tipo: 'R4', hoy: '2026-11-22' })
  const idR = await borrador(24, b)
  const inv = await filaInvoice(idR)
  const entradaR5 = prepararEntradaAlta(inv, CONFIG_A, { hoy: '2026-12-31', tipoFactura: 'R5' }, original)
  await expectErr('R5 sobre una completa → SIF_RECTIFICATIVA', () => emitir(idR, { entradaForzada: entradaR5 }), 'SIF_RECTIFICATIVA')
  // …y emitida como corresponde (R4), en la serie R
  try {
    const r = await emitir(idR)
    check('  la misma rectificativa como R4 sí se emite (R-2026-000003)', r.num_serie_factura === 'R-2026-000003' && r.tipo_factura === 'R4', `${r.num_serie_factura} ${r.tipo_factura}`)
    xmls.push((await xmlAlta(r.registro_id)).xml)
  } catch (e) { ko('  la misma rectificativa como R4 sí se emite', e.message) }
}

// 5e. Rectificativa de una exenta: hereda la causa
try {
  const R = await borradorRectificativa(25, EX1, { modo: 'total', motivo: 'Operación sin efecto', tipo: 'R4' })
  const inv = await filaInvoice(R)
  check('rectificativa de la exenta: hereda causa E1 y detalle', inv.operacion_exenta === 'E1' && inv.exencion_detalle === 'Art. 20.Uno.23.º')
  const r = await emitir(R)
  const gen = await xmlAlta(r.registro_id)
  const val = await validarRegistroXsd(gen.xml)
  check('  XML válido, exento y en negativo', val.valida && gen.xml.includes('<sf:OperacionExenta>E1</sf:OperacionExenta>') &&
    gen.xml.includes('<sf:ImporteTotal>-100.00</sf:ImporteTotal>'), val.errores.join(' | '))
  xmls.push(gen.xml)
} catch (e) { ko('rectificativa de la exenta', e.message) }

// ---------- 6. Anulación ----------
const AN = await borrador(30)
let rAN, rANalta
try {
  rANalta = await emitir(AN)
  xmls.push((await xmlAlta(rANalta.registro_id)).xml)
  rAN = await anular(AN)
  ok('factura emitida por error: alta y anulación')
} catch (e) { ko('factura emitida por error: alta y anulación', e.message) }
if (rAN && rANalta) {
  const inv = await filaInvoice(AN)
  check('  la factura queda «anulada» y conserva su número', inv.verifactu_estado === 'anulada' && inv.numero_fiscal === rANalta.num_serie_factura)
  check('  el registro de anulación va en la misma cadena, justo después', Number(rAN.correlativo) === Number(rANalta.correlativo) + 1 && rAN.huella_anterior === rANalta.huella)
  const huellaTS = huellaAnulacion({
    IDEmisorFacturaAnulada: NIF_A, NumSerieFacturaAnulada: rANalta.num_serie_factura,
    FechaExpedicionFacturaAnulada: ddmmaaaa('2026-11-20'), FechaHoraHusoGenRegistro: rAN.fecha_hora_huso_gen,
  }, rANalta.huella)
  check('  huella de anulación SQL === TypeScript', rAN.huella === huellaTS, `${rAN.huella} ≠ ${huellaTS}`)
  const reg = await db.query('select registro from sif_registros where id = $1', [rAN.registro_id])
  const gen = reconstruirRegistroAnulacion(reg.rows[0].registro)
  const val = await validarRegistroXsd(gen.xml)
  check('  XML de anulación VALIDA contra el XSD oficial', val.valida && gen.huella === rAN.huella, val.errores.join(' | '))
  xmls.push(gen.xml)
  await expectErr('  una factura anulada no se anula dos veces', () => anular(AN), 'SIF_NO_EMITIDA')
  await expectErr('  ni se borra', `delete from invoices where id = '${AN}';`, 'prohibido')
  const original = await filaInvoice(AN)
  let codigo = null
  try { construirBorradorRectificativa(original, { modo: 'total', motivo: 'Operación sin efecto', tipo: 'R1', hoy: '2026-11-22' }) }
  catch (e) { codigo = e.codigo }
  check('  ni se rectifica (no_rectificable)', codigo === 'no_rectificable', String(codigo))
}
await expectErr('una factura ya rectificada no se anula (solo las emitidas)', () => anular(F1a), 'SIF_NO_EMITIDA')

// ---------- 7. Cadena completa y mensaje de remisión ----------
{
  const c = await db.query('select correlativo, huella, huella_anterior from sif_registros where user_id = $1 order by correlativo', [A])
  let integra = c.rows.length > 0
  for (let i = 0; i < c.rows.length; i++) {
    if (Number(c.rows[i].correlativo) !== i + 1) integra = false
    if (i > 0 && c.rows[i].huella_anterior !== c.rows[i - 1].huella) integra = false
  }
  check(`cadena íntegra: ${c.rows.length} registros consecutivos y encadenados`, integra && c.rows.length === xmls.length, `${c.rows.length} filas vs ${xmls.length} XML`)
  const anomalias = await db.query('select codigo from public.sif_detectar_anomalias($1)', [A])
  check('sif_detectar_anomalias: sin anomalías', anomalias.rows.length === 0, JSON.stringify(anomalias.rows))
  const envio = xmlRegFactuSistemaFacturacion({ obligadoEmision: { nombreRazon: 'Empresa A SL', nif: NIF_A } }, xmls)
  const val = await validarEnvioXsd(envio)
  check(`mensaje RegFactuSistemaFacturacion con los ${xmls.length} registros VALIDA contra SuministroLR.xsd`, val.valida, val.errores.join(' | '))
  const series = await db.query('select serie, tipo, ultimo_numero from sif_series where user_id = $1 and ejercicio = 2026 order by serie', [A])
  check('series del ejercicio: F ordinaria · R rectificativa · RS rectificativa_simplificada · S simplificada (+ T de prueba)',
    series.rows.map((s) => `${s.serie}:${s.tipo}`).join(' ') ===
      'F:ordinaria R:rectificativa RS:rectificativa_simplificada S:simplificada T:simplificada',
    JSON.stringify(series.rows))
}

// ---------- Resumen ----------
console.log(`\nTOTAL: ${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
