// Adaptador: factura de cuentas-app (tabla `invoices` + perfil del emisor)
// → EntradaRegistroAlta del generador Verifactu (registro-alta.ts).
//
// La UI v1 maneja UN tipo de IVA por factura (iva_rate) y retención IRPF
// (auditoría V01, R7): el adaptador produce una única línea de desglose S1
// en régimen general, o la operación exenta con la causa guardada en la
// factura (`operacion_exenta`), y deja el modelo preparado para el desglose
// multi-tipo (el generador ya admite 12 líneas).
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
  ErrorValidacionRegistro,
} from './registro-alta.ts'
import { type EntradaRegistroAnulacion } from './registro-anulacion.ts'
import {
  claveRegimenParaExenta,
  esCausaExencionIva,
  esSimplificada,
  normalizarNif,
  situacionNifCliente,
} from './factura-fiscal.ts'

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
  /**
   * Causa de exención guardada con la factura (lista L10, E1-E6). Obligatoria
   * cuando iva_rate = 0: el 0 % de la app significa «exento», no «sujeto al 0 %».
   */
  operacion_exenta?: string | null
  /** Fecha de la operación si es distinta de `date` (art. 6.1.k RD 1619/2012); `aaaa-mm-dd`. */
  fecha_operacion?: string | null
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
   * Causa de exención E1-E8 (art. 20 LIVA → E1, exportación → E2…). Si no se
   * indica se usa la guardada en la factura (`operacion_exenta`). Exige
   * iva_rate = 0; y con iva_rate = 0 es obligatoria.
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
  const guardada = esCausaExencionIva(factura.operacion_exenta) ? factura.operacion_exenta : undefined
  const exenta: OperacionExenta | undefined = opciones.operacionExenta ?? guardada
  if (exenta && factura.iva_rate !== 0) {
    throw new ErrorValidacionRegistro([
      `Factura marcada exenta (${exenta}) pero iva_rate=${factura.iva_rate}: una operación exenta no puede repercutir IVA`,
    ])
  }
  if (!exenta && factura.iva_rate === 0) {
    // Antes se registraba como sujeta (S1) al tipo 0 %, sin causa de exención:
    // el registro no decía lo mismo que la factura. Ahora no se emite sin causa.
    throw new ErrorValidacionRegistro([
      'IVA al 0 % sin causa de exención: indica por qué artículo de la Ley del IVA está exenta la operación ' +
        '(operacion_exenta, claves E1 a E6). Kuentas no registra operaciones «sujetas al 0 %»',
    ])
  }

  const linea: LineaDesglose = exenta
    ? {
        impuesto: '01',
        // E2 y E3 no son admisibles con la clave 01 (doc. «Validaciones» AEAT §15.5).
        claveRegimen: esCausaExencionIva(exenta) ? claveRegimenParaExenta(exenta) : '01',
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
  } else if (situacionNifCliente(factura.client_nif) === 'valido') {
    destinatarios = [{ nombreRazon: factura.client_name ?? '', nif: normalizarNif(factura.client_nif) }]
  }

  const tipoFactura: TipoFactura = opciones.tipoFactura ?? (destinatarios ? 'F1' : 'F2')
  // En F2 y R5 el bloque Destinatarios no puede ir relleno (doc. «Validaciones» §13).
  if (esSimplificada(tipoFactura)) destinatarios = undefined

  return {
    emisor: { nif: emisor.nif, nombreRazon: emisor.nombreRazon },
    numSerieFactura: factura.invoice_number,
    fechaExpedicion: factura.date,
    fechaOperacion: factura.fecha_operacion ?? undefined,
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
