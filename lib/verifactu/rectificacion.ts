// Factura rectificativa «por diferencias» de una factura emitida.
//
// Base legal (RD 1619/2012, BOE-A-2012-14696):
//  · art. 15.4: la rectificación se hace con una NUEVA factura en la que constan
//    los datos identificativos de la factura rectificada;
//  · art. 15.5: los importes pueden consignarse «indicando directamente el
//    importe de la rectificación, con independencia de su signo» (modalidad por
//    diferencias, la que usa Kuentas: TipoRectificativa = I en el registro);
//  · art. 6.1.a).2.º: serie específica para las rectificativas;
//  · art. 7.1.h): en la rectificativa simplificada, referencia expresa a la
//    factura rectificada y a lo que se modifica.
//
// La factura original NO se toca (es inmutable, art. 8.2 RD 1007/2023): la
// rectificativa es una factura nueva, con su propio registro de alta R1-R5,
// encadenado como cualquier otro. La modalidad «por sustitución» (S) la admite
// el motor, pero la pantalla no la ofrece.

import type { SupabaseClient } from '@supabase/supabase-js'

import { cargarConfig, emitirFactura, ErrorEmision, hoyEnEspana, type ResultadoEmision } from './emision.ts'
import { esSimplificada, tipoRectificativaPara, type TipoFacturaFiscal } from './factura-fiscal.ts'
import { ErrorValidacionRegistro } from './registro-alta.ts'

/** Longitud máxima del motivo (entra en la descripción de la operación, ≤500). */
export const MAX_MOTIVO_RECTIFICACION = 300

/** Columnas de la factura original que hacen falta para rectificarla. */
export interface FacturaRectificable {
  id: string
  user_id: string
  number: string
  numero_fiscal: string | null
  /** `aaaa-mm-dd`. */
  date: string
  verifactu_estado: string
  tipo_factura: string | null
  client_id: string | null
  client_name: string | null
  client_nif: string | null
  client_address: string | null
  client_email: string | null
  subtotal: number
  iva: number
  iva_rate: number
  irpf: number
  irpf_rate: number
  total: number
  operacion_exenta?: string | null
  exencion_detalle?: string | null
}

export interface ParametrosRectificativa {
  /**
   * `total`: deja sin efecto todo el importe que sigue vigente de la factura.
   * `importe`: la base imponible correcta de la operación es `baseCorrecta`.
   */
  modo: 'total' | 'importe'
  baseCorrecta?: number
  /** Qué se rectifica y por qué; se imprime en la factura rectificativa. */
  motivo: string
  /** R1-R4 (lista L2) si la original es completa; si es simplificada siempre es R5. */
  tipo?: string | null
  /** «Hoy» en España (`aaaa-mm-dd`); la rectificativa se expide con esta fecha. */
  hoy: string
}

/** Suma de las rectificativas por diferencias ya emitidas sobre la misma factura. */
export interface ImportesRectificados {
  subtotal: number
  iva: number
  irpf: number
}

/** Fila lista para insertar en `invoices` como borrador de la rectificativa. */
export interface BorradorRectificativa {
  number: string
  client_id: string | null
  client_name: string
  client_nif: string | null
  client_address: string | null
  client_email: string | null
  items: { description: string; quantity: number; unitPrice: number; total: number }[]
  subtotal: number
  iva: number
  iva_rate: number
  irpf: number
  irpf_rate: number
  total: number
  date: string
  due_date: string
  status: 'pendiente'
  rectifica_invoice_id: string
  tipo_rectificativa: 'I'
  tipo_factura: TipoFacturaFiscal
  operacion_exenta: string | null
  exencion_detalle: string | null
}

function redondear(valor: number): number {
  return Math.round((valor + Math.sign(valor) * Number.EPSILON) * 100) / 100
}

function fechaLegible(iso: string): string {
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/**
 * Construye la factura rectificativa por diferencias de `original`. Función
 * pura: valida y calcula, sin tocar la base de datos. Lanza ErrorEmision con
 * un código estable si la rectificación no procede.
 */
export function construirBorradorRectificativa(
  original: FacturaRectificable,
  parametros: ParametrosRectificativa,
  yaRectificado: ImportesRectificados = { subtotal: 0, iva: 0, irpf: 0 }
): BorradorRectificativa {
  if (
    (original.verifactu_estado !== 'emitida' && original.verifactu_estado !== 'rectificada') ||
    !original.numero_fiscal
  ) {
    throw new ErrorEmision(
      'no_rectificable',
      `Solo se rectifica una factura emitida (estado actual: "${original.verifactu_estado}"). ` +
        'Un borrador se corrige directamente y una factura anulada ya no tiene efectos.'
    )
  }

  const motivo = (parametros.motivo ?? '').trim().replace(/\s+/g, ' ')
  if (motivo.length < 5) {
    throw new ErrorEmision(
      'motivo_requerido',
      'Indica qué se rectifica y por qué (al menos 5 caracteres): se imprime en la factura rectificativa.'
    )
  }
  if (motivo.length > MAX_MOTIVO_RECTIFICACION) {
    throw new ErrorEmision('motivo_largo', `El motivo no puede superar los ${MAX_MOTIVO_RECTIFICACION} caracteres.`)
  }

  const simplificada = original.tipo_factura === 'F2' || original.tipo_factura === 'R5'
  if (!simplificada && !/^R[1-4]$/.test(parametros.tipo ?? '')) {
    throw new ErrorEmision(
      'tipo_requerido',
      'Elige el tipo de rectificativa (R1, R2, R3 o R4) según la causa de la rectificación.'
    )
  }
  const tipo = tipoRectificativaPara(original.tipo_factura, parametros.tipo)

  // Importes que siguen vigentes: los de la factura más las rectificativas por
  // diferencias que ya se emitieron sobre ella.
  const vigente = {
    subtotal: redondear(Number(original.subtotal) + Number(yaRectificado.subtotal)),
    iva: redondear(Number(original.iva) + Number(yaRectificado.iva)),
    irpf: redondear(Number(original.irpf) + Number(yaRectificado.irpf)),
  }
  const tipoIva = Number(original.iva_rate)
  const tipoIrpf = Number(original.irpf_rate)

  let baseCorrecta: number
  if (parametros.modo === 'total') {
    baseCorrecta = 0
  } else if (parametros.modo === 'importe') {
    baseCorrecta = Number(parametros.baseCorrecta)
    if (!Number.isFinite(baseCorrecta) || baseCorrecta < 0) {
      throw new ErrorEmision('base_invalida', 'La base imponible correcta debe ser un importe igual o mayor que cero.')
    }
    baseCorrecta = redondear(baseCorrecta)
  } else {
    throw new ErrorEmision('modo_invalido', 'Indica si se deja sin efecto todo el importe o se corrige la base imponible.')
  }

  // Diferencias = lo que debió facturarse − lo que sigue vigente.
  const subtotal = redondear(baseCorrecta - vigente.subtotal)
  const iva = redondear(redondear((baseCorrecta * tipoIva) / 100) - vigente.iva)
  const irpf = redondear(redondear((baseCorrecta * tipoIrpf) / 100) - vigente.irpf)
  if (subtotal === 0 && iva === 0 && irpf === 0) {
    throw new ErrorEmision(
      'sin_diferencias',
      parametros.modo === 'total'
        ? 'La factura ya no tiene importe vigente que dejar sin efecto.'
        : 'La base indicada es la que ya está vigente: no hay nada que rectificar.'
    )
  }

  const descripcion = `Rectificación de la factura ${original.numero_fiscal} de ${fechaLegible(original.date)}: ${motivo}`

  return {
    // Número provisional: el definitivo lo asigna el servidor al emitir (serie R o RS).
    number: `RECT-${original.numero_fiscal}`,
    client_id: original.client_id,
    client_name: original.client_name ?? '',
    // En una rectificativa de simplificada (R5) el destinatario no se identifica.
    client_nif: esSimplificada(tipo) ? null : original.client_nif,
    client_address: original.client_address,
    client_email: original.client_email,
    items: [{ description: descripcion, quantity: 1, unitPrice: subtotal, total: subtotal }],
    subtotal,
    iva,
    iva_rate: tipoIva,
    irpf,
    irpf_rate: tipoIrpf,
    total: redondear(subtotal + iva - irpf),
    date: parametros.hoy,
    due_date: parametros.hoy,
    status: 'pendiente',
    rectifica_invoice_id: original.id,
    tipo_rectificativa: 'I',
    tipo_factura: tipo,
    operacion_exenta: original.operacion_exenta ?? null,
    exencion_detalle: original.exencion_detalle ?? null,
  }
}

const COLUMNAS_RECTIFICABLE =
  'id, user_id, number, numero_fiscal, date, verifactu_estado, tipo_factura, client_id, client_name, client_nif, client_address, client_email, subtotal, iva, iva_rate, irpf, irpf_rate, total, operacion_exenta, exencion_detalle'

export type ResultadoRectificativa =
  | { sifActivo: false; motivo: string }
  | { sifActivo: true; invoiceId: string; rectificaInvoiceId: string; emision: Extract<ResultadoEmision, { sifActivo: true }> }

/**
 * Crea la factura rectificativa de `invoiceId` y la emite en el acto (número
 * correlativo de la serie R/RS + registro de alta R1-R5 encadenado + cola de
 * remisión). Si la emisión falla no queda ningún resto: se retira el borrador.
 */
export async function emitirRectificativa(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string,
  parametros: Omit<ParametrosRectificativa, 'hoy'> & { hoy?: string }
): Promise<ResultadoRectificativa> {
  const config = await cargarConfig(supabase, userId)
  if (!config) return { sifActivo: false, motivo: 'El obligado no tiene configuración Verifactu (sif_config)' }
  if (!config.activo) return { sifActivo: false, motivo: 'Módulo Verifactu desactivado para este obligado' }

  const { data: original, error: errOriginal } = await supabase
    .from('invoices')
    .select(COLUMNAS_RECTIFICABLE)
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .maybeSingle()
  if (errOriginal) throw new ErrorEmision('factura_error', `Error leyendo la factura: ${errOriginal.message}`)
  if (!original) throw new ErrorEmision('factura_no_encontrada', 'Factura no encontrada')

  // Rectificativas por diferencias ya emitidas sobre la misma factura (las
  // anuladas no cuentan): sus importes siguen vigentes junto a los de la original.
  const { data: previas, error: errPrevias } = await supabase
    .from('invoices')
    .select('subtotal, iva, irpf')
    .eq('user_id', userId)
    .eq('rectifica_invoice_id', invoiceId)
    .eq('tipo_rectificativa', 'I')
    .in('verifactu_estado', ['emitida', 'rectificada'])
  if (errPrevias) throw new ErrorEmision('factura_error', `Error leyendo rectificativas previas: ${errPrevias.message}`)
  const yaRectificado = (previas ?? []).reduce<ImportesRectificados>(
    (acc, p) => ({
      subtotal: acc.subtotal + Number(p.subtotal ?? 0),
      iva: acc.iva + Number(p.iva ?? 0),
      irpf: acc.irpf + Number(p.irpf ?? 0),
    }),
    { subtotal: 0, iva: 0, irpf: 0 }
  )

  const borrador = construirBorradorRectificativa(
    original as unknown as FacturaRectificable,
    { ...parametros, hoy: parametros.hoy ?? hoyEnEspana() },
    yaRectificado
  )

  const { data: creada, error: errCrear } = await supabase
    .from('invoices')
    .insert({ user_id: userId, ...borrador })
    .select('id')
    .single()
  if (errCrear || !creada) {
    throw new ErrorEmision('rectificativa_error', `No se pudo crear la factura rectificativa: ${errCrear?.message ?? 'sin datos'}`)
  }

  try {
    const emision = await emitirFactura(supabase, userId, creada.id as string)
    if (!emision.sifActivo) {
      await supabase.from('invoices').delete().eq('id', creada.id).eq('user_id', userId)
      return emision
    }
    return { sifActivo: true, invoiceId: creada.id as string, rectificaInvoiceId: invoiceId, emision }
  } catch (e) {
    // La RPC es atómica: si falló no consumió número ni eslabón de cadena y la
    // factura sigue en borrador; se retira para no dejar restos.
    await supabase.from('invoices').delete().eq('id', creada.id).eq('user_id', userId)
    if (e instanceof ErrorEmision || e instanceof ErrorValidacionRegistro) throw e
    throw new ErrorEmision('rectificativa_error', e instanceof Error ? e.message : 'Error emitiendo la rectificativa')
  }
}
