// ---------------------------------------------------------------------------
// V12 · Subsanación y reenvío de registros de facturación (SPEC §5.4-§5.5;
// doc. AEAT «Validaciones y errores»):
//
//   · Registro de alta `accepted_with_errors` (AceptadoConErrores): la AEAT lo
//     tiene registrado con errores admisibles → se genera un NUEVO registro de
//     alta con Subsanacion=S y el MISMO IDFactura, encadenado en la cadena del
//     obligado; el previo pasa a estado terminal 'subsanado'.
//   · Registro de alta `rejected` (Incorrecto): NO consta en la AEAT → nuevo
//     registro con Subsanacion=S + RechazoPrevio=S; el previo pasa a 'resent'.
//   · Registro de anulación `rejected`: nueva anulación con RechazoPrevio=S.
//
// La factura NO cambia (su contenido fiscal es inmutable tras la emisión,
// art. 8.2 RD 1007/2023): la subsanación corrige el REGISTRO. Si lo que está
// mal es la propia factura, el camino es la rectificativa R1-R5 o la anulación
// (V07). El registro corregido se reconstruye desde la factura congelada; la
// única corrección de datos admitida es el destinatario (p. ej. un NIF que la
// AEAT marcó como no identificado), pasada explícitamente en las opciones.
//
// La transacción SQL es sif_subsanar_registro (migración 20260919100000):
// mismo patrón que la emisión V07 (lock de cadena + huella + append + outbox).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  sistemaInformaticoKuentas,
  type Destinatario,
  type EntradaRegistroAlta,
  type OperacionExenta,
} from './registro-alta.ts'
import { construirRegistroAnulacion } from './registro-anulacion.ts'
import { facturaAppARegistroAnulacion } from './factura-app.ts'
import {
  cargarConfig,
  cargarInvoice,
  ErrorEmision,
  fijarXmlVerificado,
  prepararEntradaAlta,
  validarEmision,
  type FilaInvoice,
  type FilaSifConfig,
} from './emision.ts'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Columnas del registro previo que usa la subsanación. */
export interface FilaRegistroPrevio {
  id: string
  tipo_registro: 'alta' | 'anulacion'
  num_serie_factura: string
  /** `aaaa-mm-dd`. */
  fecha_expedicion: string
  tipo_factura: string | null
  estado_remision: string
  codigo_error_registro: string | null
  descripcion_error: string | null
}

export interface OpcionesSubsanacion {
  /**
   * Destinatario corregido (p. ej. NIF que la AEAT marcó como erróneo o no
   * censado). Si no se indica, el registro se reconstruye tal cual desde la
   * factura congelada.
   */
  destinatario?: Destinatario
  /** Causa de exención E1-E8 si la operación va exenta (como en la emisión). */
  operacionExenta?: OperacionExenta
}

export type ResultadoSubsanacion =
  | { sifActivo: false; motivo: string }
  | {
      sifActivo: true
      invoiceId: string
      registroId: string
      registroPrevioId: string
      /** Estado del registro previo antes de subsanar (accepted_with_errors|rejected). */
      estadoPrevio: string
      tipoRegistro: 'alta' | 'anulacion'
      numeroFiscal: string
      correlativo: number
      huella: string
      fechaHoraHusoGenRegistro: string
      /** S/N/X con el que se remitirá RechazoPrevio (undefined si no aplica). */
      rechazoPrevio?: 'S' | 'N' | 'X'
      xmlPersistido: boolean
      advertencias: string[]
    }

interface FilaRpcSubsanacion {
  registro_id: string
  correlativo: number
  num_serie_factura: string
  huella: string
  huella_anterior: string | null
  fecha_hora_huso_gen: string
  tipo_registro: 'alta' | 'anulacion'
  estado_previo: string
}

// ---------------------------------------------------------------------------
// Funciones puras (testeables sin base de datos)
// ---------------------------------------------------------------------------

/**
 * Construye la entrada del registro de alta SUBSANADOR: la de la emisión
 * (misma factura congelada) con el número fiscal definitivo, Subsanacion=S y
 * RechazoPrevio=S si el registro previo fue rechazado.
 */
export function prepararEntradaSubsanacion(
  invoice: FilaInvoice,
  config: FilaSifConfig,
  previo: Pick<FilaRegistroPrevio, 'num_serie_factura' | 'estado_remision' | 'tipo_factura'>,
  opciones: OpcionesSubsanacion = {},
  rectificada?: Pick<FilaInvoice, 'numero_fiscal' | 'date' | 'subtotal' | 'iva'> | null
): EntradaRegistroAlta {
  const entrada = prepararEntradaAlta(
    invoice,
    config,
    {
      operacionExenta: opciones.operacionExenta,
      tipoFactura: previo.tipo_factura && /^(F[1-3]|R[1-5])$/.test(previo.tipo_factura)
        ? (previo.tipo_factura as EntradaRegistroAlta['tipoFactura'])
        : undefined,
    },
    rectificada
  )
  // El IDFactura no cambia: número+serie definitivos del registro subsanado
  entrada.numSerieFactura = previo.num_serie_factura
  entrada.subsanacion = 'S'
  if (previo.estado_remision === 'rejected') entrada.rechazoPrevio = 'S'
  if (opciones.destinatario) entrada.destinatarios = [opciones.destinatario]
  return entrada
}

// ---------------------------------------------------------------------------
// Acceso a datos
// ---------------------------------------------------------------------------

const COLUMNAS_PREVIO =
  'id, tipo_registro, num_serie_factura, fecha_expedicion, tipo_factura, estado_remision, codigo_error_registro, descripcion_error'

/**
 * Último registro del tipo indicado generado para la factura (el único
 * candidato a subsanar: los anteriores ya quedaron en estado terminal).
 */
export async function cargarRegistroPrevio(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string,
  tipo: 'alta' | 'anulacion'
): Promise<FilaRegistroPrevio | null> {
  const { data, error } = await supabase
    .from('sif_registros')
    .select(COLUMNAS_PREVIO)
    .eq('user_id', userId)
    .eq('invoice_id', invoiceId)
    .eq('tipo_registro', tipo)
    .order('correlativo', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new ErrorEmision('registro_error', `Error leyendo sif_registros: ${error.message}`)
  return (data as FilaRegistroPrevio | null) ?? null
}

async function configActiva(
  supabase: SupabaseClient,
  userId: string
): Promise<FilaSifConfig | { sifActivo: false; motivo: string }> {
  const config = await cargarConfig(supabase, userId)
  if (!config) return { sifActivo: false, motivo: 'El obligado no tiene configuración Verifactu (sif_config)' }
  if (!config.activo) return { sifActivo: false, motivo: 'Módulo Verifactu desactivado para este obligado' }
  if (config.modalidad !== 'verifactu') {
    throw new ErrorEmision('modalidad_no_soportada', 'La modalidad no-VERI*FACTU no está soportada en v1 (DEC-V14, docs/verifactu/DECISIONES.md)')
  }
  return config
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------

/**
 * Subsana el registro de ALTA de una factura cuyo último registro quedó
 * `accepted_with_errors` o `rejected` tras la remisión (V10).
 */
export async function subsanarFactura(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string,
  opciones: OpcionesSubsanacion = {}
): Promise<ResultadoSubsanacion> {
  const config = await configActiva(supabase, userId)
  if ('sifActivo' in config) return config

  const invoice = await cargarInvoice(supabase, userId, invoiceId)
  if (invoice.verifactu_estado !== 'emitida' && invoice.verifactu_estado !== 'rectificada') {
    throw new ErrorEmision(
      'no_subsanable',
      `Solo se subsana el registro de una factura emitida o rectificada (estado actual: "${invoice.verifactu_estado}")`
    )
  }

  const previo = await cargarRegistroPrevio(supabase, userId, invoiceId, 'alta')
  if (!previo) {
    throw new ErrorEmision('sin_registro', 'La factura no tiene registro de alta que subsanar')
  }
  if (previo.estado_remision !== 'accepted_with_errors' && previo.estado_remision !== 'rejected') {
    throw new ErrorEmision(
      'no_subsanable',
      `El registro está "${previo.estado_remision}": solo se subsana un registro aceptado con errores o rechazado por la AEAT`
    )
  }

  let rectificada: FilaInvoice | null = null
  if (invoice.rectifica_invoice_id) {
    rectificada = await cargarInvoice(supabase, userId, invoice.rectifica_invoice_id)
  }

  const sistemaInformatico = sistemaInformaticoKuentas(config.numero_instalacion)
  const entrada = prepararEntradaSubsanacion(invoice, config, previo, opciones, rectificada)
  const dryRun = validarEmision(entrada, sistemaInformatico) // lanza ErrorValidacionRegistro

  const { data, error } = await supabase.rpc('sif_subsanar_registro', {
    p_user_id: userId,
    p_registro_prev_id: previo.id,
    p_registro: { entrada, sistemaInformatico },
    p_cuota_total: Number(dryRun.cuotaTotal),
    p_importe_total: Number(dryRun.importeTotal),
  })
  if (error) throw new ErrorEmision('rpc_subsanacion', `sif_subsanar_registro: ${error.message}`)
  const fila = (Array.isArray(data) ? data[0] : data) as FilaRpcSubsanacion | undefined
  if (!fila) throw new ErrorEmision('rpc_subsanacion', 'sif_subsanar_registro no devolvió resultado')

  const { xmlPersistido, advertencias } = await fijarXmlVerificado(
    supabase, userId, fila.registro_id, fila.huella, 'alta'
  )

  return {
    sifActivo: true,
    invoiceId,
    registroId: fila.registro_id,
    registroPrevioId: previo.id,
    estadoPrevio: fila.estado_previo,
    tipoRegistro: 'alta',
    numeroFiscal: fila.num_serie_factura,
    correlativo: Number(fila.correlativo),
    huella: fila.huella,
    fechaHoraHusoGenRegistro: fila.fecha_hora_huso_gen,
    rechazoPrevio: entrada.rechazoPrevio,
    xmlPersistido,
    advertencias,
  }
}

/**
 * Reenvía la ANULACIÓN de una factura cuyo registro de anulación fue
 * rechazado por la AEAT (RechazoPrevio=S; la anulación registrada no se
 * subsana: el XSD no tiene campo Subsanacion en RegistroAnulacion).
 */
export async function reenviarAnulacion(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string,
  opciones: { refExterna?: string } = {}
): Promise<ResultadoSubsanacion> {
  const config = await configActiva(supabase, userId)
  if ('sifActivo' in config) return config

  const invoice = await cargarInvoice(supabase, userId, invoiceId)
  if (invoice.verifactu_estado !== 'anulada') {
    throw new ErrorEmision(
      'no_anulada',
      `Solo se reenvía la anulación de una factura anulada (estado actual: "${invoice.verifactu_estado}")`
    )
  }

  const previo = await cargarRegistroPrevio(supabase, userId, invoiceId, 'anulacion')
  if (!previo) {
    throw new ErrorEmision('sin_registro', 'La factura no tiene registro de anulación que reenviar')
  }
  if (previo.estado_remision !== 'rejected') {
    throw new ErrorEmision(
      'no_subsanable',
      `El registro de anulación está "${previo.estado_remision}": solo se reenvía una anulación rechazada por la AEAT`
    )
  }

  const sistemaInformatico = sistemaInformaticoKuentas(config.numero_instalacion)
  const entrada = facturaAppARegistroAnulacion(
    { invoice_number: previo.num_serie_factura, date: previo.fecha_expedicion },
    { nif: config.nif_obligado, nombreRazon: config.nombre_razon },
    { refExterna: opciones.refExterna, rechazoPrevio: 'S' }
  )
  // Dry-run de validación (misma razón que en la emisión)
  construirRegistroAnulacion(entrada, { encadenamiento: { primerRegistro: true }, sistemaInformatico })

  const { data, error } = await supabase.rpc('sif_subsanar_registro', {
    p_user_id: userId,
    p_registro_prev_id: previo.id,
    p_registro: { entrada, sistemaInformatico },
    p_cuota_total: null,
    p_importe_total: null,
  })
  if (error) throw new ErrorEmision('rpc_subsanacion', `sif_subsanar_registro: ${error.message}`)
  const fila = (Array.isArray(data) ? data[0] : data) as FilaRpcSubsanacion | undefined
  if (!fila) throw new ErrorEmision('rpc_subsanacion', 'sif_subsanar_registro no devolvió resultado')

  const { xmlPersistido, advertencias } = await fijarXmlVerificado(
    supabase, userId, fila.registro_id, fila.huella, 'anulacion'
  )

  return {
    sifActivo: true,
    invoiceId,
    registroId: fila.registro_id,
    registroPrevioId: previo.id,
    estadoPrevio: fila.estado_previo,
    tipoRegistro: 'anulacion',
    numeroFiscal: fila.num_serie_factura,
    correlativo: Number(fila.correlativo),
    huella: fila.huella,
    fechaHoraHusoGenRegistro: fila.fecha_hora_huso_gen,
    rechazoPrevio: 'S',
    xmlPersistido,
    advertencias,
  }
}
