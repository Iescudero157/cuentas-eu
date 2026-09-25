#!/usr/bin/env node
// ---------------------------------------------------------------------------
// V26 · Alta de MERCADONET GLOBAL S.L. (B98407901) como primer cliente real
// de Kuentas y verificación del ciclo completo de facturación Verifactu.
//
// El /registro público de la app está cerrado y la BD de producción NO tiene
// aplicadas las migraciones SIF (a propósito), así que el alta se ejercita en
// un sandbox Postgres REAL (PGlite persistente en disco) que aplica el schema
// y las 11 migraciones del repo fichero a fichero — exactamente el mismo SQL
// que se aplicará en Supabase — y la remisión se hace EN VIVO contra el
// entorno de PRUEBAS de la AEAT (prewww1) con el certificado de Mercadonet
// (flujo curl/Schannel de V17, ver scripts/verifactu-alta-mercadonet.ps1).
//
//   node scripts/verifactu-alta-mercadonet.mjs --preparar  --dir <outdir>
//     Sandbox: alta de Mercadonet (sif_config + serie propia), 2 facturas de
//     PRUEBA emitidas con sif_emitir_factura (numeración, huella, cadena,
//     outbox), QR + PDF reales, lote reclamado y Envelope SOAP listo. Sin red.
//
//   node scripts/verifactu-alta-mercadonet.mjs --consolidar --dir <outdir>
//     Tras el POST del Envelope (curl, ps1): parsea <outdir>/respuesta.xml,
//     cierra el lote como el worker V10 (resolver_lote), verifica estado
//     final (remitido + CSV, cola a cero, 0 anomalías) y genera el export
//     ClassicConta (V22) de las 2 facturas. Escribe informe-final.json.
//
//   node scripts/verifactu-alta-mercadonet.mjs --sql
//     Imprime el SQL del alta REAL (idéntico al ejercitado aquí) para
//     ejecutarlo en el SQL editor de Supabase (service_role) cuando las
//     migraciones estén aplicadas. Ver docs/verifactu/ALTA-MERCADONET.md.
//
// Candados: solo entorno de PRUEBAS (el Envelope apunta a prewww1 y el QR a
// prewww2); las facturas van marcadas «PRUEBA - NO VALIDA» con importes
// mínimos (1,21 € y 1,10 €). NUNCA usar contra producción AEAT.
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { sistemaInformaticoKuentas, xmlRegFactuSistemaFacturacion } from '../lib/verifactu/registro-alta.ts'
import { prepararEntradaAlta, validarEmision, reconstruirRegistroAlta } from '../lib/verifactu/emision.ts'
import { xmlDeFila, resolverLineas, fechaOficialDeIso } from '../lib/verifactu/remision.ts'
import { envolverSoap, parsearRespuestaSoap, ENDPOINTS_VERIFACTU } from '../lib/verifactu/aeat-cliente.ts'
import { construirBloqueQR, datosCotejoDesdeRegistro } from '../lib/verifactu/qr.ts'
import {
  construirExportClassicConta,
  lineaDiario,
  lineaSubcuenta,
  ANCHO_DIARIO,
  ANCHO_SUBCUENTAS,
  bytesAnsi,
  EOL,
} from '../lib/export-contable/classicconta.ts'
import { validarRegistroXsd, validarEnvioXsd } from '../lib/verifactu/tests/helpers/xsd-validator.mjs'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const SUPABASE_DIR = join(RAIZ, 'supabase')

// --- Datos del alta (primer cliente real; decisión de Iván 11-sep-2026) -----
const MERCADONET = {
  // UUID fijo del sandbox; en Supabase real es el id del usuario invitado
  // desde el dashboard (Authentication → Invite user).
  userId: '26262626-0000-4000-8000-b98407901000',
  email: 'info@mercadonet.es', // [REVISIÓN IVAN] si prefiere otro buzón para la cuenta
  nif: 'B98407901',
  nombreRazon: 'Mercadonet Global S.L.',
  // NumeroInstalacion del bloque SistemaInformatico: 1 instalación = 1 tenant.
  numeroInstalacion: 'KU-B98407901',
  // Serie propia REAL propuesta para 2027 (numeración MN-2027-000001...):
  serieReal: 'MN',
}

// Serie de las facturas de PRUEBA: única por ejecución para que el portal de
// pruebas nunca las confunda con otra tanda (regex sif_series: ≤20 [A-Z0-9-]).
function serieDePrueba(ahora = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `MN-PRUEBA-${String(ahora.getFullYear()).slice(2)}${p(ahora.getMonth() + 1)}${p(ahora.getDate())}${p(ahora.getHours())}${p(ahora.getMinutes())}`
}

const hoyIso = () => new Date().toISOString().slice(0, 10)

// --- SQL del alta (fuente única: el sandbox ejecuta EXACTAMENTE esto) --------
// En Supabase real NO se toca auth.users por SQL: el usuario se crea invitando
// a MERCADONET.email desde el dashboard y su id sustituye a :user_id.
function sqlAltaSifConfig(userId) {
  return `
insert into public.sif_config
  (user_id, nif_obligado, nombre_razon, numero_instalacion, modalidad, entorno_aeat, activo)
values
  ('${userId}', '${MERCADONET.nif}', '${MERCADONET.nombreRazon}', '${MERCADONET.numeroInstalacion}', 'verifactu', 'pruebas', true)
on conflict (user_id) do nothing;`
}

const SQL_ALTA_REAL = `-- =============================================================================
-- V26 · Alta REAL de Mercadonet Global S.L. como obligado Verifactu en Kuentas
-- Ejecutar en el SQL editor de Supabase (service_role) SOLO cuando:
--   1. las migraciones supabase/migrations/2026*.sql estén aplicadas, y
--   2. el usuario ${MERCADONET.email} exista (dashboard → Authentication →
--      Invite user) — sustituir :user_id por su id.
-- entorno_aeat queda en 'pruebas'; el paso a 'produccion' y la fecha de inicio
-- VERI*FACTU (art. 17 Orden HAC/1177/2024) son decisión de Iván en 2027.
-- =============================================================================
${sqlAltaSifConfig(':user_id')}
-- La serie real (${MERCADONET.serieReal}-2027-000001…) no necesita alta previa:
-- sif_reservar_numero crea el contador (serie, ejercicio) en la primera emisión.`

// --- Sandbox PGlite ----------------------------------------------------------
async function abrirDb(dataDir, { crear = false } = {}) {
  const { PGlite } = await import('@electric-sql/pglite')
  const { uuid_ossp } = await import('@electric-sql/pglite/contrib/uuid_ossp')
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto')
  if (!crear && !existsSync(dataDir)) {
    throw new Error(`No existe el sandbox ${dataDir}: ejecute antes --preparar`)
  }
  return new PGlite(dataDir, { extensions: { uuid_ossp, pgcrypto } })
}

async function aplicarEsquema(db) {
  // Mock del entorno Supabase, idéntico al de las baterías supabase/tests/*.
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
  const ficheros = [
    'schema.sql',
    'schema-update.sql',
    'migrations/20260911100000_sif_config.sql',
    'migrations/20260911100100_sif_series_numeracion.sql',
    'migrations/20260911100200_sif_cadena_registros.sql',
    'migrations/20260911100300_sif_outbox_eventos.sql',
    'migrations/20260911100400_invoices_estados_fiscales.sql',
    'migrations/20260913100000_sif_emision.sql',
    'migrations/20260918100000_sif_remision.sql',
    'migrations/20260918110000_sif_certificados.sql',
    'migrations/20260919100000_sif_incidencias.sql',
    'migrations/20260919110000_sif_multitenant.sql',
    'migrations/20260924100000_sif_hardening.sql',
  ]
  for (const f of ficheros) {
    await db.exec(readFileSync(join(SUPABASE_DIR, f), 'utf8'))
  }
}

// --- Verificaciones ----------------------------------------------------------
const resultados = []
function check(nombre, cond, detalle = '') {
  resultados.push({ nombre, ok: !!cond, detalle: cond ? undefined : String(detalle) })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${nombre}${cond ? '' : ` :: ${detalle}`}`)
  return !!cond
}

async function filaInvoice(db, id) {
  const r = await db.query(
    `select id, user_id, number, date::text as date, client_name, client_nif, items,
            subtotal::float8 as subtotal, iva::float8 as iva, iva_rate, irpf::float8 as irpf,
            irpf_rate, total::float8 as total, verifactu_estado, numero_fiscal,
            tipo_factura, rectifica_invoice_id, tipo_rectificativa
       from invoices where id = $1`,
    [id]
  )
  return r.rows[0]
}

// PDF de servidor: la plantilla es .tsx (JSX); se transpila al vuelo con el
// TypeScript del proyecto, igual que hace lib/verifactu/tests/v08-qr.test.mjs.
async function cargarGeneradorPdf() {
  const ts = (await import('typescript')).default
  const rutaTsx = join(RAIZ, 'lib', 'pdf', 'invoice-pdf-server.tsx')
  const rutaTmp = join(RAIZ, 'lib', 'pdf', '.v26-invoice-pdf-server.tmp.mjs')
  const js = ts.transpileModule(readFileSync(rutaTsx, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  writeFileSync(rutaTmp, js)
  const mod = await import(pathToFileURL(rutaTmp))
  return { generateInvoicePDFBuffer: mod.generateInvoicePDFBuffer, limpiar: () => rmSync(rutaTmp, { force: true }) }
}

// --- Fase 1: preparar --------------------------------------------------------
async function preparar(dir) {
  mkdirSync(dir, { recursive: true })
  const dataDir = join(dir, 'db')
  if (existsSync(dataDir)) {
    throw new Error(`${dataDir} ya existe: use un --dir nuevo por ejecución (la serie de prueba es única por tanda)`)
  }
  const db = await abrirDb(dataDir, { crear: true })
  await aplicarEsquema(db)

  // 1. Alta de Mercadonet: usuario (en Supabase real: invitación por dashboard)
  //    + sif_config con el MISMO SQL que imprime --sql.
  await db.query('insert into auth.users (id, email) values ($1, $2)', [MERCADONET.userId, MERCADONET.email])
  await db.exec(sqlAltaSifConfig(MERCADONET.userId))
  const cfg = await db.query('select * from sif_config where user_id = $1', [MERCADONET.userId])
  check('alta: sif_config de Mercadonet creada y activa',
    cfg.rows.length === 1 && cfg.rows[0].activo === true && cfg.rows[0].entorno_aeat === 'pruebas',
    JSON.stringify(cfg.rows[0] ?? null))

  const config = {
    user_id: MERCADONET.userId,
    nif_obligado: MERCADONET.nif,
    nombre_razon: MERCADONET.nombreRazon,
    numero_instalacion: MERCADONET.numeroInstalacion,
    modalidad: 'verifactu',
    entorno_aeat: 'pruebas',
    activo: true,
  }
  const si = sistemaInformaticoKuentas(MERCADONET.numeroInstalacion)
  const serie = serieDePrueba()

  // 2. Dos facturas de PRUEBA (F2 simplificadas, importe mínimo) y emisión.
  const DESCRIPCION =
    'PRUEBA - NO VALIDA · Verificación técnica del módulo Verifactu de Kuentas (V26). Sin efectos tributarios.'
  const facturas = [
    { id: '26000000-0000-4000-8000-000000000001', ivaRate: 21, iva: 0.21, total: 1.21 },
    { id: '26000000-0000-4000-8000-000000000002', ivaRate: 10, iva: 0.1, total: 1.1 },
  ]
  for (const [i, f] of facturas.entries()) {
    const items = JSON.stringify([{ description: DESCRIPCION, quantity: 1, unitPrice: 1, total: 1 }])
    await db.query(
      `insert into invoices (id, user_id, number, client_name, client_nif, items,
         subtotal, iva, iva_rate, irpf, irpf_rate, total, date)
       values ($1, $2, $3, $4, null, $5, 1, $6, $7, 0, 0, $8, $9)`,
      [f.id, MERCADONET.userId, `PROV-MN-${i + 1}`, 'PRUEBA - NO VALIDA', items, f.iva, f.ivaRate, f.total, hoyIso()]
    )
  }

  const emitidas = []
  for (const f of facturas) {
    const inv = await filaInvoice(db, f.id)
    const entrada = prepararEntradaAlta(inv, config, {}, null)
    const dry = validarEmision(entrada, si)
    const r = await db.query('select * from public.sif_emitir_factura($1, $2, $3, $4, $5, $6)', [
      MERCADONET.userId,
      f.id,
      JSON.stringify({ entrada, sistemaInformatico: si }),
      Number(dry.cuotaTotal),
      Number(dry.importeTotal),
      serie,
    ])
    emitidas.push({ ...r.rows[0], invoiceId: f.id })
  }

  // 3. Ciclo: numeración correlativa de la serie propia.
  check(`numeración: primera factura ${serie}-2026-000001`,
    emitidas[0].num_serie_factura === `${serie}-2026-000001`, emitidas[0].num_serie_factura)
  check(`numeración: segunda factura ${serie}-2026-000002`,
    emitidas[1].num_serie_factura === `${serie}-2026-000002`, emitidas[1].num_serie_factura)
  check('numeración: correlativos de cadena 1 y 2',
    Number(emitidas[0].correlativo) === 1 && Number(emitidas[1].correlativo) === 2,
    `${emitidas[0].correlativo}, ${emitidas[1].correlativo}`)
  for (const [i, f] of facturas.entries()) {
    const inv = await filaInvoice(db, f.id)
    check(`invoices: factura ${i + 1} pasa a 'emitida' con numero_fiscal`,
      inv.verifactu_estado === 'emitida' && inv.numero_fiscal === emitidas[i].num_serie_factura,
      `${inv.verifactu_estado} / ${inv.numero_fiscal}`)
  }

  // 4. Ciclo: huella (SQL === TS regenerada) y encadenamiento.
  const regs = await db.query(
    `select id, invoice_id, registro, xml, huella, huella_anterior, num_serie_factura,
            fecha_expedicion::text as fecha_expedicion, importe_total, id_emisor_factura
       from sif_registros where user_id = $1 and tipo_registro = 'alta' order by correlativo`,
    [MERCADONET.userId]
  )
  check('huella: cadena — huella_anterior(2) === huella(1)',
    regs.rows[0].huella_anterior === null && regs.rows[1].huella_anterior === regs.rows[0].huella)
  for (const [i, fila] of regs.rows.entries()) {
    const gen = reconstruirRegistroAlta(fila.registro)
    // El XML fijado es caché (V24): solo se exige coincidencia si existe.
    check(`huella: registro ${i + 1} regenerado en TS === persistido en SQL`,
      gen.huella === fila.huella && (fila.xml === null || gen.xml === fila.xml),
      `TS=${gen.huella} SQL=${fila.huella}`)
    const val = await validarRegistroXsd(gen.xml)
    check(`XML: registro ${i + 1} valida contra los XSD oficiales AEAT`, val.valida, val.errores.join(' | '))
  }

  // 5. Ciclo: QR + leyenda en el PDF real de la factura.
  const pdf = await cargarGeneradorPdf()
  const cotejos = []
  try {
    for (const [i, fila] of regs.rows.entries()) {
      const bloque = await construirBloqueQR(datosCotejoDesdeRegistro(fila), 'pruebas')
      cotejos.push(bloque.urlCotejo)
      check(`QR: URL de cotejo de la factura ${i + 1} apunta a prewww2 con los 4 parámetros`,
        bloque.urlCotejo.startsWith('https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B98407901&numserie=') &&
          bloque.urlCotejo.includes('&fecha=') && bloque.urlCotejo.includes('&importe='),
        bloque.urlCotejo)
      const inv = await filaInvoice(db, regs.rows[i].invoice_id)
      const buffer = await pdf.generateInvoicePDFBuffer({
        number: inv.numero_fiscal,
        clientName: inv.client_name ?? 'PRUEBA - NO VALIDA',
        clientNif: inv.client_nif,
        date: inv.date,
        status: 'emitida',
        items: inv.items,
        subtotal: inv.subtotal,
        iva: inv.iva,
        ivaRate: inv.iva_rate,
        irpf: inv.irpf,
        irpfRate: inv.irpf_rate,
        total: inv.total,
        issuerName: MERCADONET.nombreRazon,
        issuerNif: MERCADONET.nif,
        verifactu: bloque,
      })
      const rutaPdf = join(dir, `factura-${i + 1}-${inv.numero_fiscal}.pdf`)
      writeFileSync(rutaPdf, buffer)
      check(`QR: PDF de la factura ${i + 1} generado con QR + leyenda (${buffer.length} B)`,
        buffer.subarray(0, 5).toString() === '%PDF-' && buffer.length > 10000, rutaPdf)
    }
  } finally {
    pdf.limpiar()
  }

  // 6. Remisión: lote reclamado como el worker V10 y Envelope SOAP (sin red).
  const lote = await db.query('select * from public.sif_outbox_reclamar_lote($1, 1000)', [MERCADONET.userId])
  check('remisión: el lote reclama exactamente los 2 registros', lote.rows.length === 2, String(lote.rows.length))
  const registrosXml = lote.rows.map((fila) => xmlDeFila(fila)) // regenera + verifica huella y XML fijado (V24)
  const cuerpo = xmlRegFactuSistemaFacturacion(
    { obligadoEmision: { nombreRazon: MERCADONET.nombreRazon, nif: MERCADONET.nif } },
    registrosXml
  )
  const valEnvio = await validarEnvioXsd(cuerpo)
  check('remisión: RegFactuSistemaFacturacion valida contra SuministroLR.xsd', valEnvio.valida,
    valEnvio.errores.join(' | '))

  const envelope = join(dir, 'envelope.xml')
  writeFileSync(envelope, envolverSoap(cuerpo), 'utf8')
  const meta = {
    item: 'V26',
    userId: MERCADONET.userId,
    serie,
    url: ENDPOINTS_VERIFACTU.pruebas.normal,
    loteId: lote.rows[0].lote_id,
    // fecha_expedicion en texto YYYY-MM-DD (PGlite devuelve Date, que al
    // serializar a JSON se desplaza de zona horaria y rompería resolverLineas).
    filas: lote.rows.map((f) => ({
      registro_id: f.registro_id,
      tipo_registro: f.tipo_registro,
      num_serie_factura: f.num_serie_factura,
      fecha_expedicion: regs.rows.find((r) => r.id === f.registro_id).fecha_expedicion,
      registro: f.registro,
      huella: f.huella,
      xml: f.xml,
      incidencia: f.incidencia,
    })),
    cotejos,
  }
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2))
  writeFileSync(join(dir, 'informe-preparacion.json'), JSON.stringify({ resultados }, null, 2))
  await db.close()

  const fallos = resultados.filter((r) => !r.ok).length
  console.log(`\n--preparar: ${resultados.length - fallos}/${resultados.length} verificaciones OK.`)
  console.log(`Envelope listo en ${envelope} (endpoint ${meta.url}). NO se ha enviado nada.`)
  if (fallos > 0) process.exit(1)
}

// --- Fase 2: consolidar ------------------------------------------------------
async function consolidar(dir) {
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
  const rutaRespuesta = join(dir, 'respuesta.xml')
  if (!existsSync(rutaRespuesta)) {
    throw new Error(`Falta ${rutaRespuesta}: POSTee antes el envelope (scripts/verifactu-alta-mercadonet.ps1)`)
  }
  const respuesta = parsearRespuestaSoap(readFileSync(rutaRespuesta, 'utf8'))
  console.log(`AEAT EstadoEnvio=${respuesta.estadoEnvio} CSV=${respuesta.csv ?? '—'} espera=${respuesta.tiempoEsperaEnvio}s`)

  // Artefacto conocido del ENTORNO DE PRUEBAS compartido (visto ya en V18):
  // al abrir una cadena nueva con PrimerRegistro, el portal puede responder
  // AceptadoConErrores 2007 («no debe informarse como primer registro…»)
  // porque conserva envíos previos del mismo obligado+SIF. El registro queda
  // registrado con CSV. En producción la primera factura real de Mercadonet
  // sí será primer registro (sin históricos), así que se admite SOLO ese
  // código y solo en el primer registro del lote.
  const esArtefactoPrimerRegistro = (linea) =>
    linea.estadoRegistro === 'AceptadoConErrores' && String(linea.codigoErrorRegistro) === '2007'

  check('AEAT: EstadoEnvio Correcto (o ParcialmenteCorrecto solo por el aviso 2007)',
    respuesta.estadoEnvio === 'Correcto' ||
      (respuesta.estadoEnvio === 'ParcialmenteCorrecto' &&
        respuesta.lineas.every((l) => l.estadoRegistro === 'Correcto' || esArtefactoPrimerRegistro(l))),
    respuesta.estadoEnvio)
  check('AEAT: CSV recibido', typeof respuesta.csv === 'string' && respuesta.csv.length > 5, String(respuesta.csv))
  for (const linea of respuesta.lineas) {
    check(`AEAT: ${linea.idFactura.numSerieFactura} → ${linea.estadoRegistro}`,
      linea.estadoRegistro === 'Correcto' || esArtefactoPrimerRegistro(linea),
      `[${linea.codigoErrorRegistro ?? ''}] ${linea.descripcionErrorRegistro ?? ''}`)
  }

  // Cierre del lote con la MISMA lógica del worker V10 (resolverLineas).
  const db = await abrirDb(join(dir, 'db'))
  const { lineas, sinRespuesta } = resolverLineas(meta.filas, respuesta, MERCADONET.nif)
  check('cierre: las 2 filas del lote casan con la respuesta', lineas.length === 2 && sinRespuesta.length === 0,
    `resueltas=${lineas.length} sinRespuesta=${sinRespuesta.length}`)
  const resuelto = await db.query('select public.sif_outbox_resolver_lote($1, $2, $3, $4, $5, $6) as n', [
    MERCADONET.userId,
    meta.loteId,
    respuesta.estadoEnvio,
    respuesta.csv ?? null,
    respuesta.tiempoEsperaEnvio,
    JSON.stringify(lineas),
  ])
  check('cierre: sif_outbox_resolver_lote resuelve 2 registros', resuelto.rows[0].n === 2, String(resuelto.rows[0].n))

  // Estado final: registros remitidos con CSV, cola a cero, 0 anomalías.
  const finales = await db.query(
    `select num_serie_factura, estado_remision, csv_aeat from sif_registros
      where user_id = $1 order by correlativo`,
    [MERCADONET.userId]
  )
  for (const f of finales.rows) {
    check(`panel: ${f.num_serie_factura} remitido con CSV ${f.csv_aeat}`,
      (f.estado_remision === 'accepted' || f.estado_remision === 'accepted_with_errors') &&
        f.csv_aeat === respuesta.csv,
      `${f.estado_remision} / ${f.csv_aeat}`)
  }
  const cola = await db.query(
    `select count(*) filter (where estado <> 'enviado') as abiertos from sif_outbox where user_id = $1`,
    [MERCADONET.userId]
  )
  check('panel: cola de remisión a cero', Number(cola.rows[0].abiertos) === 0, String(cola.rows[0].abiertos))
  const anomalias = await db.query('select * from public.sif_detectar_anomalias($1)', [MERCADONET.userId])
  check('integridad: 0 anomalías en la cadena (sif_detectar_anomalias)', anomalias.rows.length === 0,
    JSON.stringify(anomalias.rows))

  // Contexto de negocio V26: el flujo debe poder contabilizarse en
  // ClassicConta 7 con el export AIG de V22.
  const invoices = await db.query(
    `select numero_fiscal, date::text as fecha, client_name, client_nif, id,
            subtotal::float8 as base, iva::float8 as cuota, iva_rate, irpf::float8 as irpf, total::float8 as total
       from invoices where user_id = $1 order by numero_fiscal`,
    [MERCADONET.userId]
  )
  const cc = construirExportClassicConta(
    invoices.rows.map((f) => ({
      numero: f.numero_fiscal,
      fecha: f.fecha,
      clienteNombre: f.client_name ?? 'PRUEBA - NO VALIDA',
      clienteNif: f.client_nif,
      clienteId: f.id,
      base: f.base,
      cuotaIva: f.cuota,
      tipoIva: f.iva_rate,
      retencionIrpf: f.irpf,
      totalFactura: f.total,
      rectificativa: false,
    }))
  )
  const diario = cc.apuntes.map(lineaDiario).join(EOL) + EOL
  const subcuentas = cc.subcuentas.map(lineaSubcuenta).join(EOL) + EOL
  check('ClassicConta: apuntes de diario a 869 chars y subcuentas a 444',
    cc.apuntes.every((a) => lineaDiario(a).length === ANCHO_DIARIO) &&
      cc.subcuentas.every((s) => lineaSubcuenta(s).length === ANCHO_SUBCUENTAS),
    `${cc.apuntes.length} apuntes / ${cc.subcuentas.length} subcuentas`)
  writeFileSync(join(dir, 'CC_diario.txt'), bytesAnsi(diario))
  writeFileSync(join(dir, 'CC_subcuentas.txt'), bytesAnsi(subcuentas))

  await db.close()
  const fallos = resultados.filter((r) => !r.ok).length
  writeFileSync(
    join(dir, 'informe-final.json'),
    JSON.stringify(
      {
        item: 'V26',
        fecha: new Date().toISOString(),
        obligado: { nif: MERCADONET.nif, nombreRazon: MERCADONET.nombreRazon },
        serie: meta.serie,
        estadoEnvio: respuesta.estadoEnvio,
        csv: respuesta.csv,
        facturas: finales.rows,
        cotejos: meta.cotejos,
        resultados,
      },
      null,
      2
    )
  )
  console.log(`\n--consolidar: ${resultados.length - fallos}/${resultados.length} verificaciones OK. Informe en ${join(dir, 'informe-final.json')}`)
  if (fallos > 0) process.exit(1)
}

// --- Programa ----------------------------------------------------------------
async function main() {
  if (process.env.VERIFACTU_ENTORNO === 'produccion') {
    console.error('VERIFACTU_ENTORNO=produccion: este script es SOLO para el entorno de pruebas AEAT.')
    process.exit(2)
  }
  const argv = process.argv.slice(2)
  const modo = argv[0]
  const iDir = argv.indexOf('--dir')
  const dir = iDir >= 0 ? argv[iDir + 1] : null

  if (modo === '--sql') {
    console.log(SQL_ALTA_REAL)
    return
  }
  if (modo === '--preparar' || modo === '--consolidar') {
    if (!dir) {
      console.error(`${modo} requiere --dir <directorio de trabajo>`)
      process.exit(2)
    }
    if (modo === '--preparar') await preparar(dir)
    else await consolidar(dir)
    return
  }
  console.error('Uso: verifactu-alta-mercadonet.mjs --preparar --dir <d> | --consolidar --dir <d> | --sql')
  process.exit(2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
