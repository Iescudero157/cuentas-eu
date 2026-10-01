// Adaptador: factura de cuentas-app (tabla `invoices` + perfil del emisor)
// → EntradaRegistroAlta del generador Verifactu (registro-alta.ts).
//
// La UI v1 maneja UN tipo de IVA por factura (iva_rate) y retención IRPF
// (auditoría V01, R7): el adaptador produce una única línea de desglose S1
// en régimen general (o la operación exenta que se indique) y deja el modelo
// preparado para el desglose multi-tipo (el generador ya admite 12 líneas).
//
// IMPORTANTE (criterio AEAT, FAQ Veri*factu/SII): la retención IRPF NO minora
// el `ImporteTotal` del registro (ImporteTotal = Σ bases + cuotas). El campo
// `total` de la app (subtotal + IVA − IRPF) es el «total a pagar» de la
// factura, no el ImporteTotal del registro; por eso NO se usa como cross-check.

import {
  type Destinatario,
  type EntradaRegistroAlta,
  type LineaDesglose,
  type OperacionExenta,
  type TipoFactura,
  esNifValido,
} from './registro-alta.ts'
import { type EntradaRegistroAnulacion } from './registro-anulacion.ts'

/** Línea de concepto tal como se guarda en `invoices.items` (JSONB). */
export interface ItemFacturaApp {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

/** Columnas relevantes de la tabla `invoices` (auditoría V01 §3). */
export interface FacturaApp {
  invoice_number: string
  /** `aaaa-mm-dd` (columna date). */
  date: string
  client_name: string | null
  client_nif: string | null
  items: ItemFacturaApp[]
  subtotal: number
  iva: number
  iva_rate: number
  irpf: number
  irpf_rate: number
  total: number
}

/** Datos del emisor tomados de `profiles` (nunca del cliente HTTP). */
export interface EmisorApp {
  nombreRazon: string
  nif: string
}

export interface OpcionesFacturaApp {
  /**
   * Por defecto: `F1` si hay destinatario identificado (client_nif) y `F2`
   * (simplificada) si no lo hay. Las rectificativas (R1-R5) deben construirse
   * con `construirRegistroAlta` directamente aportando facturasRectificadas.
   */
  tipoFactura?: TipoFactura
  /**
   * Si la factura va exenta de IVA, causa de exención E1-E8 (art. 20 LIVA → E1,
   * exportación → E2…). Exige iva_rate = 0. Si no se indica y iva_rate = 0,
   * la operación se registra como sujeta S1 al tipo 0 %.
   */
  operacionExenta?: OperacionExenta
  /** Destinatario extranjero/UE (sustituye al par client_name/client_nif). */
  destinatario?: Destinatario
}

/** Descripción de la operación (≤500) a partir de los conceptos de la factura. */
export function descripcionDesdeItems(items: readonly ItemFacturaApp[]): string {
  const texto = items
    .map((i) => (i.description ?? '').trim())
    .filter((d) => d !== '')
    .join('; ')
  const limpio = texto === '' ? 'Prestación de servicios / entrega de bienes' : texto
  return limpio.length <= 500 ? limpio : `${limpio.slice(0, 499)}…`
}

/**
 * Convierte la factura de la app en la entrada del generador del registro de
 * alta. El generador después recalcula y valida totales y NIF (D-07/D-09):
 * si `subtotal`/`iva` del cliente no cuadran, la emisión falla.
 */
export function facturaAppARegistroAlta(
  factura: FacturaApp,
  emisor: EmisorApp,
  opciones: OpcionesFacturaApp = {}
): EntradaRegistroAlta {
  const exenta = opciones.operacionExenta
  if (exenta && factura.iva_rate !== 0) {
    throw new Error(
      `Factura marcada exenta (${exenta}) pero iva_rate=${factura.iva_rate}: una operación exenta no puede repercutir IVA`
    )
  }

  const linea: LineaDesglose = exenta
    ? {
        impuesto: '01',
        claveRegimen: exenta === 'E2' ? '02' : '01',
        operacionExenta: exenta,
        baseImponible: factura.subtotal,
      }
    : {
        impuesto: '01',
        claveRegimen: '01',
        calificacionOperacion: 'S1',
        tipoImpositivo: factura.iva_rate,
        baseImponible: factura.subtotal,
        cuotaRepercutida: factura.iva,
      }

  let destinatarios: Destinatario[] | undefined
  if (opciones.destinatario) {
    destinatarios = [opciones.destinatario]
  } else if (factura.client_nif && esNifValido(factura.client_nif)) {
    destinatarios = [
      { nombreRazon: factura.client_name ?? '', nif: factura.client_nif.trim().toUpperCase() },
    ]
  }

  const tipoFactura: TipoFactura = opciones.tipoFactura ?? (destinatarios ? 'F1' : 'F2')

  return {
    emisor: { nif: emisor.nif, nombreRazon: emisor.nombreRazon },
    numSerieFactura: factura.invoice_number,
    fechaExpedicion: factura.date,
    tipoFactura,
    descripcionOperacion: descripcionDesdeItems(factura.items ?? []),
    destinatarios,
    desglose: [linea],
    // Cross-check contra lo que calculó la app (R3 de V01). El IRPF no entra:
    // ImporteTotal del registro = base + cuota de IVA, sin restar la retención.
    cuotaTotalDeclarada: exenta ? 0 : factura.iva,
    importeTotalDeclarado: factura.subtotal + (exenta ? 0 : factura.iva),
  }
}

/**
 * Convierte una factura emitida de la app en la entrada del registro de
 * ANULACIÓN (D-12: la anulación sustituye al DELETE de facturas emitidas).
 * En Kuentas v1 el registro lo genera siempre el propio emisor, por lo que
 * no se rellenan GeneradoPor/Generador (opcionales en el XSD).
 */
export function facturaAppARegistroAnulacion(
  factura: Pick<FacturaApp, 'invoice_number' | 'date'>,
  emisor: EmisorApp,
  opciones: { refExterna?: string; sinRegistroPrevio?: 'S' | 'N'; rechazoPrevio?: 'S' | 'N' } = {}
): EntradaRegistroAnulacion {
  return {
    emisor: { nif: emisor.nif },
    numSerieFacturaAnulada: factura.invoice_number,
    fechaExpedicionFacturaAnulada: factura.date,
    refExterna: opciones.refExterna,
    sinRegistroPrevio: opciones.sinRegistroPrevio,
    rechazoPrevio: opciones.rechazoPrevio,
  }
}
