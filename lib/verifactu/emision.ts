// Servicio de emisión Verifactu (V07): orquesta la emisión y la anulación de
// facturas de cuentas-app contra las funciones SQL transaccionales de la
// migración 20260913100000_sif_emision.sql.
//
// Flujo de emisión (D-01/D-02/D-03, art. 9 RD 1007/2023):
//   1. Carga factura + sif_config (feature flag `activo` por empresa).
//   2. DRY-RUN: construye y VALIDA el registro completo con construirRegistroAlta
//      (NIF, listas, aritmética ±10 €) con un número provisional — si la factura
//      es inválida se aborta ANTES de reservar número (sin huecos de correlativo).
//   3. RPC `sif_emitir_factura`: transacción atómica en Postgres (lock de la
//      cadena del obligado + número correlativo + huella SHA-256 + registro
//      append-only + outbox + factura borrador→emitida).
//   4. Reconstruye el XML oficial con los datos definitivos, verifica que la
//      huella TypeScript coincide con la calculada en SQL (defensa en
//      profundidad) y fija el XML una única vez (`sif_fijar_xml`).
//
// El XML es regenerable de forma determinista desde `sif_registros.registro`
// (jsonb) mediante reconstruirRegistroAlta/reconstruirRegistroAnulacion: es lo
// que usará el worker de remisión (V10) si el paso 4 no llegó a fijarlo.

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  construirRegistroAlta,
  sistemaInformaticoKuentas,
  type Encadenamiento,
  type EntradaRegistroAlta,
  type FacturaRelacionada,
  type ImporteRectificacion,
  type OperacionExenta,
  type RegistroAltaGenerado,
  type SistemaInformatico,
  type TipoFactura,
  type TipoRectificativa,
} from './registro-alta.ts'
import {
  construirRegistroAnulacion,
  type EntradaRegistroAnulacion,
  type RegistroAnulacionGenerado,
} from './registro-anulacion.ts'
import {
  facturaAppARegistroAlta,
  facturaAppARegistroAnulacion,
  type FacturaApp,
} from './factura-app.ts'

// ---------------------------------------------------------------------------
// Tipos de fila (columnas usadas de las tablas reales)
// ---------------------------------------------------------------------------

/** Columnas de `invoices` que usa la emisión (V03 §invoices_estados_fiscales). */
export interface FilaInvoice {
  id: string
  user_id: string
  number: string
  date: string
  client_name: string | null
  client_nif: string | null
  items: FacturaApp['items'] | null
  subtotal: number
  iva: number
  iva_rate: number
  irpf: number
  irpf_rate: number
  total: number
  verifactu_estado: 'borrador' | 'emitida' | 'rectificada' | 'anulada'
  numero_fiscal: string | null
  tipo_factura: string | null
  rectifica_invoice_id: string | null
  tipo_rectificativa: 'S' | 'I' | null
}

/** Columnas de `sif_config` que usa la emisión. */
export interface FilaSifConfig {
  user_id: string
  nif_obligado: string
  nombre_razon: string
  numero_instalacion: string
  modalidad: 'verifactu' | 'no_verifactu'
  entorno_aeat: 'pruebas' | 'produccion'
  activo: boolean
}

/** Registro persistido en `sif_registros.registro` (jsonb) para un ALTA. */
export interface RegistroAltaPersistido {
  entrada: EntradaRegistroAlta
  sistemaInformatico: SistemaInformatico
  encadenamiento: Encadenamiento
  fechaHoraHusoGenRegistro: string
  tipoHuella: string
  huella: string
}

/** Registro persistido en `sif_registros.registro` (jsonb) para una ANULACIÓN. */
export interface RegistroAnulacionPersistido {
  entrada: EntradaRegistroAnulacion
  sistemaInformatico: SistemaInformatico
  encadenamiento: Encadenamiento
  fechaHoraHusoGenRegistro: string
  tipoHuella: string
  huella: string
}

interface FilaRpcEmision {
  registro_id: string
  correlativo: number
  numero: number
  num_serie_factura: string
  huella: string
  huella_anterior: string | null
  fecha_hora_huso_gen: string
  primer_registro: boolean
  fecha_expedicion: string
  tipo_factura: string
}

interface FilaRpcAnulacion {
  registro_id: string
  correlativo: number
  num_serie_factura: string
  huella: string
  huella_anterior: string | null
  fecha_hora_huso_gen: string
  primer_registro: boolean
  fecha_expedicion: string
}

export interface OpcionesEmision {
  /** Serie a usar (por defecto `F`, o `R` si la factura es rectificativa). */
  serie?: string
  /** Fuerza el tipo (por defecto F1/F2 según destinatario; R* si rectificativa). */
  tipoFactura?: TipoFactura
  /** Causa de exención E1-E8 si la operación va exenta de IVA. */
  operacionExenta?: OperacionExenta
}

export type ResultadoEmision =
  | { sifActivo: false; motivo: string }
  | {
      sifActivo: true
      invoiceId: string
      registroId: string
      numeroFiscal: string
      correlativo: number
      huella: string
      fechaHoraHusoGenRegistro: string
      primerRegistro: boolean
      tipoFactura: string
      xmlPersistido: boolean
      advertencias: string[]
    }

export type ResultadoAnulacion =
  | { sifActivo: false; motivo: string }
  | {
      sifActivo: true
      invoiceId: string
      registroId: string
      numeroFiscalAnulado: string
      correlativo: number
      huella: string
      fechaHoraHusoGenRegistro: string
      xmlPersistido: boolean
      advertencias: string[]
    }

/** Error de negocio de la emisión, con código estable para la capa API. */
export class ErrorEmision extends Error {
  readonly codigo: string
  readonly detalles: readonly string[]
  constructor(codigo: string, mensaje: string, detalles: readonly string[] = []) {
    super(mensaje)
    this.name = 'ErrorEmision'
    this.codigo = codigo
    this.detalles = detalles
  }
}

// Número provisional SOLO para el dry-run de validación (el definitivo lo
// asigna sif_reservar_numero dentro de la transacción; formato D-01).
const NUM_PROVISIONAL = 'F-0000-000000'

// ---------------------------------------------------------------------------
// Funciones puras (testeables sin base de datos)
// ---------------------------------------------------------------------------

/** Mapea la fila de `invoices` al modelo del adaptador factura-app. */
export function filaAFacturaApp(inv: FilaInvoice, numSerie: string): FacturaApp {
  return {
    invoice_number: numSerie,
    date: inv.date,
    client_name: inv.client_name,
    client_nif: inv.client_nif,
    items: inv.items ?? [],
    subtotal: Number(inv.subtotal),
    iva: Number(inv.iva),
    iva_rate: Number(inv.iva_rate),
    irpf: Number(inv.irpf),
    irpf_rate: Number(inv.irpf_rate),
    total: Number(inv.total),
  }
}

/**
 * Construye la entrada del registro de alta para una factura de la app,
 * incluyendo el bloque de rectificativa (R1-R5) si procede.
 */
export function prepararEntradaAlta(
  invoice: FilaInvoice,
  config: FilaSifConfig,
  opciones: OpcionesEmision = {},
  rectificada?: Pick<FilaInvoice, 'numero_fiscal' | 'date' | 'subtotal' | 'iva'> | null
): EntradaRegistroAlta {
  const esRectificativa = invoice.rectifica_invoice_id !== null || /^R[1-5]$/.test(opciones.tipoFactura ?? '')
  const tipoGuardado = invoice.tipo_factura && /^R[1-5]$/.test(invoice.tipo_factura)
    ? (invoice.tipo_factura as TipoFactura)
    : undefined

  const entrada = facturaAppARegistroAlta(
    filaAFacturaApp(invoice, NUM_PROVISIONAL),
    { nif: config.nif_obligado, nombreRazon: config.nombre_razon },
    {
      tipoFactura: esRectificativa ? (opciones.tipoFactura ?? tipoGuardado ?? 'R1') : opciones.tipoFactura,
      operacionExenta: opciones.operacionExenta,
    }
  )

  if (esRectificativa) {
    if (!rectificada?.numero_fiscal) {
      throw new ErrorEmision(
        'rectificada_invalida',
        'La factura rectificada no existe, no es del usuario o no tiene número fiscal (solo se rectifican facturas emitidas)'
      )
    }
    const tipoRect: TipoRectificativa = invoice.tipo_rectificativa ?? 'I'
    const facturaRectificada: FacturaRelacionada = {
      idEmisorFactura: config.nif_obligado,
      numSerieFactura: rectificada.numero_fiscal,
      fechaExpedicion: rectificada.date,
    }
    entrada.tipoRectificativa = tipoRect
    entrada.facturasRectificadas = [facturaRectificada]
    if (tipoRect === 'S') {
      const importe: ImporteRectificacion = {
        baseRectificada: Number(rectificada.subtotal),
        cuotaRectificada: Number(rectificada.iva),
      }
      entrada.importeRectificacion = importe
    }
  }

  return entrada
}

/**
 * DRY-RUN de validación: ejecuta el generador completo (NIF, listas oficiales,
 * aritmética ±10 €) con número provisional y cadena ficticia. Lanza
 * ErrorValidacionRegistro si la factura no es conforme. Sus totales
 * recalculados (cuotaTotal/importeTotal) son los que van a la RPC.
 */
export function validarEmision(
  entrada: EntradaRegistroAlta,
  sistemaInformatico: SistemaInformatico
): RegistroAltaGenerado {
  return construirRegistroAlta(entrada, {
    encadenamiento: { primerRegistro: true },
    sistemaInformatico,
  })
}

/**
 * Regenera el registro de ALTA (XML + huella) desde el jsonb persistido en
 * `sif_registros.registro`. Determinista: mismo jsonb ⇒ mismo XML y huella.
 */
export function reconstruirRegistroAlta(registro: RegistroAltaPersistido): RegistroAltaGenerado {
  return construirRegistroAlta(registro.entrada, {
    encadenamiento: registro.encadenamiento,
    sistemaInformatico: registro.sistemaInformatico,
    fechaGeneracion: new Date(registro.fechaHoraHusoGenRegistro),
  })
}

/** Regenera el registro de ANULACIÓN desde el jsonb persistido. */
export function reconstruirRegistroAnulacion(
  registro: RegistroAnulacionPersistido
): RegistroAnulacionGenerado {
  return construirRegistroAnulacion(registro.entrada, {
    encadenamiento: registro.encadenamiento,
    sistemaInformatico: registro.sistemaInformatico,
    fechaGeneracion: new Date(registro.fechaHoraHusoGenRegistro),
  })
}

// ---------------------------------------------------------------------------
// Acceso a datos
// ---------------------------------------------------------------------------

const COLUMNAS_INVOICE =
  'id, user_id, number, date, client_name, client_nif, items, subtotal, iva, iva_rate, irpf, irpf_rate, total, verifactu_estado, numero_fiscal, tipo_factura, rectifica_invoice_id, tipo_rectificativa'

export async function cargarConfig(supabase: SupabaseClient, userId: string): Promise<FilaSifConfig | null> {
  const { data, error } = await supabase
    .from('sif_config')
    .select('user_id, nif_obligado, nombre_razon, numero_instalacion, modalidad, entorno_aeat, activo')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new ErrorEmision('config_error', `Error leyendo sif_config: ${error.message}`)
  return (data as FilaSifConfig | null) ?? null
}

export async function cargarInvoice(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string
): Promise<FilaInvoice> {
  const { data, error } = await supabase
    .from('invoices')
    .select(COLUMNAS_INVOICE)
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new ErrorEmision('factura_error', `Error leyendo la factura: ${error.message}`)
  if (!data) throw new ErrorEmision('factura_no_encontrada', 'Factura no encontrada')
  return data as unknown as FilaInvoice
}

/**
 * Tras el commit de la RPC: reconstruye el XML oficial desde el jsonb
 * persistido, verifica que la huella TS coincide con la SQL y fija el XML
 * (una única vez). Nunca lanza: la emisión ya está registrada; cualquier
 * problema aquí se devuelve como advertencia (el worker V10 puede regenerar
 * el XML desde `registro`).
 */
export async function fijarXmlVerificado(
  supabase: SupabaseClient,
  userId: string,
  registroId: string,
  huellaSql: string,
  tipo: 'alta' | 'anulacion'
): Promise<{ xmlPersistido: boolean; advertencias: string[] }> {
  const advertencias: string[] = []
  try {
    const { data, error } = await supabase
      .from('sif_registros')
      .select('registro')
      .eq('id', registroId)
      .single()
    if (error || !data) {
      advertencias.push(`No se pudo releer el registro para fijar el XML: ${error?.message ?? 'sin datos'}`)
      return { xmlPersistido: false, advertencias }
    }

    const generado =
      tipo === 'alta'
        ? reconstruirRegistroAlta(data.registro as RegistroAltaPersistido)
        : reconstruirRegistroAnulacion(data.registro as RegistroAnulacionPersistido)

    if (generado.huella !== huellaSql) {
      // Divergencia SQL/TS: NO fijar un XML cuya huella no coincide con la
      // registrada. El registro queda sin XML y debe revisarse (V12).
      advertencias.push(
        `ALERTA: huella TS (${generado.huella}) ≠ huella SQL (${huellaSql}); XML no fijado, revisar integridad`
      )
      return { xmlPersistido: false, advertencias }
    }

    const { data: fijado, error: errFijar } = await supabase.rpc('sif_fijar_xml', {
      p_user_id: userId,
      p_registro_id: registroId,
      p_xml: generado.xml,
    })
    if (errFijar) {
      advertencias.push(`No se pudo fijar el XML: ${errFijar.message}`)
      return { xmlPersistido: false, advertencias }
    }
    return { xmlPersistido: fijado === true, advertencias }
  } catch (e) {
    advertencias.push(`Excepción fijando el XML: ${e instanceof Error ? e.message : String(e)}`)
    return { xmlPersistido: false, advertencias }
  }
}

// ---------------------------------------------------------------------------
// Servicio principal
// ---------------------------------------------------------------------------

/**
 * Emite una factura bajo Verifactu. Si el obligado no tiene el módulo activo
 * (feature flag `sif_config.activo`), devuelve `{ sifActivo: false }` y la
 * factura queda como hasta ahora (flujo legacy, sin registro).
 */
export async function emitirFactura(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string,
  opciones: OpcionesEmision = {}
): Promise<ResultadoEmision> {
  const config = await cargarConfig(supabase, userId)
  if (!config) return { sifActivo: false, motivo: 'El obligado no tiene configuración Verifactu (sif_config)' }
  if (!config.activo) return { sifActivo: false, motivo: 'Módulo Verifactu desactivado para este obligado' }
  if (config.modalidad !== 'verifactu') {
    throw new ErrorEmision('modalidad_no_soportada', 'La modalidad no-VERI*FACTU no está soportada en v1 (se evalúa en V14)')
  }

  const invoice = await cargarInvoice(supabase, userId, invoiceId)
  if (invoice.verifactu_estado !== 'borrador') {
    throw new ErrorEmision(
      'no_borrador',
      `La factura ya está "${invoice.verifactu_estado}": una factura solo se emite una vez (art. 9 RD 1007/2023)`
    )
  }

  let rectificada: FilaInvoice | null = null
  if (invoice.rectifica_invoice_id) {
    rectificada = await cargarInvoice(supabase, userId, invoice.rectifica_invoice_id)
  }

  const sistemaInformatico = sistemaInformaticoKuentas(config.numero_instalacion)
  const entrada = prepararEntradaAlta(invoice, config, opciones, rectificada)
  const dryRun = validarEmision(entrada, sistemaInformatico) // lanza ErrorValidacionRegistro si no es conforme

  const { data, error } = await supabase.rpc('sif_emitir_factura', {
    p_user_id: userId,
    p_invoice_id: invoiceId,
    p_registro: { entrada, sistemaInformatico },
    p_cuota_total: Number(dryRun.cuotaTotal),
    p_importe_total: Number(dryRun.importeTotal),
    p_serie: opciones.serie ?? null,
  })
  if (error) throw new ErrorEmision('rpc_emision', `sif_emitir_factura: ${error.message}`)
  const fila = (Array.isArray(data) ? data[0] : data) as FilaRpcEmision | undefined
  if (!fila) throw new ErrorEmision('rpc_emision', 'sif_emitir_factura no devolvió resultado')

  const { xmlPersistido, advertencias } = await fijarXmlVerificado(
    supabase, userId, fila.registro_id, fila.huella, 'alta'
  )

  return {
    sifActivo: true,
    invoiceId,
    registroId: fila.registro_id,
    numeroFiscal: fila.num_serie_factura,
    correlativo: Number(fila.correlativo),
    huella: fila.huella,
    fechaHoraHusoGenRegistro: fila.fecha_hora_huso_gen,
    primerRegistro: fila.primer_registro,
    tipoFactura: fila.tipo_factura,
    xmlPersistido,
    advertencias,
  }
}

/**
 * Anula una factura EMITIDA generando el registro de anulación encadenado
 * (D-12: la anulación sustituye al borrado; art. 11 RD 1007/2023).
 */
export async function anularFactura(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string,
  opciones: { refExterna?: string } = {}
): Promise<ResultadoAnulacion> {
  const config = await cargarConfig(supabase, userId)
  if (!config) return { sifActivo: false, motivo: 'El obligado no tiene configuración Verifactu (sif_config)' }
  if (!config.activo) return { sifActivo: false, motivo: 'Módulo Verifactu desactivado para este obligado' }
  if (config.modalidad !== 'verifactu') {
    throw new ErrorEmision('modalidad_no_soportada', 'La modalidad no-VERI*FACTU no está soportada en v1 (se evalúa en V14)')
  }

  const invoice = await cargarInvoice(supabase, userId, invoiceId)
  if (invoice.verifactu_estado !== 'emitida' || !invoice.numero_fiscal) {
    throw new ErrorEmision(
      'no_emitida',
      `Solo se anulan facturas emitidas (estado actual: "${invoice.verifactu_estado}")`
    )
  }

  const sistemaInformatico = sistemaInformaticoKuentas(config.numero_instalacion)
  const entrada = facturaAppARegistroAnulacion(
    { invoice_number: invoice.numero_fiscal, date: invoice.date },
    { nif: config.nif_obligado, nombreRazon: config.nombre_razon },
    { refExterna: opciones.refExterna }
  )
  // Dry-run de validación (misma razón que en la emisión)
  construirRegistroAnulacion(entrada, { encadenamiento: { primerRegistro: true }, sistemaInformatico })

  const { data, error } = await supabase.rpc('sif_anular_factura', {
    p_user_id: userId,
    p_invoice_id: invoiceId,
    p_registro: { entrada, sistemaInformatico },
  })
  if (error) throw new ErrorEmision('rpc_anulacion', `sif_anular_factura: ${error.message}`)
  const fila = (Array.isArray(data) ? data[0] : data) as FilaRpcAnulacion | undefined
  if (!fila) throw new ErrorEmision('rpc_anulacion', 'sif_anular_factura no devolvió resultado')

  const { xmlPersistido, advertencias } = await fijarXmlVerificado(
    supabase, userId, fila.registro_id, fila.huella, 'anulacion'
  )

  return {
    sifActivo: true,
    invoiceId,
    registroId: fila.registro_id,
    numeroFiscalAnulado: fila.num_serie_factura,
    correlativo: Number(fila.correlativo),
    huella: fila.huella,
    fechaHoraHusoGenRegistro: fila.fecha_hora_huso_gen,
    xmlPersistido,
    advertencias,
  }
}
