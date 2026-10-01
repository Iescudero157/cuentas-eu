// Helper de servidor (V08): construye el bloque QR tributario + leyenda para
// el PDF de una factura a partir de las fuentes de verdad de Verifactu:
// la fila del registro de ALTA en `sif_registros` (NIF, NumSerieFactura,
// FechaExpedicion e ImporteTotal EXACTOS del registro remitido/por remitir)
// y el entorno AEAT configurado en `sif_config`.
//
// No importar desde componentes cliente.

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  construirBloqueQR,
  datosCotejoDesdeRegistro,
  type BloqueQRFactura,
  type FilaRegistroQR,
} from './qr.ts'

/** Estados fiscales de `invoices` que llevan QR (existe registro de alta). */
const ESTADOS_CON_QR = new Set(['emitida', 'rectificada', 'anulada'])

/**
 * Devuelve el bloque QR+leyenda de una factura, o `null` si la factura no
 * está emitida bajo Verifactu (borrador/legacy o sif_config ausente): en ese
 * caso el PDF se genera como hasta ahora, sin QR (D-11: nada ficticio).
 *
 * Lanza ErrorQR si el registro existe pero sus datos no son conformes
 * (anomalía de integridad que NO debe ocultarse).
 */
export async function bloqueQRParaInvoice(
  supabase: SupabaseClient,
  userId: string,
  invoice: { id: string; verifactu_estado?: string | null }
): Promise<BloqueQRFactura | null> {
  if (!invoice.verifactu_estado || !ESTADOS_CON_QR.has(invoice.verifactu_estado)) {
    return null
  }

  const { data: config, error: errConfig } = await supabase
    .from('sif_config')
    .select('entorno_aeat, modalidad')
    .eq('user_id', userId)
    .maybeSingle()
  if (errConfig || !config) return null

  const { data: registro, error: errRegistro } = await supabase
    .from('sif_registros')
    .select('id_emisor_factura, num_serie_factura, fecha_expedicion, importe_total')
    .eq('user_id', userId)
    .eq('invoice_id', invoice.id)
    .eq('tipo_registro', 'alta')
    .order('correlativo', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (errRegistro || !registro) return null

  return construirBloqueQR(
    datosCotejoDesdeRegistro(registro as FilaRegistroQR),
    config.entorno_aeat === 'produccion' ? 'produccion' : 'pruebas',
    { modalidad: config.modalidad === 'no_verifactu' ? 'no_verifactu' : 'verifactu' }
  )
}
