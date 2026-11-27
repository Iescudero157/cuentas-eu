// API v1 · De las filas de Supabase a la forma pública de openapi/kuentas-api-v1.yaml (27-nov-2026).
export const URL_APP = process.env.NEXT_PUBLIC_APP_URL || 'https://app.kuentas.eu'

export const COLUMNAS_FACTURA =
  'id, number, numero_fiscal, date, fecha_operacion, client_name, client_nif, subtotal, iva, irpf, total, status, verifactu_estado'

/** Estado fiscal público: las facturas que no pasaron por VERI*FACTU (módulo inactivo) son «sin_verifactu». */
export function estadoFiscal(verifactuEstado: string | null | undefined): string {
  return verifactuEstado && verifactuEstado !== 'borrador' ? verifactuEstado : 'sin_verifactu'
}

export function facturaResumen(f: Record<string, any>) {
  return {
    id: f.id,
    numero: f.numero_fiscal ?? f.number ?? null,
    fecha: f.date,
    fecha_operacion: f.fecha_operacion ?? null,
    cliente: { nombre: f.client_name, nif: f.client_nif || null },
    base: Number(f.subtotal),
    iva: Number(f.iva),
    irpf: Number(f.irpf),
    total: Number(f.total),
    estado_cobro: f.status,
    estado_fiscal: estadoFiscal(f.verifactu_estado),
    url: `${URL_APP}/dashboard/facturas`,
  }
}

const ENVIO: Record<string, string> = {
  generated: 'pendiente',
  queued: 'pendiente',
  sending: 'pendiente',
  accepted: 'aceptado',
  accepted_with_errors: 'aceptado_con_errores',
  rejected: 'rechazado',
}
export const estadoEnvio = (r: string | null | undefined) => (r ? ENVIO[r] ?? 'pendiente' : null)

export function borradorPublico(b: Record<string, any>) {
  return {
    id: b.id,
    estado: b.estado,
    cliente: { nombre: b.datos?.cliente?.nombre ?? null, nif: b.datos?.cliente?.nif ?? null },
    base: Number(b.base),
    iva: Number(b.iva),
    irpf: Number(b.irpf),
    total: Number(b.total),
    creado: b.creado_at,
    url_revision: `${URL_APP}/dashboard/facturas/nueva?borrador=${b.id}`,
  }
}
