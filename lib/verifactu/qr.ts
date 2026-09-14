// QR tributario y leyenda VERI*FACTU (V08).
//
// Implementa las especificaciones oficiales de la AEAT «Detalle de las
// especificaciones técnicas del código "QR" de la factura y de la "URL" del
// servicio de cotejo o remisión de información por parte del receptor de la
// factura» v0.5.0 (10/12/2025, descargado de la sede AEAT) y los arts. 20-21
// de la Orden HAC/1177/2024 (SPEC.md §6):
//
//   - URL de cotejo con 4 parámetros obligatorios EN ESTE ORDEN:
//     nif, numserie, fecha (dd-mm-aaaa), importe (punto decimal).
//     Valores con «URL encoding» UTF-8; solo ASCII imprimible (32-126).
//   - QR ISO/IEC 18004:2015, corrección de errores nivel M, 30x30-40x40 mm,
//     zona en blanco ≥2 mm (recomendado 6 mm) alrededor.
//   - Texto «QR tributario:» SIEMPRE encima del QR; en sistemas VERI*FACTU,
//     justo debajo la frase «Factura verificable en la sede electrónica de la
//     AEAT» o «VERI*FACTU» (Kuentas usa ambas: frase larga + marca corta).
//   - El parámetro opcional `formato=json` NUNCA puede ir en la URL del QR.
//
// Módulo isomorfo: la construcción de la URL es pura; la generación del PNG
// usa `qrcode` (funciona en Node y en navegador).

import QRCode from 'qrcode'

import { formatearImporte } from './huella.ts'
import { esNifValido, fechaOficial } from './registro-alta.ts'

// ---------------------------------------------------------------------------
// Constantes oficiales
// ---------------------------------------------------------------------------

export type EntornoAeat = 'pruebas' | 'produccion'

/** URL base del servicio de cotejo para sistemas que emiten facturas VERIFICABLES (VERI*FACTU). */
export const URL_COTEJO_VERIFACTU: Readonly<Record<EntornoAeat, string>> = {
  pruebas: 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR',
  produccion: 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR',
}

/** URL base para sistemas que emiten facturas NO verificables (modo no-VERI*FACTU, V14). */
export const URL_COTEJO_NO_VERIFACTU: Readonly<Record<EntornoAeat, string>> = {
  pruebas: 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu',
  produccion: 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu',
}

/** Texto que SIEMPRE precede al QR en la factura (doc. QR §3). */
export const TITULO_QR = 'QR tributario:'

/** Leyenda VERI*FACTU (art. 20.1.b Orden HAC/1177/2024; decisión Kuentas: frase larga + marca). */
export const LEYENDA_VERIFACTU = 'Factura verificable en la sede electrónica de la AEAT'
export const MARCA_VERIFACTU = 'VERI*FACTU'

/** Tamaño de impresión del QR elegido por Kuentas: 35 mm (rango legal 30-40 mm, art. 21 Orden). */
export const QR_LADO_MM = 35
/** Equivalente en puntos PDF (1 mm = 72/25.4 pt) para @react-pdf/renderer. */
export const QR_LADO_PT = Math.round((QR_LADO_MM * 72) / 25.4) // 99 pt

// ---------------------------------------------------------------------------
// Construcción de la URL de cotejo
// ---------------------------------------------------------------------------

export interface DatosCotejo {
  /** NIF del obligado a expedir la factura (9 caracteres). */
  nif: string
  /** Serie+número EXACTO del registro de facturación (`NumSerieFactura`, ≤60 caracteres ASCII 32-126). */
  numSerie: string
  /** Fecha de expedición: `aaaa-mm-dd` (SQL), `dd-mm-aaaa` o Date. */
  fecha: string | Date
  /**
   * Importe total de la factura, IDÉNTICO al `ImporteTotal` del registro.
   * Si llega como string ya formateado (p. ej. leído del registro), se
   * respeta tal cual tras validar el patrón oficial (máx. 12 enteros + 2 dec.).
   */
  importe: number | string
}

export class ErrorQR extends Error {
  readonly errores: readonly string[]
  constructor(errores: readonly string[]) {
    super(`Datos del QR tributario no válidos: ${errores.join(' · ')}`)
    this.name = 'ErrorQR'
    this.errores = errores
  }
}

const IMPORTE_QR_REGEX = /^-?\d{1,12}(\.\d{1,2})?$/
const ASCII_IMPRIMIBLE_REGEX = /^[\x20-\x7e]*$/

function formatearImporteQR(importe: number | string, errores: string[]): string {
  if (typeof importe === 'string') {
    const v = importe.trim()
    if (!IMPORTE_QR_REGEX.test(v)) {
      errores.push(`importe: «${importe}» no cumple el formato oficial (máx. 12 enteros y 2 decimales, punto decimal)`)
      return ''
    }
    return v
  }
  try {
    const v = formatearImporte(importe)
    if (!IMPORTE_QR_REGEX.test(v)) {
      errores.push(`importe: ${v} excede los 12 dígitos enteros admitidos`)
      return ''
    }
    return v
  } catch (e) {
    errores.push(e instanceof Error ? e.message : String(e))
    return ''
  }
}

/**
 * Construye la URL del servicio de cotejo que va dentro del código QR
 * (doc. QR §§4-6): 4 parámetros obligatorios en orden fijo, valores
 * URL-encoded en UTF-8. Lanza ErrorQR si algún dato no es conforme.
 */
export function construirUrlCotejo(
  datos: DatosCotejo,
  entorno: EntornoAeat,
  opciones: { modalidad?: 'verifactu' | 'no_verifactu' } = {}
): string {
  const errores: string[] = []

  const nif = datos.nif?.trim().toUpperCase() ?? ''
  if (!esNifValido(nif)) errores.push(`nif: «${datos.nif}» no es un NIF válido`)

  const numSerie = datos.numSerie ?? ''
  if (numSerie.trim() === '') errores.push('numserie: obligatorio y vacío')
  if (numSerie.length > 60) errores.push(`numserie: supera los 60 caracteres (${numSerie.length})`)
  if (!ASCII_IMPRIMIBLE_REGEX.test(numSerie)) {
    errores.push('numserie: solo se admiten caracteres ASCII imprimibles (códigos 32-126)')
  }

  const fecha = fechaOficial(datos.fecha, 'fecha', errores)
  const importe = formatearImporteQR(datos.importe, errores)

  if (errores.length > 0) throw new ErrorQR(errores)

  const base =
    opciones.modalidad === 'no_verifactu'
      ? URL_COTEJO_NO_VERIFACTU[entorno]
      : URL_COTEJO_VERIFACTU[entorno]

  // Orden de parámetros FIJO según el doc. oficial: nif, numserie, fecha, importe.
  return (
    `${base}?nif=${encodeURIComponent(nif)}` +
    `&numserie=${encodeURIComponent(numSerie)}` +
    `&fecha=${encodeURIComponent(fecha)}` +
    `&importe=${encodeURIComponent(importe)}`
  )
}

/** Fila mínima de `sif_registros` (alta) con los 4 datos tasados del QR. */
export interface FilaRegistroQR {
  id_emisor_factura: string
  num_serie_factura: string
  fecha_expedicion: string
  importe_total: number | string
}

/** Datos de cotejo desde la fila persistida del registro de alta (fuente única de verdad). */
export function datosCotejoDesdeRegistro(fila: FilaRegistroQR): DatosCotejo {
  return {
    nif: fila.id_emisor_factura,
    numSerie: fila.num_serie_factura,
    fecha: fila.fecha_expedicion,
    importe: typeof fila.importe_total === 'string' ? Number(fila.importe_total) : fila.importe_total,
  }
}

// ---------------------------------------------------------------------------
// Generación del código QR (PNG)
// ---------------------------------------------------------------------------

/**
 * Genera el código QR de la URL de cotejo como data URL PNG.
 *
 * - Nivel de corrección de errores M (art. 21.1 Orden; doc. QR v0.4.1).
 * - `margin: 0`: la zona en blanco reglamentaria (≥2 mm) la aporta la propia
 *   maquetación de la factura (fondo blanco alrededor del QR), de modo que el
 *   símbolo impreso mide exactamente los mm del recuadro reservado (30-40 mm).
 * - 512 px de lado ≈ 372 ppp a 35 mm: «resolución apropiada» (art. 20.1 Orden).
 */
export async function generarQrPngDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 512,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

/** Bloque listo para las plantillas de PDF (server y cliente). */
export interface BloqueQRFactura {
  /** URL de cotejo embebida en el QR. */
  urlCotejo: string
  /** PNG del QR como data URL. */
  qrPngDataUrl: string
  /** Texto fijo sobre el QR («QR tributario:»). */
  titulo: string
  /** Leyenda bajo el QR; null en modo no-VERI*FACTU (QR sin leyenda). */
  leyenda: string | null
  /** Marca corta bajo la leyenda; null en modo no-VERI*FACTU. */
  marca: string | null
}

/** Construye el bloque QR+leyenda completo para el PDF a partir de los datos de cotejo. */
export async function construirBloqueQR(
  datos: DatosCotejo,
  entorno: EntornoAeat,
  opciones: { modalidad?: 'verifactu' | 'no_verifactu' } = {}
): Promise<BloqueQRFactura> {
  const urlCotejo = construirUrlCotejo(datos, entorno, opciones)
  const qrPngDataUrl = await generarQrPngDataUrl(urlCotejo)
  const esVerifactu = opciones.modalidad !== 'no_verifactu'
  return {
    urlCotejo,
    qrPngDataUrl,
    titulo: TITULO_QR,
    leyenda: esVerifactu ? LEYENDA_VERIFACTU : null,
    marca: esVerifactu ? MARCA_VERIFACTU : null,
  }
}
