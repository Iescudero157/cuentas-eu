// Generador del XML del registro de EVENTO (RegistroEvento) de los sistemas
// informáticos de facturación.
//
// Fuente de la estructura: XSD oficial de la AEAT descargado en
// docs/verifactu/xsd/EventosSIF.xsd (elemento global `RegistroEvento`).
// Base legal: art. 8.4 RD 1007/2023 (RRSIF) y art. 9 de la Orden
// HAC/1177/2024. Diseño y citas: docs/verifactu/SPEC.md §7.
//
// IMPORTANTE (art. 3 Orden): mientras Kuentas opere SOLO como VERI*FACTU está
// EXENTO del registro de eventos. Este generador se implementa completo
// (producto total, decisión de Iván 7-sep-2026) para el modo no-VERI*FACTU
// que se evaluará en V14. Los eventos se huellan con cadena PROPIA (separada
// de la de facturación) y deben FIRMARSE electrónicamente (art. 14 Orden):
// la firma XAdES se integra en V14; hasta entonces el XML solo incluye
// `ds:Signature` si se aporta ya generada (sin ella NO valida contra el XSD,
// que la exige, ni es un registro de evento conforme).
//
// Server-only (usa node:crypto vía huella.ts). NO importar desde cliente.

import {
  type DatosHuellaEvento,
  type HuellaAnterior,
  TIPO_HUELLA_SHA256,
  cadenaEntradaEvento,
  esHuellaValida,
  fechaHoraHusoGenRegistro,
  formatearImporte,
  huellaEvento,
} from './huella.ts'
import {
  type Nodo,
  type SistemaInformatico,
  ErrorValidacionRegistro,
  ID_VERSION,
  esNifValido,
  fechaOficial,
  serializar,
  validarTexto,
} from './registro-alta.ts'

// ---------------------------------------------------------------------------
// Espacio de nombres oficial (targetNamespace del XSD descargado)
// ---------------------------------------------------------------------------

export const NS_EVENTOS =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/EventosSIF.xsd'

// ---------------------------------------------------------------------------
// Listas oficiales del XSD (EventosSIF.xsd)
// ---------------------------------------------------------------------------

/** Lista TipoEventoType: eventos del art. 9.1 Orden + resumen (10) + voluntarios (90). */
export type TipoEvento =
  | '01' // inicio funcionamiento como NO VERI*FACTU
  | '02' // fin funcionamiento como NO VERI*FACTU
  | '03' // lanzamiento detección de anomalías en registros de facturación
  | '04' // detección de anomalías en registros de facturación
  | '05' // lanzamiento detección de anomalías en registros de evento
  | '06' // detección de anomalías en registros de evento
  | '07' // restauración de copia de seguridad
  | '08' // exportación de registros de facturación de un periodo
  | '09' // exportación de registros de evento de un periodo
  | '10' // registro resumen de eventos (art. 9.2 Orden, cada 6 h)
  | '90' // otros eventos voluntarios del productor

const TIPOS_EVENTO: readonly TipoEvento[] = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '90',
]

/** Lista TipoAnomaliaType del XSD. */
export type TipoAnomalia =
  | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08'
  | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '90'

const TIPOS_ANOMALIA: readonly TipoAnomalia[] = [
  '01', '02', '03', '04', '05', '06', '07', '08',
  '09', '10', '11', '12', '13', '14', '15', '90',
]

// ---------------------------------------------------------------------------
// Tipos de entrada: datos propios de cada tipo de evento
// ---------------------------------------------------------------------------

/** Identificación de un registro de facturación (IDFacturaExpedidaType del XSD de eventos). */
export interface RefRegistroFacturacion {
  idEmisorFactura: string
  numSerieFactura: string
  /** `aaaa-mm-dd`, `dd-mm-aaaa` o Date. */
  fechaExpedicion: string | Date
}

/** Identificación de un registro de facturación con su huella (IDFacturaExpedidaHuellaType). */
export interface RefRegistroFacturacionHuella extends RefRegistroFacturacion {
  huella: string
}

/** Identificación de un registro de evento (RegEventoType del XSD). */
export interface RefRegistroEvento {
  tipoEvento: TipoEvento
  /** ISO 8601 con huso (`2026-01-01T10:00:00+01:00`) o Date. */
  fechaHoraHusoEvento: string | Date
  huellaEvento: string
}

/** Evento 03: lanzamiento del proceso de detección de anomalías en registros de facturación. */
export interface DatosLanzamientoDeteccionFacturacion {
  tipo: 'LanzamientoProcesoDeteccionAnomaliasRegFacturacion'
  procesoIntegridadHuellas: 'S' | 'N'
  numeroRegistrosIntegridadHuellas?: number
  procesoIntegridadFirmas: 'S' | 'N'
  numeroRegistrosIntegridadFirmas?: number
  procesoTrazabilidadCadena: 'S' | 'N'
  numeroRegistrosTrazabilidadCadena?: number
  procesoTrazabilidadFechas: 'S' | 'N'
  numeroRegistrosTrazabilidadFechas?: number
}

/** Evento 04: anomalía detectada en registros de facturación. */
export interface DatosDeteccionAnomaliaFacturacion {
  tipo: 'DeteccionAnomaliasRegFacturacion'
  tipoAnomalia: TipoAnomalia
  otrosDatosAnomalia?: string
  registroFacturacionAnomalo?: RefRegistroFacturacion
}

/** Evento 05: lanzamiento del proceso de detección de anomalías en registros de evento. */
export interface DatosLanzamientoDeteccionEvento {
  tipo: 'LanzamientoProcesoDeteccionAnomaliasRegEvento'
  procesoIntegridadHuellas: 'S' | 'N'
  numeroRegistrosIntegridadHuellas?: number
  procesoIntegridadFirmas: 'S' | 'N'
  numeroRegistrosIntegridadFirmas?: number
  procesoTrazabilidadCadena: 'S' | 'N'
  numeroRegistrosTrazabilidadCadena?: number
  procesoTrazabilidadFechas: 'S' | 'N'
  numeroRegistrosTrazabilidadFechas?: number
}

/** Evento 06: anomalía detectada en registros de evento. */
export interface DatosDeteccionAnomaliaEvento {
  tipo: 'DeteccionAnomaliasRegEvento'
  tipoAnomalia: TipoAnomalia
  otrosDatosAnomalia?: string
  regEventoAnomalo?: RefRegistroEvento
}

/** Evento 08: exportación de registros de facturación de un periodo. */
export interface DatosExportacionFacturacion {
  tipo: 'ExportacionRegFacturacionPeriodo'
  /** ISO 8601 con huso o Date. */
  fechaHoraHusoInicioPeriodo: string | Date
  fechaHoraHusoFinPeriodo: string | Date
  registroInicialPeriodo: RefRegistroFacturacionHuella
  registroFinalPeriodo: RefRegistroFacturacionHuella
  numeroAltasExportados: number
  /** Euros; se formatean con 2 decimales (ImporteSgn12.2Type). */
  sumaCuotaTotalAlta: number
  sumaImporteTotalAlta: number
  numeroAnulacionesExportados: number
  exportadosDejanDeConservarse: 'S' | 'N'
}

/** Evento 09: exportación de registros de evento de un periodo. */
export interface DatosExportacionEvento {
  tipo: 'ExportacionRegEventoPeriodo'
  fechaHoraHusoInicioPeriodo: string | Date
  fechaHoraHusoFinPeriodo: string | Date
  registroEventoInicialPeriodo: RefRegistroEvento
  registroEventoFinalPeriodo: RefRegistroEvento
  numeroEventosExportados: number
  exportadosDejanDeConservarse: 'S' | 'N'
}

/** Evento 10: registro resumen de eventos de las últimas 6 horas (art. 9.2 Orden). */
export interface DatosResumenEventos {
  tipo: 'ResumenEventos'
  /** 1..20 agrupaciones (TipoEvento + número de eventos del periodo). */
  eventos: { tipoEvento: TipoEvento; numeroDeEventos: number }[]
  registroFacturacionInicialPeriodo?: RefRegistroFacturacionHuella
  registroFacturacionFinalPeriodo?: RefRegistroFacturacionHuella
  numeroAltasGenerados: number
  sumaCuotaTotalAlta: number
  sumaImporteTotalAlta: number
  numeroAnulacionesGenerados: number
}

export type DatosPropiosEvento =
  | DatosLanzamientoDeteccionFacturacion
  | DatosDeteccionAnomaliaFacturacion
  | DatosLanzamientoDeteccionEvento
  | DatosDeteccionAnomaliaEvento
  | DatosExportacionFacturacion
  | DatosExportacionEvento
  | DatosResumenEventos

/** Correspondencia obligatoria TipoEvento → variante de DatosPropiosEvento (art. 9 Orden + XSD). */
const DATOS_POR_TIPO: Readonly<Partial<Record<TipoEvento, DatosPropiosEvento['tipo']>>> = {
  '03': 'LanzamientoProcesoDeteccionAnomaliasRegFacturacion',
  '04': 'DeteccionAnomaliasRegFacturacion',
  '05': 'LanzamientoProcesoDeteccionAnomaliasRegEvento',
  '06': 'DeteccionAnomaliasRegEvento',
  '08': 'ExportacionRegFacturacionPeriodo',
  '09': 'ExportacionRegEventoPeriodo',
  '10': 'ResumenEventos',
}

// ---------------------------------------------------------------------------
// Entrada y opciones del generador
// ---------------------------------------------------------------------------

/** Encadenamiento de eventos: cadena PROPIA, separada de la de facturación. */
export type EncadenamientoEvento =
  | { primerEvento: true }
  | {
      eventoAnterior: {
        tipoEvento: TipoEvento
        /** ISO 8601 con huso o Date: FechaHoraHusoGenEvento del evento anterior. */
        fechaHoraHusoGenEvento: string | Date
        huellaEvento: string
      }
    }

export interface EntradaRegistroEvento {
  /** Obligado a expedir la factura al que da servicio la instalación. */
  obligadoEmision: { nombreRazon: string; nif: string }
  tipoEvento: TipoEvento
  /** Obligatorio para los tipos 03-06 y 08-10; no admisible en 01/02/07/90. */
  datosPropiosEvento?: DatosPropiosEvento
  /** Información libre adicional (≤100; único contenido propio admitido en 90). */
  otrosDatosEvento?: string
  /** `D`/`T` si la facturación la realiza destinatario o tercero. */
  emitidaPorTerceroODestinatario?: 'D' | 'T'
  /** Identificación del tercero/destinatario (solo con el campo anterior). */
  terceroODestinatario?: { nombreRazon: string; nif: string }
}

export interface OpcionesRegistroEvento {
  encadenamiento: EncadenamientoEvento
  sistemaInformatico: SistemaInformatico
  /** Momento de generación del evento; por defecto `new Date()` (huso Europe/Madrid). */
  fechaGeneracion?: Date
  /**
   * Firma XAdES ya generada (elemento `<ds:Signature>…</ds:Signature>` completo,
   * art. 14 Orden). Se integrará en V14; sin ella el XML se genera SIN firma y
   * NO es conforme (el XSD la exige).
   */
  firmaXmlDs?: string
}

/** Resultado: XML + huella + los datos que persisten en sif_eventos. */
export interface RegistroEventoGenerado {
  /** Documento `<sfe:RegistroEvento>` autónomo (xmlns declarado). */
  xml: string
  huellaEvento: string
  huellaEventoAnterior: HuellaAnterior
  /** Cadena de entrada de la huella (auditoría/depuración). */
  cadenaHuella: string
  datosHuella: DatosHuellaEvento
  tipoEvento: TipoEvento
  fechaHoraHusoGenEvento: string
  tipoHuella: string
  primerEvento: boolean
  /** `true` solo si se aportó `firmaXmlDs` (sin firma el registro no es conforme). */
  firmado: boolean
}

// ---------------------------------------------------------------------------
// Helpers de validación/formato propios de eventos
// ---------------------------------------------------------------------------

/** Entero no negativo con un máximo de dígitos (DigitosMax4/5/6/7/9Type). */
function digitos(valor: number, maxDigitos: number, campo: string, errores: string[]): string {
  if (!Number.isInteger(valor) || valor < 0) {
    errores.push(`${campo}: debe ser un entero no negativo («${valor}»)`)
    return '0'
  }
  const texto = String(valor)
  if (texto.length > maxDigitos) {
    errores.push(`${campo}: supera los ${maxDigitos} dígitos admitidos por el XSD (${texto})`)
  }
  return texto
}

/** ISO 8601 con huso, idéntico formato que FechaHoraHusoGenRegistro. */
function fechaHoraHuso(valor: string | Date, campo: string, errores: string[]): string {
  if (valor instanceof Date) return fechaHoraHusoGenRegistro(valor)
  const v = (valor ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(v)) {
    errores.push(`${campo}: se espera ISO 8601 con huso (2026-01-01T10:00:00+01:00), recibido «${valor}»`)
  }
  return v
}

/** Importe con signo y 2 decimales (ImporteSgn12.2Type). */
function importe(valor: number, campo: string, errores: string[]): string {
  if (!Number.isFinite(valor)) {
    errores.push(`${campo}: importe no numérico`)
    return '0.00'
  }
  if (Math.abs(valor) >= 1e12) {
    errores.push(`${campo}: excede los 12 dígitos enteros admitidos por el XSD`)
  }
  return formatearImporte(valor)
}

function validarHuellaCampo(valor: string, campo: string, errores: string[]): string {
  if (!esHuellaValida(valor ?? '')) {
    errores.push(`${campo}: debe ser 64 hexadecimales en mayúsculas`)
  }
  return valor ?? ''
}

// ---------------------------------------------------------------------------
// Serialización de los datos propios de cada evento
// ---------------------------------------------------------------------------

function nodoRefFacturacion(
  ref: RefRegistroFacturacion,
  nombre: string,
  campo: string,
  errores: string[],
  huella?: string
): Nodo {
  const nif = (ref.idEmisorFactura ?? '').trim().toUpperCase()
  if (!esNifValido(nif)) errores.push(`${campo}.idEmisorFactura: NIF inválido «${ref.idEmisorFactura}»`)
  if (!/^[\x20-\x7E]{1,60}$/.test(ref.numSerieFactura ?? '')) {
    errores.push(`${campo}.numSerieFactura: debe ser ASCII visible de 1 a 60 caracteres`)
  }
  return [
    nombre,
    [
      ['IDEmisorFactura', nif],
      ['NumSerieFactura', ref.numSerieFactura],
      ['FechaExpedicionFactura', fechaOficial(ref.fechaExpedicion, `${campo}.fechaExpedicion`, errores)],
      huella !== undefined ? ['Huella', validarHuellaCampo(huella, `${campo}.huella`, errores)] : null,
    ],
  ]
}

function nodoRefEvento(
  ref: RefRegistroEvento,
  nombre: string,
  campoFechaXml: 'FechaHoraHusoEvento' | 'FechaHoraHusoGenEvento',
  campo: string,
  errores: string[]
): Nodo {
  if (!TIPOS_EVENTO.includes(ref.tipoEvento)) {
    errores.push(`${campo}.tipoEvento: valor «${ref.tipoEvento}» fuera de la lista TipoEventoType`)
  }
  return [
    nombre,
    [
      ['TipoEvento', ref.tipoEvento],
      [campoFechaXml, fechaHoraHuso(ref.fechaHoraHusoEvento, `${campo}.fechaHoraHusoEvento`, errores)],
      ['HuellaEvento', validarHuellaCampo(ref.huellaEvento, `${campo}.huellaEvento`, errores)],
    ],
  ]
}

function nodoLanzamientoDeteccion(
  d: DatosLanzamientoDeteccionFacturacion | DatosLanzamientoDeteccionEvento,
  errores: string[]
): Nodo {
  const esFacturacion = d.tipo === 'LanzamientoProcesoDeteccionAnomaliasRegFacturacion'
  const sufijo = esFacturacion ? 'RegFacturacion' : 'RegEvento'
  const nRegistros = esFacturacion ? 'NumeroDeRegistrosFacturacionProcesados' : 'NumeroDeRegistrosEventoProcesados'
  const maxDig = esFacturacion ? 7 : 5
  const num = (valor: number | undefined, elemento: string, campo: string): Nodo =>
    valor === undefined ? null : [elemento, digitos(valor, maxDig, `datosPropiosEvento.${campo}`, errores)]
  return [
    d.tipo,
    [
      [`RealizadoProcesoSobreIntegridadHuellas${sufijo}`, d.procesoIntegridadHuellas],
      num(d.numeroRegistrosIntegridadHuellas, `${nRegistros}SobreIntegridadHuellas`, 'numeroRegistrosIntegridadHuellas'),
      [`RealizadoProcesoSobreIntegridadFirmas${sufijo}`, d.procesoIntegridadFirmas],
      num(d.numeroRegistrosIntegridadFirmas, `${nRegistros}SobreIntegridadFirmas`, 'numeroRegistrosIntegridadFirmas'),
      [`RealizadoProcesoSobreTrazabilidadCadena${sufijo}`, d.procesoTrazabilidadCadena],
      num(d.numeroRegistrosTrazabilidadCadena, `${nRegistros}SobreTrazabilidadCadena`, 'numeroRegistrosTrazabilidadCadena'),
      [`RealizadoProcesoSobreTrazabilidadFechas${sufijo}`, d.procesoTrazabilidadFechas],
      num(d.numeroRegistrosTrazabilidadFechas, `${nRegistros}SobreTrazabilidadFechas`, 'numeroRegistrosTrazabilidadFechas'),
    ],
  ]
}

function nodoDatosPropios(d: DatosPropiosEvento, errores: string[]): Nodo {
  switch (d.tipo) {
    case 'LanzamientoProcesoDeteccionAnomaliasRegFacturacion':
    case 'LanzamientoProcesoDeteccionAnomaliasRegEvento':
      return nodoLanzamientoDeteccion(d, errores)

    case 'DeteccionAnomaliasRegFacturacion': {
      if (!TIPOS_ANOMALIA.includes(d.tipoAnomalia)) {
        errores.push(`datosPropiosEvento.tipoAnomalia: valor «${d.tipoAnomalia}» fuera de la lista TipoAnomaliaType`)
      }
      if (d.otrosDatosAnomalia !== undefined) {
        validarTexto(d.otrosDatosAnomalia, 'datosPropiosEvento.otrosDatosAnomalia', 100, errores)
      }
      return [
        d.tipo,
        [
          ['TipoAnomalia', d.tipoAnomalia],
          d.otrosDatosAnomalia ? ['OtrosDatosAnomalia', d.otrosDatosAnomalia] : null,
          d.registroFacturacionAnomalo
            ? nodoRefFacturacion(d.registroFacturacionAnomalo, 'RegistroFacturacionAnomalo', 'datosPropiosEvento.registroFacturacionAnomalo', errores)
            : null,
        ],
      ]
    }

    case 'DeteccionAnomaliasRegEvento': {
      if (!TIPOS_ANOMALIA.includes(d.tipoAnomalia)) {
        errores.push(`datosPropiosEvento.tipoAnomalia: valor «${d.tipoAnomalia}» fuera de la lista TipoAnomaliaType`)
      }
      if (d.otrosDatosAnomalia !== undefined) {
        validarTexto(d.otrosDatosAnomalia, 'datosPropiosEvento.otrosDatosAnomalia', 100, errores)
      }
      return [
        d.tipo,
        [
          ['TipoAnomalia', d.tipoAnomalia],
          d.otrosDatosAnomalia ? ['OtrosDatosAnomalia', d.otrosDatosAnomalia] : null,
          d.regEventoAnomalo
            ? nodoRefEvento(d.regEventoAnomalo, 'RegEventoAnomalo', 'FechaHoraHusoEvento', 'datosPropiosEvento.regEventoAnomalo', errores)
            : null,
        ],
      ]
    }

    case 'ExportacionRegFacturacionPeriodo':
      return [
        d.tipo,
        [
          ['FechaHoraHusoInicioPeriodoExport', fechaHoraHuso(d.fechaHoraHusoInicioPeriodo, 'datosPropiosEvento.fechaHoraHusoInicioPeriodo', errores)],
          ['FechaHoraHusoFinPeriodoExport', fechaHoraHuso(d.fechaHoraHusoFinPeriodo, 'datosPropiosEvento.fechaHoraHusoFinPeriodo', errores)],
          nodoRefFacturacion(d.registroInicialPeriodo, 'RegistroFacturacionInicialPeriodo', 'datosPropiosEvento.registroInicialPeriodo', errores, d.registroInicialPeriodo.huella),
          nodoRefFacturacion(d.registroFinalPeriodo, 'RegistroFacturacionFinalPeriodo', 'datosPropiosEvento.registroFinalPeriodo', errores, d.registroFinalPeriodo.huella),
          ['NumeroDeRegistrosFacturacionAltaExportados', digitos(d.numeroAltasExportados, 9, 'datosPropiosEvento.numeroAltasExportados', errores)],
          ['SumaCuotaTotalAlta', importe(d.sumaCuotaTotalAlta, 'datosPropiosEvento.sumaCuotaTotalAlta', errores)],
          ['SumaImporteTotalAlta', importe(d.sumaImporteTotalAlta, 'datosPropiosEvento.sumaImporteTotalAlta', errores)],
          ['NumeroDeRegistrosFacturacionAnulacionExportados', digitos(d.numeroAnulacionesExportados, 9, 'datosPropiosEvento.numeroAnulacionesExportados', errores)],
          ['RegistrosFacturacionExportadosDejanDeConservarse', d.exportadosDejanDeConservarse],
        ],
      ]

    case 'ExportacionRegEventoPeriodo':
      return [
        d.tipo,
        [
          ['FechaHoraHusoInicioPeriodoExport', fechaHoraHuso(d.fechaHoraHusoInicioPeriodo, 'datosPropiosEvento.fechaHoraHusoInicioPeriodo', errores)],
          ['FechaHoraHusoFinPeriodoExport', fechaHoraHuso(d.fechaHoraHusoFinPeriodo, 'datosPropiosEvento.fechaHoraHusoFinPeriodo', errores)],
          nodoRefEvento(d.registroEventoInicialPeriodo, 'RegistroEventoInicialPeriodo', 'FechaHoraHusoEvento', 'datosPropiosEvento.registroEventoInicialPeriodo', errores),
          nodoRefEvento(d.registroEventoFinalPeriodo, 'RegistroEventoFinalPeriodo', 'FechaHoraHusoEvento', 'datosPropiosEvento.registroEventoFinalPeriodo', errores),
          ['NumeroDeRegEventoExportados', digitos(d.numeroEventosExportados, 7, 'datosPropiosEvento.numeroEventosExportados', errores)],
          ['RegEventoExportadosDejanDeConservarse', d.exportadosDejanDeConservarse],
        ],
      ]

    case 'ResumenEventos': {
      if (!d.eventos || d.eventos.length < 1 || d.eventos.length > 20) {
        errores.push(`datosPropiosEvento.eventos: el resumen admite de 1 a 20 agrupaciones (hay ${d.eventos?.length ?? 0})`)
      }
      const agrupaciones: Nodo[] = (d.eventos ?? []).slice(0, 20).map((a, i): Nodo => {
        if (!TIPOS_EVENTO.includes(a.tipoEvento)) {
          errores.push(`datosPropiosEvento.eventos[${i}].tipoEvento: valor «${a.tipoEvento}» fuera de la lista TipoEventoType`)
        }
        return [
          'TipoEvento',
          [
            ['TipoEvento', a.tipoEvento],
            ['NumeroDeEventos', digitos(a.numeroDeEventos, 4, `datosPropiosEvento.eventos[${i}].numeroDeEventos`, errores)],
          ],
        ]
      })
      return [
        d.tipo,
        [
          ...agrupaciones,
          d.registroFacturacionInicialPeriodo
            ? nodoRefFacturacion(d.registroFacturacionInicialPeriodo, 'RegistroFacturacionInicialPeriodo', 'datosPropiosEvento.registroFacturacionInicialPeriodo', errores, d.registroFacturacionInicialPeriodo.huella)
            : null,
          d.registroFacturacionFinalPeriodo
            ? nodoRefFacturacion(d.registroFacturacionFinalPeriodo, 'RegistroFacturacionFinalPeriodo', 'datosPropiosEvento.registroFacturacionFinalPeriodo', errores, d.registroFacturacionFinalPeriodo.huella)
            : null,
          ['NumeroDeRegistrosFacturacionAltaGenerados', digitos(d.numeroAltasGenerados, 6, 'datosPropiosEvento.numeroAltasGenerados', errores)],
          ['SumaCuotaTotalAlta', importe(d.sumaCuotaTotalAlta, 'datosPropiosEvento.sumaCuotaTotalAlta', errores)],
          ['SumaImporteTotalAlta', importe(d.sumaImporteTotalAlta, 'datosPropiosEvento.sumaImporteTotalAlta', errores)],
          ['NumeroDeRegistrosFacturacionAnulacionGenerados', digitos(d.numeroAnulacionesGenerados, 6, 'datosPropiosEvento.numeroAnulacionesGenerados', errores)],
        ],
      ]
    }
  }
}

// ---------------------------------------------------------------------------
// Generador principal
// ---------------------------------------------------------------------------

/**
 * Construye el registro de evento completo: valida la coherencia entre
 * `tipoEvento` y sus datos propios, serializa el XML oficial
 * (`sfe:RegistroEvento`, EventosSIF.xsd) y calcula la huella encadenada de la
 * cadena de eventos (separada de la de facturación). Lanza
 * `ErrorValidacionRegistro` con TODOS los problemas si no es conforme.
 */
export function construirRegistroEvento(
  entrada: EntradaRegistroEvento,
  opciones: OpcionesRegistroEvento
): RegistroEventoGenerado {
  const errores: string[] = []
  const e = entrada

  // --- Obligado emisión -------------------------------------------------------
  const nifObligado = (e.obligadoEmision?.nif ?? '').trim().toUpperCase()
  if (!esNifValido(nifObligado)) {
    errores.push(`obligadoEmision.nif: NIF español inválido «${e.obligadoEmision?.nif ?? ''}»`)
  }
  validarTexto(e.obligadoEmision?.nombreRazon ?? '', 'obligadoEmision.nombreRazon', 120, errores)

  // --- Tipo de evento y datos propios ------------------------------------------
  if (!TIPOS_EVENTO.includes(e.tipoEvento)) {
    errores.push(`tipoEvento: valor «${e.tipoEvento}» fuera de la lista TipoEventoType (01-10, 90)`)
  }
  const tipoDatosEsperado = DATOS_POR_TIPO[e.tipoEvento]
  if (tipoDatosEsperado && !e.datosPropiosEvento) {
    errores.push(`datosPropiosEvento: obligatorio para tipoEvento=${e.tipoEvento} (variante ${tipoDatosEsperado})`)
  }
  if (e.datosPropiosEvento && !tipoDatosEsperado) {
    errores.push(`datosPropiosEvento: no admisible para tipoEvento=${e.tipoEvento} (use otrosDatosEvento)`)
  }
  if (e.datosPropiosEvento && tipoDatosEsperado && e.datosPropiosEvento.tipo !== tipoDatosEsperado) {
    errores.push(
      `datosPropiosEvento: la variante «${e.datosPropiosEvento.tipo}» no corresponde a tipoEvento=${e.tipoEvento} (se espera ${tipoDatosEsperado})`
    )
  }
  if (e.otrosDatosEvento !== undefined) {
    validarTexto(e.otrosDatosEvento, 'otrosDatosEvento', 100, errores)
  }

  // --- Tercero / destinatario ----------------------------------------------------
  if (e.emitidaPorTerceroODestinatario && !['D', 'T'].includes(e.emitidaPorTerceroODestinatario)) {
    errores.push(`emitidaPorTerceroODestinatario: valor «${e.emitidaPorTerceroODestinatario}» inválido (D/T)`)
  }
  if (e.terceroODestinatario && !e.emitidaPorTerceroODestinatario) {
    errores.push('terceroODestinatario: solo admisible junto a emitidaPorTerceroODestinatario')
  }
  if (e.emitidaPorTerceroODestinatario && !e.terceroODestinatario) {
    errores.push('terceroODestinatario: obligatorio cuando emitidaPorTerceroODestinatario es D/T')
  }
  let nodoTercero: Nodo = null
  if (e.terceroODestinatario) {
    const t = e.terceroODestinatario
    validarTexto(t.nombreRazon ?? '', 'terceroODestinatario.nombreRazon', 120, errores)
    const nifTercero = (t.nif ?? '').trim().toUpperCase()
    if (!esNifValido(nifTercero)) {
      errores.push(`terceroODestinatario.nif: NIF español inválido «${t.nif}»`)
    }
    nodoTercero = ['TerceroODestinatario', [['NombreRazon', t.nombreRazon], ['NIF', nifTercero]]]
  }

  // --- SistemaInformatico ---------------------------------------------------------
  const si = opciones.sistemaInformatico
  validarTexto(si.nombreRazon, 'sistemaInformatico.nombreRazon', 120, errores)
  if (!esNifValido(si.nif)) errores.push(`sistemaInformatico.nif: NIF inválido «${si.nif}»`)
  validarTexto(si.nombreSistemaInformatico, 'sistemaInformatico.nombreSistemaInformatico', 30, errores)
  validarTexto(si.idSistemaInformatico, 'sistemaInformatico.idSistemaInformatico', 2, errores)
  validarTexto(si.version, 'sistemaInformatico.version', 50, errores)
  validarTexto(si.numeroInstalacion, 'sistemaInformatico.numeroInstalacion', 100, errores)

  // --- Encadenamiento de la cadena de eventos ---------------------------------------
  const enc = opciones.encadenamiento
  const esPrimero = 'primerEvento' in enc
  let huellaEventoAnterior: HuellaAnterior = null
  let nodoEncadenamiento: Nodo
  if (esPrimero) {
    nodoEncadenamiento = ['Encadenamiento', [['PrimerEvento', 'S']]]
  } else {
    const ea = enc.eventoAnterior
    if (!TIPOS_EVENTO.includes(ea.tipoEvento)) {
      errores.push(`encadenamiento.eventoAnterior.tipoEvento: valor «${ea.tipoEvento}» fuera de la lista TipoEventoType`)
    }
    huellaEventoAnterior = validarHuellaCampo(ea.huellaEvento, 'encadenamiento.eventoAnterior.huellaEvento', errores)
    nodoEncadenamiento = [
      'Encadenamiento',
      [
        [
          'EventoAnterior',
          [
            ['TipoEvento', ea.tipoEvento],
            ['FechaHoraHusoGenEvento', fechaHoraHuso(ea.fechaHoraHusoGenEvento, 'encadenamiento.eventoAnterior.fechaHoraHusoGenEvento', errores)],
            ['HuellaEvento', ea.huellaEvento],
          ],
        ],
      ],
    ]
  }

  // --- Datos propios (tras validar la correspondencia con tipoEvento) ---------------
  const nodoDatos =
    e.datosPropiosEvento && tipoDatosEsperado && e.datosPropiosEvento.tipo === tipoDatosEsperado
      ? ['DatosPropiosEvento', [nodoDatosPropios(e.datosPropiosEvento, errores)]] as Nodo
      : null

  // --- Firma (art. 14 Orden; XAdES real en V14) --------------------------------------
  const firma = opciones.firmaXmlDs?.trim()
  if (firma !== undefined && !/^<ds:Signature[\s>]/.test(firma)) {
    errores.push('firmaXmlDs: se espera un elemento <ds:Signature> completo ya serializado')
  }

  // --- Fecha-hora de generación --------------------------------------------------------
  const fechaHoraGen = fechaHoraHusoGenRegistro(opciones.fechaGeneracion ?? new Date())

  if (errores.length > 0) throw new ErrorValidacionRegistro(errores)

  // --- Huella (V04, doc. AEAT §3.c): mismos valores que van al XML ----------------------
  const datosHuella: DatosHuellaEvento = {
    NIFSistemaInformatico: si.nif.trim().toUpperCase(),
    ID: '', // el productor de Kuentas se identifica con NIF español (sin IDOtro)
    IdSistemaInformatico: si.idSistemaInformatico,
    Version: si.version,
    NumeroInstalacion: si.numeroInstalacion,
    NIFObligadoEmision: nifObligado,
    TipoEvento: e.tipoEvento,
    FechaHoraHusoGenEvento: fechaHoraGen,
  }
  const cadenaHuella = cadenaEntradaEvento(datosHuella, huellaEventoAnterior)
  const huella = huellaEvento(datosHuella, huellaEventoAnterior)

  // --- Árbol del XML en el ORDEN EXACTO de la secuencia del XSD (EventoType) ------------
  const arbolEvento: Nodo[] = [
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
    ['ObligadoEmision', [['NombreRazon', e.obligadoEmision.nombreRazon], ['NIF', nifObligado]]],
    e.emitidaPorTerceroODestinatario
      ? ['EmitidaPorTerceroODestinatario', e.emitidaPorTerceroODestinatario]
      : null,
    nodoTercero,
    ['FechaHoraHusoGenEvento', fechaHoraGen],
    ['TipoEvento', e.tipoEvento],
    nodoDatos,
    e.otrosDatosEvento ? ['OtrosDatosEvento', e.otrosDatosEvento] : null,
    nodoEncadenamiento,
    ['TipoHuella', TIPO_HUELLA_SHA256],
    ['HuellaEvento', huella],
  ]

  const xmlnsDs = firma ? ' xmlns:ds="http://www.w3.org/2000/09/xmldsig#"' : ''
  const firmaSerializada = firma ? `\n${firma.replace(/^/gm, '    ')}` : ''
  const xml =
    `<sfe:RegistroEvento xmlns:sfe="${NS_EVENTOS}"${xmlnsDs}>\n` +
    `  <sfe:IDVersion>${ID_VERSION}</sfe:IDVersion>\n` +
    `  <sfe:Evento>\n` +
    `${serializar(arbolEvento, 'sfe', 2)}${firmaSerializada}\n` +
    `  </sfe:Evento>\n` +
    `</sfe:RegistroEvento>`

  return {
    xml,
    huellaEvento: huella,
    huellaEventoAnterior,
    cadenaHuella,
    datosHuella,
    tipoEvento: e.tipoEvento,
    fechaHoraHusoGenEvento: fechaHoraGen,
    tipoHuella: TIPO_HUELLA_SHA256,
    primerEvento: esPrimero,
    firmado: Boolean(firma),
  }
}

// ---------------------------------------------------------------------------
// Verificación de integridad de la cadena de eventos (espejo de
// verificarCadena de huella.ts, sobre la cadena PROPIA de eventos)
// ---------------------------------------------------------------------------

/** Un eslabón de la cadena de eventos, en orden de generación (espeja sif_eventos). */
export interface EslabonCadenaEventos {
  primerEvento: boolean
  huellaAnterior: HuellaAnterior
  huella: string
  datos: DatosHuellaEvento
}

export interface ErrorCadenaEventos {
  /** Posición del eslabón con problema (0-based) dentro del array verificado. */
  indice: number
  codigo:
    | 'FORMATO_HUELLA'
    | 'HUELLA_NO_COINCIDE'
    | 'ENCADENADO_ROTO'
    | 'PRIMER_EVENTO_INCOHERENTE'
  detalle: string
}

export interface ResultadoVerificacionEventos {
  valida: boolean
  errores: ErrorCadenaEventos[]
  /** Huella del último eslabón (para continuar la cadena), si hay eslabones. */
  ultimaHuella: string | null
}

/**
 * Verifica la integridad de la cadena de eventos (o un fragmento contiguo que
 * continúa una cadena cuya última huella es `opciones.huellaPrevia`).
 * Devuelve TODOS los errores encontrados (no se detiene en el primero).
 */
export function verificarCadenaEventos(
  eslabones: readonly EslabonCadenaEventos[],
  opciones?: { huellaPrevia?: string }
): ResultadoVerificacionEventos {
  const errores: ErrorCadenaEventos[] = []
  let huellaEsperada: HuellaAnterior = opciones?.huellaPrevia ?? null

  eslabones.forEach((eslabon, indice) => {
    const esPrimero = indice === 0 && huellaEsperada === null

    if (!esHuellaValida(eslabon.huella)) {
      errores.push({
        indice,
        codigo: 'FORMATO_HUELLA',
        detalle: `Huella declarada con formato inválido: «${eslabon.huella}»`,
      })
    }

    if (esPrimero) {
      if (!eslabon.primerEvento || (eslabon.huellaAnterior ?? '') !== '') {
        errores.push({
          indice,
          codigo: 'PRIMER_EVENTO_INCOHERENTE',
          detalle: 'El primer eslabón de la cadena debe tener primerEvento=true y huellaAnterior vacía',
        })
      }
    } else {
      if (eslabon.primerEvento) {
        errores.push({
          indice,
          codigo: 'PRIMER_EVENTO_INCOHERENTE',
          detalle: 'Eslabón marcado como primer evento en mitad de la cadena',
        })
      }
      if ((eslabon.huellaAnterior ?? '') !== (huellaEsperada ?? '')) {
        errores.push({
          indice,
          codigo: 'ENCADENADO_ROTO',
          detalle: `huellaAnterior «${eslabon.huellaAnterior ?? ''}» no coincide con la huella del eslabón anterior «${huellaEsperada ?? ''}»`,
        })
      }
    }

    const recalculada = huellaEvento(eslabon.datos, eslabon.huellaAnterior)
    if (recalculada !== eslabon.huella) {
      errores.push({
        indice,
        codigo: 'HUELLA_NO_COINCIDE',
        detalle: `La huella recalculada «${recalculada}» no coincide con la declarada «${eslabon.huella}»`,
      })
    }

    huellaEsperada = eslabon.huella
  })

  return {
    valida: errores.length === 0,
    errores,
    ultimaHuella: eslabones.length > 0 ? eslabones[eslabones.length - 1].huella : null,
  }
}
