// Generador del XML del registro de facturación de ALTA (RegistroAlta) de
// Verifactu, a partir de una factura de cuentas-app.
//
// Fuente de la estructura: XSD oficial de la AEAT descargado en
// docs/verifactu/xsd/SuministroInformacion.xsd (elemento global
// `sf:RegistroAlta`, tipo `RegistroFacturacionAltaType`) y
// docs/verifactu/xsd/SuministroLR.xsd (envoltura `RegFactuSistemaFacturacion`).
// Base legal: arts. 9-10 RD 1007/2023 (RRSIF) y art. 10 + anexo de la Orden
// HAC/1177/2024. Diseño y citas: docs/verifactu/SPEC.md §2.
//
// Reglas de oro:
//  - El servidor RECALCULA CuotaTotal/ImporteTotal desde el desglose (D-07);
//    nunca se confía en importes del cliente.
//  - Los valores que entran en la huella son EXACTAMENTE los del XML (sin
//    escapar); la huella se calcula con lib/verifactu/huella.ts (V04).
//  - Server-only (usa node:crypto vía huella.ts). NO importar desde cliente.

import {
  type DatosHuellaAlta,
  type HuellaAnterior,
  TIPO_HUELLA_SHA256,
  esHuellaValida,
  fechaHoraHusoGenRegistro,
  formatearFechaExpedicion,
  formatearImporte,
  huellaAlta,
  cadenaEntradaAlta,
} from './huella.ts'

// ---------------------------------------------------------------------------
// Espacios de nombres oficiales (targetNamespace de los XSD descargados)
// ---------------------------------------------------------------------------

export const NS_SF =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd'
export const NS_SF_LR =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd'

/** Versión del esquema (`IDVersion`, lista VersionType del XSD). */
export const ID_VERSION = '1.0'

// ---------------------------------------------------------------------------
// Listas oficiales del XSD (SuministroInformacion.xsd)
// ---------------------------------------------------------------------------

export type TipoFactura = 'F1' | 'F2' | 'F3' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
export type TipoRectificativa = 'S' | 'I'
export type Impuesto = '01' | '02' | '03' | '05'
/** L8A vigente del XSD (IdOperacionesTrascendenciaTributariaType): 01-11, 14, 15, 17-21. */
export type ClaveRegimen =
  | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10'
  | '11' | '14' | '15' | '17' | '18' | '19' | '20' | '21'
export type CalificacionOperacion = 'S1' | 'S2' | 'N1' | 'N2'
/** El XSD vigente admite E1-E8 (el anexo de la Orden publicó E1-E6; E7/E8 se añadieron después). */
export type OperacionExenta = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7' | 'E8'
/** L7 sin el valor 01 (para ES debe usarse NIF, nota del propio XSD). */
export type IdTypeDestinatario = '02' | '03' | '04' | '05' | '06' | '07'

const TIPOS_FACTURA: readonly TipoFactura[] = ['F1', 'F2', 'F3', 'R1', 'R2', 'R3', 'R4', 'R5']
const CLAVES_REGIMEN: readonly ClaveRegimen[] = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '14', '15', '17', '18', '19', '20', '21',
]
const OPERACIONES_EXENTAS: readonly OperacionExenta[] = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8']
const CALIFICACIONES: readonly CalificacionOperacion[] = ['S1', 'S2', 'N1', 'N2']
const ID_TYPES: readonly IdTypeDestinatario[] = ['02', '03', '04', '05', '06', '07']

/** Códigos de país admitidos (CountryType2 del XSD, extraídos literalmente). */
export const CODIGOS_PAIS: ReadonlySet<string> = new Set([
  'AF', 'AL', 'DE', 'AD', 'AO', 'AI', 'AQ', 'AG', 'SA', 'DZ', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ',
  'BS', 'BH', 'BD', 'BB', 'BE', 'BZ', 'BJ', 'BM', 'BY', 'BO', 'BA', 'BW', 'BV', 'BR', 'BN', 'BG',
  'BF', 'BI', 'BT', 'CV', 'KY', 'KH', 'CM', 'CA', 'CF', 'CC', 'CO', 'KM', 'CG', 'CD', 'CK', 'KP',
  'KR', 'CI', 'CR', 'HR', 'CU', 'TD', 'CZ', 'CL', 'CN', 'CY', 'CW', 'DK', 'DM', 'DO', 'EC', 'EG',
  'AE', 'ER', 'SK', 'SI', 'ES', 'US', 'EE', 'ET', 'FO', 'PH', 'FI', 'FJ', 'FR', 'GA', 'GM', 'GE',
  'GS', 'GH', 'GI', 'GD', 'GR', 'GL', 'GU', 'GT', 'GG', 'GN', 'GQ', 'GW', 'GY', 'HT', 'HM', 'HN',
  'HK', 'HU', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IS', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ',
  'KE', 'KG', 'KI', 'KW', 'LA', 'LS', 'LV', 'LB', 'LR', 'LY', 'LI', 'LT', 'LU', 'XG', 'MO', 'MK',
  'MG', 'MY', 'MW', 'MV', 'ML', 'MT', 'FK', 'MP', 'MA', 'MH', 'MU', 'MR', 'YT', 'UM', 'MX', 'FM',
  'MD', 'MC', 'MN', 'ME', 'MS', 'MZ', 'MM', 'NA', 'NR', 'CX', 'NP', 'NI', 'NE', 'NG', 'NU', 'NF',
  'NO', 'NC', 'NZ', 'IO', 'OM', 'NL', 'BQ', 'PK', 'PW', 'PA', 'PG', 'PY', 'PE', 'PN', 'PF', 'PL',
  'PT', 'PR', 'QA', 'GB', 'RW', 'RO', 'RU', 'RE', 'SB', 'SV', 'WS', 'AS', 'KN', 'SM', 'SX', 'PM',
  'VC', 'SH', 'LC', 'ST', 'SN', 'RS', 'SC', 'SL', 'SG', 'SY', 'SO', 'LK', 'SZ', 'ZA', 'SD', 'SS',
  'SE', 'CH', 'SR', 'TH', 'TW', 'TZ', 'TJ', 'PS', 'TF', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TC',
  'TM', 'TR', 'TV', 'UA', 'UG', 'UY', 'UZ', 'VU', 'VA', 'VE', 'VN', 'VG', 'VI', 'WF', 'YE', 'DJ',
  'ZM', 'ZW', 'QU', 'XB', 'XU', 'XN',
])

// ---------------------------------------------------------------------------
// Tipos de entrada (dominio cuentas-app → registro de alta)
// ---------------------------------------------------------------------------

/** Destinatario español identificado por NIF (PersonaFisicaJuridicaType con NIF). */
export interface DestinatarioNIF {
  nombreRazon: string
  nif: string
}

/** Destinatario UE/extranjero (PersonaFisicaJuridicaType con IDOtro). */
export interface DestinatarioIDOtro {
  nombreRazon: string
  /** ISO-3166 alpha-2 (lista CountryType2). Opcional en el XSD; obligatorio salvo IDType 02. */
  codigoPais?: string
  /** 02 NIF-IVA · 03 pasaporte · 04 doc. país residencia · 05 cert. residencia · 06 otro · 07 no censado. */
  idType: IdTypeDestinatario
  id: string
}

export type Destinatario = DestinatarioNIF | DestinatarioIDOtro

export function esDestinatarioNIF(d: Destinatario): d is DestinatarioNIF {
  return (d as DestinatarioNIF).nif !== undefined
}

/** Línea de desglose por tipo impositivo (DetalleType del XSD; SPEC §2.2). Importes en euros. */
export interface LineaDesglose {
  /** Defecto '01' (IVA). */
  impuesto?: Impuesto
  /** Obligatoria si impuesto 01/03; prohibida si 02/05 (doc. validaciones AEAT). */
  claveRegimen?: ClaveRegimen
  /** Excluyente con operacionExenta: exactamente una de las dos. */
  calificacionOperacion?: CalificacionOperacion
  operacionExenta?: OperacionExenta
  /** % (p. ej. 21). Obligatorio con S1; prohibido con exenta/no sujeta. */
  tipoImpositivo?: number
  /** Base imponible o importe no sujeto. Puede ser negativa (rectificativas por diferencias). */
  baseImponible: number
  /** Obligatoria con S1 (se valida contra base×tipo con tolerancia ±10 €). */
  cuotaRepercutida?: number
  /** Solo régimen 18 (recargo de equivalencia); van juntos tipo y cuota. */
  tipoRecargoEquivalencia?: number
  cuotaRecargoEquivalencia?: number
}

/** Identificación de una factura rectificada o sustituida (IDFacturaARType). */
export interface FacturaRelacionada {
  /** Si se omite, se usa el NIF del emisor del registro (nota del XSD). */
  idEmisorFactura?: string
  numSerieFactura: string
  /** `aaaa-mm-dd`, `dd-mm-aaaa` o Date. */
  fechaExpedicion: string | Date
}

/** Bloque ImporteRectificacion (solo rectificativas por sustitución, S). */
export interface ImporteRectificacion {
  baseRectificada: number
  cuotaRectificada: number
  cuotaRecargoRectificado?: number
}

/** Bloque SistemaInformatico (art. 10.1.l RRSIF; SPEC §2.4). */
export interface SistemaInformatico {
  nombreRazon: string
  nif: string
  nombreSistemaInformatico: string
  idSistemaInformatico: string
  version: string
  numeroInstalacion: string
  tipoUsoPosibleSoloVerifactu: 'S' | 'N'
  tipoUsoPosibleMultiOT: 'S' | 'N'
  indicadorMultiplesOT: 'S' | 'N'
}

/**
 * Identificación del SIF Kuentas (datos del productor, SPEC §2.4). El
 * `IdSistemaInformatico` propuesto es `01` [REVISIÓN IVAN: debe coincidir con
 * la declaración responsable de V19]. `numeroInstalacion` es por tenant.
 */
export function sistemaInformaticoKuentas(numeroInstalacion: string): SistemaInformatico {
  return {
    nombreRazon: 'Mercadonet Global S.L.',
    nif: 'B98407901',
    nombreSistemaInformatico: 'Kuentas',
    idSistemaInformatico: '01',
    version: '1.0.0',
    numeroInstalacion,
    tipoUsoPosibleSoloVerifactu: 'S',
    tipoUsoPosibleMultiOT: 'S',
    indicadorMultiplesOT: 'S',
  }
}

/** Encadenamiento (art. 7 Orden): primer registro de la cadena o puntero al anterior. */
export type Encadenamiento =
  | { primerRegistro: true }
  | {
      registroAnterior: {
        idEmisorFactura: string
        numSerieFactura: string
        /** `aaaa-mm-dd`, `dd-mm-aaaa` o Date. */
        fechaExpedicion: string | Date
        huella: string
      }
    }

/** Entrada del generador: la factura ya normalizada a dominio Verifactu. */
export interface EntradaRegistroAlta {
  emisor: { nif: string; nombreRazon: string }
  /** Serie+número en un solo campo (≤60 ASCII visible, sin espacios en extremos). */
  numSerieFactura: string
  /** `aaaa-mm-dd`, `dd-mm-aaaa` o Date. */
  fechaExpedicion: string | Date
  tipoFactura: TipoFactura
  /** Obligatorio si tipoFactura R1-R5; prohibido en F1-F3. */
  tipoRectificativa?: TipoRectificativa
  /** Solo R1-R5. */
  facturasRectificadas?: FacturaRelacionada[]
  /** Solo F3. */
  facturasSustituidas?: FacturaRelacionada[]
  /** Solo rectificativa por sustitución (tipoRectificativa 'S'). */
  importeRectificacion?: ImporteRectificacion
  /** Solo si difiere de la fecha de expedición. */
  fechaOperacion?: string | Date
  descripcionOperacion: string
  /** `S` si simplificada de los arts. 7.2/7.3 RD 1619/2012. */
  facturaSimplificadaArt7273?: 'S' | 'N'
  /** `S` si completa sin identificación del destinatario (art. 6.1.d RD 1619/2012). */
  facturaSinIdentifDestinatarioArt61d?: 'S' | 'N'
  /** Obligatorios salvo F2/R5 o factura sin identificación art. 6.1.d. */
  destinatarios?: Destinatario[]
  desglose: LineaDesglose[]
  /** Referencia interna opcional (RefExterna, ≤60). */
  refExterna?: string
  /** `S` = reenvío que subsana un registro previo aceptado con errores (SPEC §5.4). */
  subsanacion?: 'S' | 'N'
  /** Solo admisible junto a subsanacion='S' (doc. validaciones AEAT). */
  rechazoPrevio?: 'N' | 'S' | 'X'
  /**
   * Cross-check opcional (riesgo R3 de V01): si la app traía totales, se
   * comparan con los recalculados (tolerancia 1 céntimo) y se rechaza si difieren.
   */
  cuotaTotalDeclarada?: number
  importeTotalDeclarado?: number
}

export interface OpcionesRegistroAlta {
  encadenamiento: Encadenamiento
  sistemaInformatico: SistemaInformatico
  /** Momento de generación del registro; por defecto `new Date()` (huso Europe/Madrid). */
  fechaGeneracion?: Date
}

/** Resultado: XML + huella + los datos que persisten en sif_registros/sif_cadena. */
export interface RegistroAltaGenerado {
  /** Fragmento `<sf:RegistroAlta>` autónomo (xmlns declarado), listo para envolver en RegFactuSistemaFacturacion. */
  xml: string
  huella: string
  huellaAnterior: HuellaAnterior
  /** Cadena de entrada de la huella (auditoría/depuración). */
  cadenaHuella: string
  datosHuella: DatosHuellaAlta
  idEmisorFactura: string
  numSerieFactura: string
  /** `dd-mm-aaaa` tal como va en el XML. */
  fechaExpedicionFactura: string
  tipoFactura: TipoFactura
  /** Recalculados en servidor, formato oficial (punto, 2 decimales). */
  cuotaTotal: string
  importeTotal: string
  fechaHoraHusoGenRegistro: string
  tipoHuella: string
  primerRegistro: boolean
}

// ---------------------------------------------------------------------------
// Errores de validación
// ---------------------------------------------------------------------------

/** Agrupa TODOS los problemas de la factura (no se detiene en el primero). */
export class ErrorValidacionRegistro extends Error {
  readonly errores: readonly string[]
  constructor(errores: readonly string[]) {
    super(`Registro de alta inválido (${errores.length} error(es)):\n - ${errores.join('\n - ')}`)
    this.name = 'ErrorValidacionRegistro'
    this.errores = errores
  }
}

// ---------------------------------------------------------------------------
// Validadores de identificadores y formatos
// ---------------------------------------------------------------------------

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

/**
 * Validación de NIF español con dígito de control (D-09): DNI, NIE, K/L/M y
 * CIF de entidad (letra inicial + 7 dígitos + control dígito/letra según tipo).
 */
export function esNifValido(nif: string): boolean {
  const v = nif.trim().toUpperCase()
  if (!/^[A-Z0-9]{9}$/.test(v)) return false

  // DNI: 8 dígitos + letra de control.
  if (/^\d{8}[A-Z]$/.test(v)) {
    return v[8] === LETRAS_DNI[Number(v.slice(0, 8)) % 23]
  }
  // NIE: X/Y/Z + 7 dígitos + letra (X→0, Y→1, Z→2).
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const num = Number(String('XYZ'.indexOf(v[0])) + v.slice(1, 8))
    return v[8] === LETRAS_DNI[num % 23]
  }
  // K (menores 14 años), L (no residentes), M (extranjeros sin NIE): letra + 7 dígitos + control.
  if (/^[KLM]\d{7}[A-Z]$/.test(v)) {
    return v[8] === LETRAS_DNI[Number(v.slice(1, 8)) % 23]
  }
  // CIF de entidad: letra de tipo + 7 dígitos + control.
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    const digitos = v.slice(1, 8)
    let suma = 0
    for (let i = 0; i < 7; i++) {
      const d = Number(digitos[i])
      if (i % 2 === 0) {
        const doble = d * 2
        suma += doble > 9 ? doble - 9 : doble
      } else {
        suma += d
      }
    }
    const digitoControl = (10 - (suma % 10)) % 10
    const letraControl = 'JABCDEFGHI'[digitoControl]
    // P, Q, R, S, W y N: control alfabético. A, B, E, H: numérico. Resto: ambos válidos.
    if ('PQRSWN'.includes(v[0])) return v[8] === letraControl
    if ('ABEH'.includes(v[0])) return v[8] === String(digitoControl)
    return v[8] === String(digitoControl) || v[8] === letraControl
  }
  return false
}

/** `dd-mm-aaaa` oficial desde `aaaa-mm-dd`, `dd-mm-aaaa` o Date, validando el calendario. */
export function fechaOficial(valor: string | Date, campo: string, errores: string[]): string {
  let ddmmaaaa: string
  try {
    if (typeof valor === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(valor.trim())) {
      ddmmaaaa = valor.trim()
    } else {
      ddmmaaaa = formatearFechaExpedicion(valor)
    }
  } catch {
    errores.push(`${campo}: fecha no reconocida «${String(valor)}» (se espera aaaa-mm-dd, dd-mm-aaaa o Date)`)
    return ''
  }
  const [dd, mm, aaaa] = ddmmaaaa.split('-').map(Number)
  const fecha = new Date(Date.UTC(aaaa, mm - 1, dd))
  if (
    fecha.getUTCFullYear() !== aaaa ||
    fecha.getUTCMonth() !== mm - 1 ||
    fecha.getUTCDate() !== dd
  ) {
    errores.push(`${campo}: fecha inexistente en el calendario «${ddmmaaaa}»`)
    return ''
  }
  return ddmmaaaa
}

/** Importe en céntimos (entero) para sumar sin errores de coma flotante. */
function aCentimos(valor: number): number {
  return Math.round((valor + Math.sign(valor) * Number.EPSILON) * 100)
}

function importeDesdeCentimos(centimos: number): string {
  return formatearImporte(centimos / 100)
}

/** Patrón ImporteSgn12.2Type del XSD: hasta 12 enteros y 2 decimales, con signo. */
function validarImporte(valor: number, campo: string, errores: string[]): void {
  if (!Number.isFinite(valor)) {
    errores.push(`${campo}: importe no numérico`)
    return
  }
  if (Math.abs(valor) >= 1e12) {
    errores.push(`${campo}: excede los 12 dígitos enteros admitidos por el XSD`)
  }
}

/** Tipo porcentual (Tipo2.2Type): 0-999.99 sin signo, 2 decimales. */
function formatearTipo(valor: number): string {
  return formatearImporte(valor)
}

// V24: caracteres de control prohibidos en XML 1.0 (escaparXml no puede
// representarlos y la AEAT rechazaría el LOTE entero, no solo este registro).
const RE_CONTROL_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/

export function validarTexto(
  valor: string,
  campo: string,
  max: number,
  errores: string[],
  { obligatorio = true }: { obligatorio?: boolean } = {}
): void {
  const v = valor ?? ''
  if (obligatorio && v.trim() === '') errores.push(`${campo}: obligatorio y vacío`)
  if (v.length > max) errores.push(`${campo}: supera los ${max} caracteres (${v.length})`)
  if (RE_CONTROL_XML.test(v)) errores.push(`${campo}: contiene caracteres de control no válidos`)
}

// ---------------------------------------------------------------------------
// Serialización XML
// ---------------------------------------------------------------------------

export function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Árbol mínimo: [nombreSinPrefijo, hijos | valorTexto]. `null` = omitir elemento. */
export type Nodo = [string, NodoContenido] | null
export type NodoContenido = string | Nodo[]

export function serializar(nodos: Nodo[], prefijo: string, nivel: number): string {
  const sangria = '  '.repeat(nivel)
  return nodos
    .filter((n): n is [string, NodoContenido] => n !== null)
    .map(([nombre, contenido]) => {
      const etiqueta = `${prefijo}:${nombre}`
      if (typeof contenido === 'string') {
        return `${sangria}<${etiqueta}>${escaparXml(contenido)}</${etiqueta}>`
      }
      return `${sangria}<${etiqueta}>\n${serializar(contenido, prefijo, nivel + 1)}\n${sangria}</${etiqueta}>`
    })
    .join('\n')
}

// ---------------------------------------------------------------------------
// Generador principal
// ---------------------------------------------------------------------------

/** Tolerancia oficial por línea entre cuota declarada y base×tipo (doc. validaciones AEAT). */
const TOLERANCIA_CUOTA_CENT = 1000 // ±10,00 €
/** Tolerancia del cross-check con los totales que declara la app (D-07). */
const TOLERANCIA_TOTALES_CENT = 1 // ±0,01 €

/** Umbral de Macrodato: importe total ≥ 100.000.000 € (doc. validaciones AEAT). */
const UMBRAL_MACRODATO_CENT = 100_000_000_00

/**
 * Construye el registro de alta completo: valida la factura, recalcula los
 * totales en servidor, serializa el XML oficial (`sf:RegistroAlta`) y calcula
 * la huella encadenada. Lanza `ErrorValidacionRegistro` con TODOS los
 * problemas si la factura no es conforme.
 */
export function construirRegistroAlta(
  entrada: EntradaRegistroAlta,
  opciones: OpcionesRegistroAlta
): RegistroAltaGenerado {
  const errores: string[] = []
  const e = entrada

  // --- Emisor ---------------------------------------------------------------
  const nifEmisor = (e.emisor?.nif ?? '').trim().toUpperCase()
  if (!esNifValido(nifEmisor)) {
    errores.push(`emisor.nif: NIF español inválido «${e.emisor?.nif ?? ''}» (formato o dígito de control)`)
  }
  validarTexto(e.emisor?.nombreRazon ?? '', 'emisor.nombreRazon', 120, errores)

  // --- Identificación de la factura ----------------------------------------
  const numSerie = e.numSerieFactura ?? ''
  if (numSerie !== numSerie.trim()) {
    // El algoritmo de huella hace trim de los valores: espacios en los extremos
    // provocarían discrepancia entre XML y huella en la validación AEAT.
    errores.push('numSerieFactura: no puede empezar ni terminar en espacios')
  }
  if (!/^[\x20-\x7E]{1,60}$/.test(numSerie)) {
    errores.push(`numSerieFactura: debe ser ASCII visible de 1 a 60 caracteres («${numSerie}»)`)
  }
  const fechaExp = fechaOficial(e.fechaExpedicion, 'fechaExpedicion', errores)

  // --- Tipo de factura y rectificativas -------------------------------------
  if (!TIPOS_FACTURA.includes(e.tipoFactura)) {
    errores.push(`tipoFactura: valor «${e.tipoFactura}» fuera de la lista L2 (F1-F3, R1-R5)`)
  }
  const esRectificativa = String(e.tipoFactura).startsWith('R')
  if (esRectificativa && !e.tipoRectificativa) {
    errores.push('tipoRectificativa: obligatorio en facturas R1-R5 (S sustitución / I diferencias)')
  }
  if (!esRectificativa && e.tipoRectificativa) {
    errores.push('tipoRectificativa: solo admisible en facturas rectificativas (R1-R5)')
  }
  if (e.tipoRectificativa && !['S', 'I'].includes(e.tipoRectificativa)) {
    errores.push(`tipoRectificativa: valor «${e.tipoRectificativa}» inválido (S/I)`)
  }
  if (e.facturasRectificadas?.length && !esRectificativa) {
    errores.push('facturasRectificadas: solo admisible en facturas rectificativas (R1-R5)')
  }
  if (e.facturasSustituidas?.length && e.tipoFactura !== 'F3') {
    errores.push('facturasSustituidas: solo admisible en facturas F3')
  }
  if (e.importeRectificacion && e.tipoRectificativa !== 'S') {
    errores.push('importeRectificacion: solo admisible en rectificativas por sustitución (tipoRectificativa=S)')
  }
  if ((e.facturasRectificadas?.length ?? 0) > 1000) {
    errores.push('facturasRectificadas: máximo 1000 facturas por registro')
  }
  if ((e.facturasSustituidas?.length ?? 0) > 1000) {
    errores.push('facturasSustituidas: máximo 1000 facturas por registro')
  }

  const facturaRelacionada = (f: FacturaRelacionada, campo: string): Nodo[] => {
    const nifRel = (f.idEmisorFactura ?? nifEmisor).trim().toUpperCase()
    if (!esNifValido(nifRel)) errores.push(`${campo}.idEmisorFactura: NIF inválido «${nifRel}»`)
    if (!/^[\x20-\x7E]{1,60}$/.test(f.numSerieFactura ?? '')) {
      errores.push(`${campo}.numSerieFactura: debe ser ASCII visible de 1 a 60 caracteres`)
    }
    return [
      ['IDEmisorFactura', nifRel],
      ['NumSerieFactura', f.numSerieFactura],
      ['FechaExpedicionFactura', fechaOficial(f.fechaExpedicion, `${campo}.fechaExpedicion`, errores)],
    ]
  }

  // --- Subsanación / rechazo previo -----------------------------------------
  if (e.subsanacion && !['S', 'N'].includes(e.subsanacion)) {
    errores.push(`subsanacion: valor «${e.subsanacion}» inválido (S/N)`)
  }
  if (e.rechazoPrevio) {
    if (!['N', 'S', 'X'].includes(e.rechazoPrevio)) {
      errores.push(`rechazoPrevio: valor «${e.rechazoPrevio}» inválido (N/S/X)`)
    }
    if (e.subsanacion !== 'S') {
      errores.push('rechazoPrevio: solo admisible junto a subsanacion=S (doc. validaciones AEAT)')
    }
  }

  // --- Fechas y descripción --------------------------------------------------
  const fechaOper = e.fechaOperacion ? fechaOficial(e.fechaOperacion, 'fechaOperacion', errores) : null
  validarTexto(e.descripcionOperacion ?? '', 'descripcionOperacion', 500, errores)

  // --- Destinatarios ----------------------------------------------------------
  const destinatarios = e.destinatarios ?? []
  const sinDestinatarioPermitido =
    e.tipoFactura === 'F2' || e.tipoFactura === 'R5' || e.facturaSinIdentifDestinatarioArt61d === 'S'
  if (destinatarios.length === 0 && !sinDestinatarioPermitido) {
    errores.push(
      `destinatarios: obligatorios en facturas ${e.tipoFactura} (solo F2/R5 o art. 6.1.d pueden omitirlos)`
    )
  }
  if (destinatarios.length > 1000) errores.push('destinatarios: máximo 1000 por registro')
  const nodosDestinatarios: Nodo[] = destinatarios.map((d, i) => {
    const campo = `destinatarios[${i}]`
    validarTexto(d.nombreRazon ?? '', `${campo}.nombreRazon`, 120, errores)
    if (esDestinatarioNIF(d)) {
      const nif = d.nif.trim().toUpperCase()
      if (!esNifValido(nif)) {
        errores.push(`${campo}.nif: NIF español inválido «${d.nif}» (para extranjeros use IDOtro)`)
      }
      return ['IDDestinatario', [['NombreRazon', d.nombreRazon], ['NIF', nif]]]
    }
    if (!ID_TYPES.includes(d.idType)) {
      errores.push(`${campo}.idType: valor «${d.idType}» fuera de la lista L7 (02-07)`)
    }
    const pais = d.codigoPais?.trim().toUpperCase()
    if (pais && !CODIGOS_PAIS.has(pais)) {
      errores.push(`${campo}.codigoPais: código «${d.codigoPais}» fuera de la lista CountryType2 del XSD`)
    }
    if (!pais && d.idType !== '02') {
      errores.push(`${campo}.codigoPais: obligatorio salvo con idType=02 (NIF-IVA, que ya incluye el país)`)
    }
    if (pais === 'ES' && d.idType !== '07') {
      errores.push(`${campo}: para España use el campo NIF (IDOtro con ES solo se admite idType=07 «no censado»)`)
    }
    validarTexto(d.id ?? '', `${campo}.id`, 20, errores)
    return [
      'IDDestinatario',
      [
        ['NombreRazon', d.nombreRazon],
        ['IDOtro', [
          pais ? ['CodigoPais', pais] : null,
          ['IDType', d.idType],
          ['ID', (d.id ?? '').trim()],
        ]],
      ],
    ]
  })

  // --- Desglose (1-12 líneas) y totales recalculados --------------------------
  if (!e.desglose || e.desglose.length === 0) {
    errores.push('desglose: obligatorio (mínimo 1 línea)')
  }
  if ((e.desglose?.length ?? 0) > 12) {
    errores.push(`desglose: máximo 12 líneas DetalleDesglose (hay ${e.desglose.length})`)
  }
  let cuotaTotalCent = 0
  let importeTotalCent = 0
  const nodosDesglose: Nodo[] = (e.desglose ?? []).slice(0, 12).map((linea, i) => {
    const campo = `desglose[${i}]`
    const impuesto = linea.impuesto ?? '01'
    if (!['01', '02', '03', '05'].includes(impuesto)) {
      errores.push(`${campo}.impuesto: valor «${impuesto}» fuera de la lista L1`)
    }
    const requiereClave = impuesto === '01' || impuesto === '03'
    if (requiereClave && !linea.claveRegimen) {
      errores.push(`${campo}.claveRegimen: obligatoria cuando el impuesto es IVA (01) o IGIC (03)`)
    }
    if (!requiereClave && linea.claveRegimen) {
      errores.push(`${campo}.claveRegimen: no admisible con impuesto ${impuesto} (solo 01/03)`)
    }
    if (linea.claveRegimen && !CLAVES_REGIMEN.includes(linea.claveRegimen)) {
      errores.push(`${campo}.claveRegimen: valor «${linea.claveRegimen}» fuera de la lista L8A del XSD`)
    }

    const tieneCalificacion = linea.calificacionOperacion !== undefined
    const tieneExenta = linea.operacionExenta !== undefined
    if (tieneCalificacion === tieneExenta) {
      errores.push(`${campo}: debe llevar exactamente una de calificacionOperacion u operacionExenta`)
    }
    if (tieneCalificacion && !CALIFICACIONES.includes(linea.calificacionOperacion!)) {
      errores.push(`${campo}.calificacionOperacion: valor «${linea.calificacionOperacion}» inválido (S1/S2/N1/N2)`)
    }
    if (tieneExenta && !OPERACIONES_EXENTAS.includes(linea.operacionExenta!)) {
      errores.push(`${campo}.operacionExenta: valor «${linea.operacionExenta}» inválido (E1-E8)`)
    }

    validarImporte(linea.baseImponible, `${campo}.baseImponible`, errores)
    const baseCent = Number.isFinite(linea.baseImponible) ? aCentimos(linea.baseImponible) : 0
    let cuotaCent = 0
    let recargoCent = 0

    const esS1 = linea.calificacionOperacion === 'S1'
    if (esS1) {
      if (linea.tipoImpositivo === undefined) {
        errores.push(`${campo}.tipoImpositivo: obligatorio en operaciones S1`)
      } else if (!Number.isFinite(linea.tipoImpositivo) || linea.tipoImpositivo < 0 || linea.tipoImpositivo > 100) {
        errores.push(`${campo}.tipoImpositivo: porcentaje inválido «${linea.tipoImpositivo}»`)
      }
      if (linea.cuotaRepercutida === undefined) {
        errores.push(`${campo}.cuotaRepercutida: obligatoria en operaciones S1`)
      } else {
        validarImporte(linea.cuotaRepercutida, `${campo}.cuotaRepercutida`, errores)
        cuotaCent = aCentimos(linea.cuotaRepercutida)
        if (Number.isFinite(linea.tipoImpositivo)) {
          const esperadaCent = Math.round((baseCent * (linea.tipoImpositivo as number)) / 100)
          if (Math.abs(cuotaCent - esperadaCent) > TOLERANCIA_CUOTA_CENT) {
            errores.push(
              `${campo}.cuotaRepercutida: ${importeDesdeCentimos(cuotaCent)} no cuadra con base×tipo (${importeDesdeCentimos(esperadaCent)}) más allá de la tolerancia de ±10,00 €`
            )
          }
          if (baseCent !== 0 && cuotaCent !== 0 && Math.sign(cuotaCent) !== Math.sign(baseCent)) {
            errores.push(`${campo}.cuotaRepercutida: el signo debe coincidir con el de la base`)
          }
        }
      }
    } else {
      // S2 (inversión del sujeto pasivo), N1/N2 y exentas: sin tipo ni cuota
      // (en S2 la AEAT los admite solo a cero; Kuentas no los emite).
      if (linea.tipoImpositivo !== undefined && linea.tipoImpositivo !== 0) {
        errores.push(`${campo}.tipoImpositivo: no admisible fuera de operaciones S1`)
      }
      if (linea.cuotaRepercutida !== undefined && linea.cuotaRepercutida !== 0) {
        errores.push(`${campo}.cuotaRepercutida: no admisible fuera de operaciones S1`)
      }
    }

    const tieneRecargo =
      linea.tipoRecargoEquivalencia !== undefined || linea.cuotaRecargoEquivalencia !== undefined
    if (tieneRecargo) {
      if (linea.claveRegimen !== '18' || !esS1) {
        errores.push(`${campo}: el recargo de equivalencia exige claveRegimen=18 y operación S1`)
      }
      if (linea.tipoRecargoEquivalencia === undefined || linea.cuotaRecargoEquivalencia === undefined) {
        errores.push(`${campo}: tipoRecargoEquivalencia y cuotaRecargoEquivalencia deben ir juntos`)
      } else {
        validarImporte(linea.cuotaRecargoEquivalencia, `${campo}.cuotaRecargoEquivalencia`, errores)
        recargoCent = aCentimos(linea.cuotaRecargoEquivalencia)
        const esperadoCent = Math.round((baseCent * linea.tipoRecargoEquivalencia) / 100)
        if (Math.abs(recargoCent - esperadoCent) > TOLERANCIA_CUOTA_CENT) {
          errores.push(
            `${campo}.cuotaRecargoEquivalencia: no cuadra con base×tipoRecargo más allá de ±10,00 €`
          )
        }
      }
    }

    cuotaTotalCent += cuotaCent + recargoCent
    importeTotalCent += baseCent + cuotaCent + recargoCent

    return [
      'DetalleDesglose',
      [
        ['Impuesto', impuesto],
        linea.claveRegimen ? ['ClaveRegimen', linea.claveRegimen] : null,
        tieneCalificacion && !tieneExenta
          ? ['CalificacionOperacion', linea.calificacionOperacion as string]
          : null,
        tieneExenta && !tieneCalificacion ? ['OperacionExenta', linea.operacionExenta as string] : null,
        esS1 && linea.tipoImpositivo !== undefined
          ? ['TipoImpositivo', formatearTipo(linea.tipoImpositivo)]
          : null,
        ['BaseImponibleOimporteNoSujeto', formatearImporte(Number.isFinite(linea.baseImponible) ? linea.baseImponible : 0)],
        esS1 && linea.cuotaRepercutida !== undefined
          ? ['CuotaRepercutida', importeDesdeCentimos(cuotaCent)]
          : null,
        tieneRecargo && linea.tipoRecargoEquivalencia !== undefined
          ? ['TipoRecargoEquivalencia', formatearTipo(linea.tipoRecargoEquivalencia)]
          : null,
        tieneRecargo && linea.cuotaRecargoEquivalencia !== undefined
          ? ['CuotaRecargoEquivalencia', importeDesdeCentimos(recargoCent)]
          : null,
      ],
    ]
  })

  // Nota normativa (criterio AEAT/SII): ImporteTotal = Σ bases + cuotas +
  // recargos. Las retenciones IRPF NO minoran el ImporteTotal del registro
  // (el «total a pagar» con retención es un dato de la factura, no del registro).
  if (Math.abs(importeTotalCent) >= 1e14) {
    errores.push('importeTotal: excede los 12 dígitos enteros admitidos por el XSD')
  }
  if (
    e.cuotaTotalDeclarada !== undefined &&
    Math.abs(aCentimos(e.cuotaTotalDeclarada) - cuotaTotalCent) > TOLERANCIA_TOTALES_CENT
  ) {
    errores.push(
      `cuotaTotalDeclarada (${formatearImporte(e.cuotaTotalDeclarada)}) no coincide con la recalculada en servidor (${importeDesdeCentimos(cuotaTotalCent)})`
    )
  }
  if (
    e.importeTotalDeclarado !== undefined &&
    Math.abs(aCentimos(e.importeTotalDeclarado) - importeTotalCent) > TOLERANCIA_TOTALES_CENT
  ) {
    errores.push(
      `importeTotalDeclarado (${formatearImporte(e.importeTotalDeclarado)}) no coincide con el recalculado en servidor (${importeDesdeCentimos(importeTotalCent)}); recuerde que la retención IRPF no minora el ImporteTotal del registro`
    )
  }

  // --- Encadenamiento ----------------------------------------------------------
  const enc = opciones.encadenamiento
  const esPrimero = 'primerRegistro' in enc
  let huellaAnterior: HuellaAnterior = null
  let nodoEncadenamiento: Nodo
  if (esPrimero) {
    nodoEncadenamiento = ['Encadenamiento', [['PrimerRegistro', 'S']]]
  } else {
    const ra = enc.registroAnterior
    if (!esHuellaValida(ra.huella ?? '')) {
      errores.push('encadenamiento.registroAnterior.huella: debe ser 64 hexadecimales en mayúsculas')
    }
    const nifAnt = (ra.idEmisorFactura ?? '').trim().toUpperCase()
    if (!/^[A-Z0-9]{9}$/.test(nifAnt)) {
      errores.push('encadenamiento.registroAnterior.idEmisorFactura: NIF de 9 caracteres obligatorio')
    }
    huellaAnterior = ra.huella
    nodoEncadenamiento = [
      'Encadenamiento',
      [
        [
          'RegistroAnterior',
          [
            ['IDEmisorFactura', nifAnt],
            ['NumSerieFactura', ra.numSerieFactura],
            ['FechaExpedicionFactura', fechaOficial(ra.fechaExpedicion, 'encadenamiento.registroAnterior.fechaExpedicion', errores)],
            ['Huella', ra.huella],
          ],
        ],
      ],
    ]
  }

  // --- SistemaInformatico -------------------------------------------------------
  const si = opciones.sistemaInformatico
  validarTexto(si.nombreRazon, 'sistemaInformatico.nombreRazon', 120, errores)
  if (!esNifValido(si.nif)) errores.push(`sistemaInformatico.nif: NIF inválido «${si.nif}»`)
  validarTexto(si.nombreSistemaInformatico, 'sistemaInformatico.nombreSistemaInformatico', 30, errores)
  validarTexto(si.idSistemaInformatico, 'sistemaInformatico.idSistemaInformatico', 2, errores)
  validarTexto(si.version, 'sistemaInformatico.version', 50, errores)
  validarTexto(si.numeroInstalacion, 'sistemaInformatico.numeroInstalacion', 100, errores)

  // --- Fecha-hora de generación --------------------------------------------------
  const fechaHoraGen = fechaHoraHusoGenRegistro(opciones.fechaGeneracion ?? new Date())

  if (errores.length > 0) throw new ErrorValidacionRegistro(errores)

  const cuotaTotal = importeDesdeCentimos(cuotaTotalCent)
  const importeTotal = importeDesdeCentimos(importeTotalCent)
  const macrodato = Math.abs(importeTotalCent) >= UMBRAL_MACRODATO_CENT

  // --- Huella (V04): mismos valores que van al XML --------------------------------
  const datosHuella: DatosHuellaAlta = {
    IDEmisorFactura: nifEmisor,
    NumSerieFactura: numSerie,
    FechaExpedicionFactura: fechaExp,
    TipoFactura: e.tipoFactura,
    CuotaTotal: cuotaTotal,
    ImporteTotal: importeTotal,
    FechaHoraHusoGenRegistro: fechaHoraGen,
  }
  const cadenaHuella = cadenaEntradaAlta(datosHuella, huellaAnterior)
  const huella = huellaAlta(datosHuella, huellaAnterior)

  // --- Árbol del XML en el ORDEN EXACTO de la secuencia del XSD --------------------
  const arbol: Nodo[] = [
    ['IDVersion', ID_VERSION],
    [
      'IDFactura',
      [
        ['IDEmisorFactura', nifEmisor],
        ['NumSerieFactura', numSerie],
        ['FechaExpedicionFactura', fechaExp],
      ],
    ],
    e.refExterna ? ['RefExterna', e.refExterna] : null,
    ['NombreRazonEmisor', e.emisor.nombreRazon],
    e.subsanacion ? ['Subsanacion', e.subsanacion] : null,
    e.rechazoPrevio ? ['RechazoPrevio', e.rechazoPrevio] : null,
    ['TipoFactura', e.tipoFactura],
    e.tipoRectificativa ? ['TipoRectificativa', e.tipoRectificativa] : null,
    e.facturasRectificadas?.length
      ? [
          'FacturasRectificadas',
          e.facturasRectificadas.map(
            (f, i): Nodo => ['IDFacturaRectificada', facturaRelacionada(f, `facturasRectificadas[${i}]`)]
          ),
        ]
      : null,
    e.facturasSustituidas?.length
      ? [
          'FacturasSustituidas',
          e.facturasSustituidas.map(
            (f, i): Nodo => ['IDFacturaSustituida', facturaRelacionada(f, `facturasSustituidas[${i}]`)]
          ),
        ]
      : null,
    e.importeRectificacion
      ? [
          'ImporteRectificacion',
          [
            ['BaseRectificada', formatearImporte(e.importeRectificacion.baseRectificada)],
            ['CuotaRectificada', formatearImporte(e.importeRectificacion.cuotaRectificada)],
            e.importeRectificacion.cuotaRecargoRectificado !== undefined
              ? ['CuotaRecargoRectificado', formatearImporte(e.importeRectificacion.cuotaRecargoRectificado)]
              : null,
          ],
        ]
      : null,
    fechaOper && fechaOper !== fechaExp ? ['FechaOperacion', fechaOper] : null,
    ['DescripcionOperacion', e.descripcionOperacion],
    e.facturaSimplificadaArt7273 ? ['FacturaSimplificadaArt7273', e.facturaSimplificadaArt7273] : null,
    e.facturaSinIdentifDestinatarioArt61d
      ? ['FacturaSinIdentifDestinatarioArt61d', e.facturaSinIdentifDestinatarioArt61d]
      : null,
    macrodato ? ['Macrodato', 'S'] : null,
    nodosDestinatarios.length ? ['Destinatarios', nodosDestinatarios] : null,
    ['Desglose', nodosDesglose],
    ['CuotaTotal', cuotaTotal],
    ['ImporteTotal', importeTotal],
    nodoEncadenamiento,
    [
      'SistemaInformatico',
      [
        ['NombreRazon', si.nombreRazon],
        ['NIF', si.nif.trim().toUpperCase()],
        ['NombreSistemaInformatico', si.nombreSistemaInformatico],
        ['IdSistemaInformatico', si.idSistemaInformatico],
        ['Version', si.version],
        ['NumeroInstalacion', si.numeroInstalacion],
        ['TipoUsoPosibleSoloVerifactu', si.tipoUsoPosibleSoloVerifactu],
        ['TipoUsoPosibleMultiOT', si.tipoUsoPosibleMultiOT],
        ['IndicadorMultiplesOT', si.indicadorMultiplesOT],
      ],
    ],
    ['FechaHoraHusoGenRegistro', fechaHoraGen],
    ['TipoHuella', TIPO_HUELLA_SHA256],
    ['Huella', huella],
  ]

  const xml = `<sf:RegistroAlta xmlns:sf="${NS_SF}">\n${serializar(arbol, 'sf', 1)}\n</sf:RegistroAlta>`

  return {
    xml,
    huella,
    huellaAnterior,
    cadenaHuella,
    datosHuella,
    idEmisorFactura: nifEmisor,
    numSerieFactura: numSerie,
    fechaExpedicionFactura: fechaExp,
    tipoFactura: e.tipoFactura,
    cuotaTotal,
    importeTotal,
    fechaHoraHusoGenRegistro: fechaHoraGen,
    tipoHuella: TIPO_HUELLA_SHA256,
    primerRegistro: esPrimero,
  }
}

// ---------------------------------------------------------------------------
// Envoltura de remisión RegFactuSistemaFacturacion (SuministroLR.xsd)
// ---------------------------------------------------------------------------

export interface CabeceraRemision {
  obligadoEmision: { nombreRazon: string; nif: string }
  /** `dd-mm-aaaa` o Date: comunicación de fin de remisión voluntaria (art. 17 Orden). */
  fechaFinVeriFactu?: string | Date
  /** `S` si los registros del envío se generaron durante una incidencia (art. 16 Orden). */
  incidencia?: 'S' | 'N'
}

/**
 * Envuelve 1..1000 registros (fragmentos `sf:RegistroAlta`/`sf:RegistroAnulacion`
 * ya serializados) en el mensaje de envío `RegFactuSistemaFacturacion`.
 * La usa el cliente SOAP (V09/V10) y los tests de validación XSD.
 */
export function xmlRegFactuSistemaFacturacion(
  cabecera: CabeceraRemision,
  registrosXml: readonly string[]
): string {
  if (registrosXml.length < 1 || registrosXml.length > 1000) {
    throw new Error(`RegFactuSistemaFacturacion admite de 1 a 1000 registros (hay ${registrosXml.length})`)
  }
  const errores: string[] = []
  const nif = cabecera.obligadoEmision.nif.trim().toUpperCase()
  if (!esNifValido(nif)) errores.push(`cabecera.obligadoEmision.nif: NIF inválido «${cabecera.obligadoEmision.nif}»`)
  validarTexto(cabecera.obligadoEmision.nombreRazon, 'cabecera.obligadoEmision.nombreRazon', 120, errores)
  const fechaFin = cabecera.fechaFinVeriFactu
    ? fechaOficial(cabecera.fechaFinVeriFactu, 'cabecera.fechaFinVeriFactu', errores)
    : null
  if (errores.length > 0) throw new ErrorValidacionRegistro(errores)

  const remisionVoluntaria =
    fechaFin || cabecera.incidencia
      ? `\n    <sf:RemisionVoluntaria>${fechaFin ? `\n      <sf:FechaFinVeriFactu>${fechaFin}</sf:FechaFinVeriFactu>` : ''}${cabecera.incidencia ? `\n      <sf:Incidencia>${cabecera.incidencia}</sf:Incidencia>` : ''}\n    </sf:RemisionVoluntaria>`
      : ''

  const registros = registrosXml
    .map((r) => `  <sfLR:RegistroFactura>\n${r.replace(/^/gm, '    ')}\n  </sfLR:RegistroFactura>`)
    .join('\n')

  return (
    `<sfLR:RegFactuSistemaFacturacion xmlns:sfLR="${NS_SF_LR}" xmlns:sf="${NS_SF}">\n` +
    `  <sfLR:Cabecera>\n` +
    `    <sf:ObligadoEmision>\n` +
    `      <sf:NombreRazon>${escaparXml(cabecera.obligadoEmision.nombreRazon)}</sf:NombreRazon>\n` +
    `      <sf:NIF>${nif}</sf:NIF>\n` +
    `    </sf:ObligadoEmision>${remisionVoluntaria}\n` +
    `  </sfLR:Cabecera>\n` +
    `${registros}\n` +
    `</sfLR:RegFactuSistemaFacturacion>`
  )
}
