// ---------------------------------------------------------------------------
// V16 · Conservación y exportación de registros de facturación.
//
// Art. 8 Orden HAC/1177/2024 (conservación, accesibilidad y legibilidad):
//   8.2  el SIF debe permitir la exportación segura de los registros a un
//        almacenamiento externo, en formato electrónico legible, con
//        posibilidad de exportar por períodos.
//   8.5  la información exportada debe conservar la ESTRUCTURA Y FORMATO de
//        los registros de los arts. 10 y 11 de la Orden (es decir, el XML de
//        los XSD oficiales de la sede AEAT).
// Art. 18 Orden (remisión por requerimiento): la estructura del suministro a
// requerimiento es la misma de VERI*FACTU; por eso cada lote exportado es un
// mensaje `RegFactuSistemaFacturacion` (SuministroLR.xsd) de 1..1000
// registros, directamente validable contra los XSD y apto como base de una
// remisión a requerimiento.
//
// El export es un ZIP con:
//   manifest.json                  metadatos + huellas SHA-256 de cada fichero
//   LEEME.txt                      qué es y cómo verificarlo
//   registros/registros-00001.xml  lotes RegFactuSistemaFacturacion (≤1000)
//   eventos/eventos.json           eventos internos del SIF (si hay)
//
// Re-verificación: verificarZipExport() reabre el fichero exportado, contrasta
// los SHA-256 del manifiesto y RECALCULA la cadena de huellas de los registros
// con la librería oficial V04 (independiente de la BD). Los cortes de período
// se aplican sobre el instante de GENERACIÓN del registro (la cadena sigue el
// orden de generación, art. 7 Orden), por lo que todo export es un tramo
// contiguo de correlativos y su encadenamiento es verificable.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'
import JSZip from 'jszip'

import { esHuellaValida, huellaAlta, huellaAnulacion } from './huella.ts'
import {
  sistemaInformaticoKuentas,
  xmlRegFactuSistemaFacturacion,
  type CabeceraRemision,
} from './registro-alta.ts'
import {
  cargarConfig,
  reconstruirRegistroAlta,
  reconstruirRegistroAnulacion,
  type FilaSifConfig,
  type RegistroAltaPersistido,
  type RegistroAnulacionPersistido,
} from './emision.ts'
import { hijo, hijosDe, parsearXml, textoDe, textoObligatorio, type ElementoXml } from './xml-ligero.ts'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export const FORMATO_EXPORT = 'kuentas-verifactu-export/1'

/** Máximo de registros por mensaje RegFactuSistemaFacturacion (art. 16 Orden). */
export const REGISTROS_POR_LOTE = 1000

/** Columnas de sif_registros que usa la exportación. */
export interface FilaRegistroExport {
  id: string
  correlativo: number | string
  tipo_registro: 'alta' | 'anulacion'
  id_emisor_factura: string
  num_serie_factura: string
  fecha_expedicion: string
  tipo_factura: string | null
  primer_registro: boolean
  huella_anterior: string | null
  huella: string
  fecha_hora_huso_gen: string
  generado_at: string
  xml: string | null
  registro: RegistroAltaPersistido | RegistroAnulacionPersistido | null
}

/** Fila de sif_eventos tal cual se vuelca a eventos/eventos.json. */
export interface FilaEventoExport {
  correlativo: number | string
  tipo_evento: string
  datos: Record<string, unknown>
  primer_evento: boolean
  huella_anterior: string | null
  tipo_huella: string
  huella: string
  fecha_hora_huso_gen: string
  generado_at: string
}

export class ErrorExport extends Error {
  readonly codigo: string
  constructor(codigo: string, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorExport'
    this.codigo = codigo
  }
}

/** Un lote = un fichero XML RegFactuSistemaFacturacion dentro del ZIP. */
export interface LoteExport {
  fichero: string
  correlativoDesde: number
  correlativoHasta: number
  registros: number
  xml: string
}

/** Datos de un registro extraídos del XML exportado (para re-verificación). */
export interface RegistroExtraido {
  /** Posición 1..n dentro del conjunto exportado (orden de aparición). */
  posicion: number
  tipoRegistro: 'alta' | 'anulacion'
  idEmisorFactura: string
  numSerieFactura: string
  /** `dd-mm-aaaa` (formato oficial del XML). */
  fechaExpedicion: string
  tipoFactura: string | null
  cuotaTotal: string | null
  importeTotal: string | null
  primerRegistro: boolean
  huellaAnterior: string | null
  fechaHoraHusoGen: string
  tipoHuella: string
  huella: string
}

export type CodigoAnomaliaExport =
  | 'FORMATO_HUELLA'
  | 'HUELLA_NO_COINCIDE'
  | 'ENCADENADO_ROTO'
  | 'PRIMER_REGISTRO_INCOHERENTE'
  | 'FECHA_RETROCEDIDA'
  | 'FICHERO_MANIPULADO'
  | 'MANIFIESTO_INCONSISTENTE'
  | 'EVENTOS_ENCADENADO_ROTO'

export interface AnomaliaExport {
  codigo: CodigoAnomaliaExport
  /** Posición del registro afectado en el export (null si afecta a un fichero). */
  posicion: number | null
  detalle: string
}

export interface InformeVerificacionExport {
  integra: boolean
  registros: number
  anomalias: AnomaliaExport[]
  primeraHuella: string | null
  ultimaHuella: string | null
  /**
   * Export parcial: huella del registro anterior al primero exportado
   * (ancla de la cadena; solo verificable hacia adelante). Null si el export
   * empieza en el primer registro de la cadena.
   */
  anclaHuellaAnterior: string | null
}

export interface ManifiestoExport {
  formato: string
  generadoEn: string
  aplicacion: {
    nombreSistemaInformatico: string
    idSistemaInformatico: string
    version: string
    productorNif: string
    productorNombreRazon: string
  }
  obligado: { nif: string; nombreRazon: string }
  alcance: {
    /** Filtro pedido (fecha de generación, corte en UTC), null = sin límite. */
    desde: string | null
    hasta: string | null
    correlativoDesde: number
    correlativoHasta: number
    /** true si el export empieza en el primer registro de la cadena. */
    desdePrimerRegistro: boolean
    /** true si el export llega al último registro de la cadena en BD. */
    hastaUltimoRegistro: boolean
  }
  registros: {
    total: number
    altas: number
    anulaciones: number
    primeraHuella: string | null
    ultimaHuella: string | null
  }
  lotes: Array<{
    fichero: string
    registros: number
    correlativoDesde: number
    correlativoHasta: number
    sha256: string
  }>
  eventos: { fichero: string; total: number; sha256: string } | null
  /** Verificación de la cadena hecha sobre los ficheros YA generados. */
  verificacion: { integra: boolean; anomalias: AnomaliaExport[]; verificadoEn: string }
  normativa: string[]
}

export interface ResultadoExport {
  zip: Uint8Array
  nombreFichero: string
  manifiesto: ManifiestoExport
  /** Re-verificación de huellas hecha sobre el ZIP final (fichero literal). */
  verificacionZip: InformeVerificacionExport
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export function sha256HexDe(contenido: string | Uint8Array): string {
  return createHash('sha256').update(contenido).digest('hex').toUpperCase()
}

/** `sif_registros.xml` si está fijado; si no, reconstrucción determinista
 *  desde el jsonb. En ambos casos la huella del fragmento debe ser la de la
 *  fila (LÍNEA ROJA: no se exporta un XML cuya huella no case). */
export function xmlDeFilaRegistro(fila: FilaRegistroExport): string {
  if (fila.xml && fila.xml.trim() !== '') return fila.xml
  if (!fila.registro) {
    throw new ErrorExport(
      'registro_sin_contenido',
      `Registro correlativo ${fila.correlativo}: sin XML fijado ni jsonb para reconstruirlo`
    )
  }
  const generado =
    fila.tipo_registro === 'alta'
      ? reconstruirRegistroAlta(fila.registro as RegistroAltaPersistido)
      : reconstruirRegistroAnulacion(fila.registro as RegistroAnulacionPersistido)
  if (generado.huella !== fila.huella) {
    throw new ErrorExport(
      'huella_divergente',
      `Registro correlativo ${fila.correlativo}: la huella reconstruida (${generado.huella}) no coincide con la almacenada (${fila.huella}); revisar integridad (V12) antes de exportar`
    )
  }
  return generado.xml
}

function nombreLote(indice: number): string {
  return `registros/registros-${String(indice + 1).padStart(5, '0')}.xml`
}

const PROLOGO_XML = '<?xml version="1.0" encoding="UTF-8"?>\n'

/** Trocea los registros (orden de correlativo) en lotes RegFactuSistemaFacturacion. */
export function construirLotesExport(
  cabecera: CabeceraRemision,
  filas: readonly FilaRegistroExport[],
  maxPorLote: number = REGISTROS_POR_LOTE
): LoteExport[] {
  if (maxPorLote < 1 || maxPorLote > REGISTROS_POR_LOTE) {
    throw new ErrorExport('lote_invalido', `maxPorLote debe estar entre 1 y ${REGISTROS_POR_LOTE}`)
  }
  const ordenadas = [...filas].sort((a, b) => Number(a.correlativo) - Number(b.correlativo))
  const lotes: LoteExport[] = []
  for (let i = 0; i < ordenadas.length; i += maxPorLote) {
    const tramo = ordenadas.slice(i, i + maxPorLote)
    const xml = PROLOGO_XML + xmlRegFactuSistemaFacturacion(cabecera, tramo.map(xmlDeFilaRegistro))
    lotes.push({
      fichero: nombreLote(lotes.length),
      correlativoDesde: Number(tramo[0].correlativo),
      correlativoHasta: Number(tramo[tramo.length - 1].correlativo),
      registros: tramo.length,
      xml,
    })
  }
  return lotes
}

// ---------------------------------------------------------------------------
// Extracción: del XML exportado a los datos que entran en la huella
// ---------------------------------------------------------------------------

function extraerEncadenamiento(
  el: ElementoXml,
  contexto: string
): { primerRegistro: boolean; huellaAnterior: string | null } {
  const enc = hijo(el, 'Encadenamiento')
  if (!enc) throw new ErrorExport('xml_invalido', `falta Encadenamiento en ${contexto}`)
  if ((textoDe(enc, 'PrimerRegistro') ?? '').trim() === 'S') {
    return { primerRegistro: true, huellaAnterior: null }
  }
  const anterior = hijo(enc, 'RegistroAnterior')
  if (!anterior) {
    throw new ErrorExport('xml_invalido', `Encadenamiento sin PrimerRegistro ni RegistroAnterior en ${contexto}`)
  }
  return { primerRegistro: false, huellaAnterior: textoObligatorio(anterior, 'Huella', contexto) }
}

/**
 * Extrae de un mensaje `RegFactuSistemaFacturacion` los campos de cada
 * registro que entran en la huella oficial, más su encadenamiento.
 */
export function extraerRegistrosDeEnvio(xml: string): {
  obligado: { nif: string; nombreRazon: string }
  registros: RegistroExtraido[]
} {
  const raiz = parsearXml(xml)
  if (raiz.nombre !== 'RegFactuSistemaFacturacion') {
    throw new ErrorExport('xml_invalido', `raíz «${raiz.nombre}», se esperaba RegFactuSistemaFacturacion`)
  }
  const cabecera = hijo(raiz, 'Cabecera')
  const obligadoEl = cabecera ? hijo(cabecera, 'ObligadoEmision') : null
  if (!obligadoEl) throw new ErrorExport('xml_invalido', 'falta Cabecera/ObligadoEmision')
  const obligado = {
    nif: textoObligatorio(obligadoEl, 'NIF', 'ObligadoEmision'),
    nombreRazon: textoObligatorio(obligadoEl, 'NombreRazon', 'ObligadoEmision'),
  }

  const registros: RegistroExtraido[] = []
  for (const envoltura of hijosDe(raiz, 'RegistroFactura')) {
    const alta = hijo(envoltura, 'RegistroAlta')
    const anulacion = hijo(envoltura, 'RegistroAnulacion')
    const el = alta ?? anulacion
    if (!el) throw new ErrorExport('xml_invalido', 'RegistroFactura sin RegistroAlta ni RegistroAnulacion')
    const posicion = registros.length + 1
    const contexto = `registro ${posicion}`

    if (alta) {
      const idFactura = hijo(alta, 'IDFactura')
      if (!idFactura) throw new ErrorExport('xml_invalido', `falta IDFactura en ${contexto}`)
      registros.push({
        posicion,
        tipoRegistro: 'alta',
        idEmisorFactura: textoObligatorio(idFactura, 'IDEmisorFactura', contexto),
        numSerieFactura: textoObligatorio(idFactura, 'NumSerieFactura', contexto),
        fechaExpedicion: textoObligatorio(idFactura, 'FechaExpedicionFactura', contexto),
        tipoFactura: textoDe(alta, 'TipoFactura'),
        cuotaTotal: textoDe(alta, 'CuotaTotal'),
        importeTotal: textoDe(alta, 'ImporteTotal'),
        ...extraerEncadenamiento(alta, contexto),
        fechaHoraHusoGen: textoObligatorio(alta, 'FechaHoraHusoGenRegistro', contexto),
        tipoHuella: textoObligatorio(alta, 'TipoHuella', contexto),
        huella: textoObligatorio(alta, 'Huella', contexto),
      })
    } else {
      // En el XSD el contenedor se llama IDFactura también en la anulación;
      // son sus hijos los que llevan el sufijo «Anulada».
      const idFactura = hijo(anulacion!, 'IDFactura')
      if (!idFactura) throw new ErrorExport('xml_invalido', `falta IDFactura en ${contexto}`)
      registros.push({
        posicion,
        tipoRegistro: 'anulacion',
        idEmisorFactura: textoObligatorio(idFactura, 'IDEmisorFacturaAnulada', contexto),
        numSerieFactura: textoObligatorio(idFactura, 'NumSerieFacturaAnulada', contexto),
        fechaExpedicion: textoObligatorio(idFactura, 'FechaExpedicionFacturaAnulada', contexto),
        tipoFactura: null,
        cuotaTotal: null,
        importeTotal: null,
        ...extraerEncadenamiento(anulacion!, contexto),
        fechaHoraHusoGen: textoObligatorio(anulacion!, 'FechaHoraHusoGenRegistro', contexto),
        tipoHuella: textoObligatorio(anulacion!, 'TipoHuella', contexto),
        huella: textoObligatorio(anulacion!, 'Huella', contexto),
      })
    }
  }
  return { obligado, registros }
}

// ---------------------------------------------------------------------------
// Re-verificación de huellas sobre lo exportado (independiente de la BD)
// ---------------------------------------------------------------------------

export interface OpcionesVerificacionExport {
  /** Última huella que debería tener el conjunto (p. ej. la del manifiesto). */
  ultimaHuellaEsperada?: string | null
  /** true si el export debe empezar en el primer registro de la cadena. */
  debeSerDesdePrimerRegistro?: boolean
}

/**
 * Re-verifica un conjunto de registros extraídos del XML exportado:
 * recalcula cada huella con la fórmula oficial (doc. AEAT «huella/hash»
 * v0.1.2, librería V04) y comprueba el encadenamiento entre registros
 * consecutivos. En exports parciales la huella del primer registro se
 * verifica contra su ancla declarada (RegistroAnterior/Huella).
 */
export function verificarRegistrosExtraidos(
  registros: readonly RegistroExtraido[],
  opciones: OpcionesVerificacionExport = {}
): InformeVerificacionExport {
  const anomalias: AnomaliaExport[] = []
  let previo: RegistroExtraido | null = null

  for (const reg of registros) {
    const anota = (codigo: CodigoAnomaliaExport, detalle: string) =>
      anomalias.push({ codigo, posicion: reg.posicion, detalle })

    // Encadenamiento con el registro anterior del propio export
    if (previo === null) {
      if (opciones.debeSerDesdePrimerRegistro && !reg.primerRegistro) {
        anota('PRIMER_REGISTRO_INCOHERENTE', 'El export debía empezar en el primer registro de la cadena y no lo hace')
      }
    } else {
      if (reg.primerRegistro) {
        anota('PRIMER_REGISTRO_INCOHERENTE', 'Registro marcado PrimerRegistro=S en mitad del export')
      } else if ((reg.huellaAnterior ?? '') !== previo.huella) {
        anota(
          'ENCADENADO_ROTO',
          `RegistroAnterior/Huella «${reg.huellaAnterior ?? ''}» no coincide con la huella del registro ${previo.posicion} «${previo.huella}»`
        )
      }
    }

    // Huella: formato + recálculo oficial con su ancla declarada
    if (!esHuellaValida(reg.huella)) {
      anota('FORMATO_HUELLA', `Huella con formato inválido: «${reg.huella}»`)
    } else {
      const recalculada =
        reg.tipoRegistro === 'alta'
          ? huellaAlta(
              {
                IDEmisorFactura: reg.idEmisorFactura,
                NumSerieFactura: reg.numSerieFactura,
                FechaExpedicionFactura: reg.fechaExpedicion,
                TipoFactura: reg.tipoFactura ?? '',
                CuotaTotal: reg.cuotaTotal ?? '',
                ImporteTotal: reg.importeTotal ?? '',
                FechaHoraHusoGenRegistro: reg.fechaHoraHusoGen,
              },
              reg.huellaAnterior
            )
          : huellaAnulacion(
              {
                IDEmisorFacturaAnulada: reg.idEmisorFactura,
                NumSerieFacturaAnulada: reg.numSerieFactura,
                FechaExpedicionFacturaAnulada: reg.fechaExpedicion,
                FechaHoraHusoGenRegistro: reg.fechaHoraHusoGen,
              },
              reg.huellaAnterior
            )
      if (recalculada !== reg.huella) {
        anota('HUELLA_NO_COINCIDE', `Huella recalculada «${recalculada}» ≠ huella del fichero «${reg.huella}»`)
      }
    }

    // Trazabilidad de fechas de generación dentro del export
    if (previo !== null) {
      const fechaGen = Date.parse(reg.fechaHoraHusoGen)
      const fechaPrev = Date.parse(previo.fechaHoraHusoGen)
      if (Number.isFinite(fechaGen) && Number.isFinite(fechaPrev) && fechaGen < fechaPrev) {
        anota(
          'FECHA_RETROCEDIDA',
          `FechaHoraHusoGenRegistro «${reg.fechaHoraHusoGen}» anterior a la del registro previo «${previo.fechaHoraHusoGen}»`
        )
      }
    }

    previo = reg
  }

  const primera = registros.length > 0 ? registros[0] : null
  const ultima = registros.length > 0 ? registros[registros.length - 1] : null
  if (
    opciones.ultimaHuellaEsperada !== undefined &&
    (ultima?.huella ?? null) !== opciones.ultimaHuellaEsperada
  ) {
    anomalias.push({
      codigo: 'MANIFIESTO_INCONSISTENTE',
      posicion: null,
      detalle: `La última huella del export «${ultima?.huella ?? ''}» no coincide con la esperada «${opciones.ultimaHuellaEsperada ?? ''}»`,
    })
  }

  return {
    integra: anomalias.length === 0,
    registros: registros.length,
    anomalias,
    primeraHuella: primera?.huella ?? null,
    ultimaHuella: ultima?.huella ?? null,
    anclaHuellaAnterior: primera && !primera.primerRegistro ? primera.huellaAnterior : null,
  }
}

/**
 * Verificación de los eventos volcados: formato de huella y continuidad de su
 * cadena propia (huella_anterior de cada evento = huella del anterior). La
 * huella de los eventos no se recalcula aquí: es interna (Kuentas v1 es
 * VERI*FACTU y está exenta de eventos, art. 3 Orden) y se recalcula en BD
 * (sif_registrar_evento) y en el verificador V12.
 */
export function verificarEventosExportados(eventos: readonly FilaEventoExport[]): AnomaliaExport[] {
  const anomalias: AnomaliaExport[] = []
  const ordenados = [...eventos].sort((a, b) => Number(a.correlativo) - Number(b.correlativo))
  let previo: FilaEventoExport | null = null
  for (const ev of ordenados) {
    if (!esHuellaValida(ev.huella)) {
      anomalias.push({
        codigo: 'EVENTOS_ENCADENADO_ROTO',
        posicion: Number(ev.correlativo),
        detalle: `Evento ${ev.correlativo}: huella con formato inválido`,
      })
    }
    if (
      previo !== null &&
      Number(ev.correlativo) === Number(previo.correlativo) + 1 &&
      (ev.huella_anterior ?? '') !== previo.huella
    ) {
      anomalias.push({
        codigo: 'EVENTOS_ENCADENADO_ROTO',
        posicion: Number(ev.correlativo),
        detalle: `Evento ${ev.correlativo}: huella_anterior no coincide con la huella del evento ${previo.correlativo}`,
      })
    }
    previo = ev
  }
  return anomalias
}

// ---------------------------------------------------------------------------
// Manifiesto, LEEME y ZIP
// ---------------------------------------------------------------------------

const NORMATIVA = [
  'RD 1007/2023 (RRSIF), art. 8: integridad, conservación, accesibilidad y legibilidad',
  'Orden HAC/1177/2024, art. 8: conservación y exportación por períodos manteniendo estructura y formato de los arts. 10 y 11',
  'Orden HAC/1177/2024, art. 18: remisión por requerimiento con la estructura de VERI*FACTU',
  'RD 1619/2012, arts. 19-20: plazo de conservación de facturas y matrices',
]

function textoLeeme(manifiesto: ManifiestoExport): string {
  const m = manifiesto
  return [
    'EXPORT DE REGISTROS DE FACTURACIÓN VERI*FACTU — Kuentas',
    '========================================================',
    '',
    `Obligado tributario : ${m.obligado.nombreRazon} (NIF ${m.obligado.nif})`,
    `Generado            : ${m.generadoEn}`,
    `Registros           : ${m.registros.total} (${m.registros.altas} altas, ${m.registros.anulaciones} anulaciones), correlativos ${m.alcance.correlativoDesde}-${m.alcance.correlativoHasta}`,
    `Período solicitado  : ${m.alcance.desde ?? 'inicio'} → ${m.alcance.hasta ?? 'fin'} (fecha de generación del registro, corte en UTC)`,
    '',
    'CONTENIDO',
    '  manifest.json                  Metadatos del export y SHA-256 de cada fichero.',
    '  registros/registros-NNNNN.xml  Registros de facturación en el formato oficial de',
    '                                 remisión (RegFactuSistemaFacturacion, SuministroLR.xsd,',
    '                                 sede AEAT), en lotes de hasta 1000 registros y en el',
    '                                 orden de la cadena de huellas (art. 7 Orden HAC/1177/2024).',
    m.eventos ? '  eventos/eventos.json           Eventos internos del SIF con su cadena de huellas.' : null,
    '',
    'VERIFICACIÓN',
    '  Cada registro lleva su huella SHA-256 encadenada (art. 12 RD 1007/2023). La',
    '  integridad de este export puede re-verificarse recalculando las huellas según el',
    '  documento «Especificaciones técnicas para generación de la huella» de la sede AEAT,',
    '  o con la herramienta de Kuentas: npm run verifactu:exportar -- --verificar <este ZIP>.',
    `  Verificación en origen: ${m.verificacion.integra ? 'ÍNTEGRA (sin anomalías)' : `CON ANOMALÍAS (${m.verificacion.anomalias.length})`}.`,
    '',
    'NORMATIVA',
    ...m.normativa.map((n) => `  - ${n}`),
    '',
    'Los registros de facturación son inmutables: este export es una copia para',
    'conservación (art. 8 Orden HAC/1177/2024); los originales permanecen en Kuentas.',
    '',
  ]
    .filter((l): l is string => l !== null)
    .join('\n')
}

export interface OpcionesExport {
  /** Fecha mínima de generación (YYYY-MM-DD, corte en UTC). */
  desde?: string | null
  /** Fecha máxima de generación (YYYY-MM-DD, inclusive, corte en UTC). */
  hasta?: string | null
  /** Incluir el volcado de eventos internos del SIF (por defecto sí). */
  incluirEventos?: boolean
  /** Tamaño de lote (1..1000, por defecto 1000; los tests usan valores pequeños). */
  maxPorLote?: number
  /** Fecha «ahora» inyectable para tests. */
  ahora?: Date
}

const RE_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

function marcaTiempoCompacta(fecha: Date): string {
  return fecha.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')
}

const PAGINA_BD = 1000

async function cargarRegistrosExport(
  supabase: SupabaseClient,
  userId: string,
  correlativoDesde: number | null,
  correlativoHasta: number | null
): Promise<FilaRegistroExport[]> {
  const filas: FilaRegistroExport[] = []
  for (let desde = 0; ; desde += PAGINA_BD) {
    let query = supabase
      .from('sif_registros')
      .select(
        'id, correlativo, tipo_registro, id_emisor_factura, num_serie_factura, fecha_expedicion, tipo_factura, primer_registro, huella_anterior, huella, fecha_hora_huso_gen, generado_at, xml, registro'
      )
      .eq('user_id', userId)
      .order('correlativo', { ascending: true })
      .range(desde, desde + PAGINA_BD - 1)
    if (correlativoDesde !== null) query = query.gte('correlativo', correlativoDesde)
    if (correlativoHasta !== null) query = query.lte('correlativo', correlativoHasta)
    const { data, error } = await query
    if (error) throw new ErrorExport('bd_registros', `Error leyendo sif_registros: ${error.message}`)
    const pagina = (data ?? []) as unknown as FilaRegistroExport[]
    filas.push(...pagina)
    if (pagina.length < PAGINA_BD) break
  }
  return filas
}

/** Resuelve el filtro de fechas a un tramo CONTIGUO de correlativos. */
async function resolverTramoCorrelativos(
  supabase: SupabaseClient,
  userId: string,
  desde: string | null,
  hasta: string | null
): Promise<{ correlativoDesde: number | null; correlativoHasta: number | null }> {
  let correlativoDesde: number | null = null
  let correlativoHasta: number | null = null
  if (desde) {
    const { data, error } = await supabase
      .from('sif_registros')
      .select('correlativo')
      .eq('user_id', userId)
      .gte('generado_at', `${desde}T00:00:00Z`)
      .order('correlativo', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw new ErrorExport('bd_registros', `Error resolviendo «desde»: ${error.message}`)
    if (!data) return { correlativoDesde: -1, correlativoHasta: -1 } // nada en el período
    correlativoDesde = Number((data as { correlativo: number | string }).correlativo)
  }
  if (hasta) {
    const { data, error } = await supabase
      .from('sif_registros')
      .select('correlativo')
      .eq('user_id', userId)
      .lte('generado_at', `${hasta}T23:59:59.999Z`)
      .order('correlativo', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new ErrorExport('bd_registros', `Error resolviendo «hasta»: ${error.message}`)
    if (!data) return { correlativoDesde: -1, correlativoHasta: -1 }
    correlativoHasta = Number((data as { correlativo: number | string }).correlativo)
  }
  return { correlativoDesde, correlativoHasta }
}

async function cargarEventosExport(
  supabase: SupabaseClient,
  userId: string,
  desde: string | null,
  hasta: string | null
): Promise<FilaEventoExport[]> {
  const filas: FilaEventoExport[] = []
  for (let ini = 0; ; ini += PAGINA_BD) {
    let query = supabase
      .from('sif_eventos')
      .select('correlativo, tipo_evento, datos, primer_evento, huella_anterior, tipo_huella, huella, fecha_hora_huso_gen, generado_at')
      .eq('user_id', userId)
      .order('correlativo', { ascending: true })
      .range(ini, ini + PAGINA_BD - 1)
    if (desde) query = query.gte('generado_at', `${desde}T00:00:00Z`)
    if (hasta) query = query.lte('generado_at', `${hasta}T23:59:59.999Z`)
    const { data, error } = await query
    if (error) throw new ErrorExport('bd_eventos', `Error leyendo sif_eventos: ${error.message}`)
    const pagina = (data ?? []) as unknown as FilaEventoExport[]
    filas.push(...pagina)
    if (pagina.length < PAGINA_BD) break
  }
  return filas
}

/**
 * Construye el export completo (lotes XML + manifiesto + LEEME + eventos) a
 * partir de filas ya cargadas. Función pura respecto de la BD: testeable.
 */
export async function construirExport(
  config: Pick<FilaSifConfig, 'nif_obligado' | 'nombre_razon' | 'numero_instalacion'>,
  filas: readonly FilaRegistroExport[],
  eventos: readonly FilaEventoExport[],
  opciones: OpcionesExport & {
    /** Última huella de sif_cadena (para detectar exports «hasta el final» desincronizados). */
    ultimaHuellaCadena?: string | null
  } = {}
): Promise<ResultadoExport> {
  if (filas.length === 0) {
    throw new ErrorExport('sin_registros', 'No hay registros de facturación en el período solicitado')
  }
  const ahora = opciones.ahora ?? new Date()
  const cabecera: CabeceraRemision = {
    obligadoEmision: { nif: config.nif_obligado, nombreRazon: config.nombre_razon },
  }
  const lotes = construirLotesExport(cabecera, filas, opciones.maxPorLote ?? REGISTROS_POR_LOTE)

  // Re-verificación sobre los ficheros YA generados (roundtrip XML → huellas)
  const extraidos: RegistroExtraido[] = []
  for (const lote of lotes) {
    const { registros } = extraerRegistrosDeEnvio(lote.xml)
    for (const r of registros) extraidos.push({ ...r, posicion: extraidos.length + 1 })
  }
  const ordenadas = [...filas].sort((a, b) => Number(a.correlativo) - Number(b.correlativo))
  const primeraFila = ordenadas[0]
  const ultimaFila = ordenadas[ordenadas.length - 1]
  const hastaUltimoRegistro =
    opciones.ultimaHuellaCadena !== undefined && opciones.ultimaHuellaCadena !== null
      ? ultimaFila.huella === opciones.ultimaHuellaCadena
      : false
  const verificacion = verificarRegistrosExtraidos(extraidos, {
    ultimaHuellaEsperada: ultimaFila.huella,
    debeSerDesdePrimerRegistro: primeraFila.primer_registro,
  })
  const anomaliasEventos = verificarEventosExportados(eventos)
  verificacion.anomalias.push(...anomaliasEventos)
  verificacion.integra = verificacion.anomalias.length === 0

  const sistema = sistemaInformaticoKuentas(config.numero_instalacion)
  const eventosJson = eventos.length > 0 ? JSON.stringify({ formato: FORMATO_EXPORT, eventos }, null, 2) : null

  const manifiesto: ManifiestoExport = {
    formato: FORMATO_EXPORT,
    generadoEn: ahora.toISOString(),
    aplicacion: {
      nombreSistemaInformatico: sistema.nombreSistemaInformatico,
      idSistemaInformatico: sistema.idSistemaInformatico,
      version: sistema.version,
      productorNif: sistema.nif,
      productorNombreRazon: sistema.nombreRazon,
    },
    obligado: { nif: config.nif_obligado, nombreRazon: config.nombre_razon },
    alcance: {
      desde: opciones.desde ?? null,
      hasta: opciones.hasta ?? null,
      correlativoDesde: Number(primeraFila.correlativo),
      correlativoHasta: Number(ultimaFila.correlativo),
      desdePrimerRegistro: primeraFila.primer_registro,
      hastaUltimoRegistro,
    },
    registros: {
      total: filas.length,
      altas: ordenadas.filter((f) => f.tipo_registro === 'alta').length,
      anulaciones: ordenadas.filter((f) => f.tipo_registro === 'anulacion').length,
      primeraHuella: primeraFila.huella,
      ultimaHuella: ultimaFila.huella,
    },
    lotes: lotes.map((l) => ({
      fichero: l.fichero,
      registros: l.registros,
      correlativoDesde: l.correlativoDesde,
      correlativoHasta: l.correlativoHasta,
      sha256: sha256HexDe(l.xml),
    })),
    eventos: eventosJson
      ? { fichero: 'eventos/eventos.json', total: eventos.length, sha256: sha256HexDe(eventosJson) }
      : null,
    verificacion: {
      integra: verificacion.integra,
      anomalias: verificacion.anomalias,
      verificadoEn: ahora.toISOString(),
    },
    normativa: NORMATIVA,
  }

  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(manifiesto, null, 2))
  zip.file('LEEME.txt', textoLeeme(manifiesto))
  for (const lote of lotes) zip.file(lote.fichero, lote.xml)
  if (eventosJson) zip.file('eventos/eventos.json', eventosJson)
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })

  const nombreFichero = `verifactu-export-${config.nif_obligado}-${manifiesto.alcance.correlativoDesde}-${manifiesto.alcance.correlativoHasta}-${marcaTiempoCompacta(ahora)}.zip`

  // Re-verificación LITERAL sobre el fichero final (lo que descarga el usuario)
  const verificacionZip = await verificarZipExport(bytes)

  return { zip: bytes, nombreFichero, manifiesto, verificacionZip }
}

/**
 * Exporta los registros de facturación (y eventos) de un obligado leyendo de
 * la BD con el cliente dado (con sesión de usuario basta: RLS «select own»).
 */
export async function exportarObligado(
  supabase: SupabaseClient,
  userId: string,
  opciones: OpcionesExport = {}
): Promise<ResultadoExport> {
  const desde = opciones.desde ?? null
  const hasta = opciones.hasta ?? null
  if (desde && !RE_FECHA_ISO.test(desde)) throw new ErrorExport('fecha_invalida', `«desde» debe ser YYYY-MM-DD (recibido «${desde}»)`)
  if (hasta && !RE_FECHA_ISO.test(hasta)) throw new ErrorExport('fecha_invalida', `«hasta» debe ser YYYY-MM-DD (recibido «${hasta}»)`)
  if (desde && hasta && desde > hasta) throw new ErrorExport('fecha_invalida', '«desde» no puede ser posterior a «hasta»')

  const config = await cargarConfig(supabase, userId)
  if (!config) throw new ErrorExport('sin_config', 'El obligado no tiene configuración Verifactu (sif_config)')

  const tramo = await resolverTramoCorrelativos(supabase, userId, desde, hasta)
  if (tramo.correlativoDesde === -1) {
    throw new ErrorExport('sin_registros', 'No hay registros de facturación en el período solicitado')
  }
  const filas = await cargarRegistrosExport(supabase, userId, tramo.correlativoDesde, tramo.correlativoHasta)

  const { data: cadena, error: errCadena } = await supabase
    .from('sif_cadena')
    .select('ultima_huella')
    .eq('user_id', userId)
    .maybeSingle()
  if (errCadena) throw new ErrorExport('bd_cadena', `Error leyendo sif_cadena: ${errCadena.message}`)

  const eventos =
    opciones.incluirEventos === false ? [] : await cargarEventosExport(supabase, userId, desde, hasta)

  return construirExport(config, filas, eventos, {
    ...opciones,
    desde,
    hasta,
    ultimaHuellaCadena: (cadena as { ultima_huella: string | null } | null)?.ultima_huella ?? null,
  })
}

// ---------------------------------------------------------------------------
// Verificación de un fichero de export ya generado (ZIP)
// ---------------------------------------------------------------------------

export interface InformeZipExport extends InformeVerificacionExport {
  manifiesto: ManifiestoExport
  ficherosComprobados: number
}

/**
 * Re-verifica un fichero de export: contrasta el SHA-256 de cada fichero con
 * el manifiesto, re-extrae los registros de los lotes XML y recalcula toda la
 * cadena de huellas (verificarRegistrosExtraidos). Independiente de la BD.
 */
export async function verificarZipExport(zipBytes: Uint8Array): Promise<InformeZipExport> {
  const zip = await JSZip.loadAsync(zipBytes)
  const manifiestoFichero = zip.file('manifest.json')
  if (!manifiestoFichero) throw new ErrorExport('zip_invalido', 'El ZIP no contiene manifest.json')
  const manifiesto = JSON.parse(await manifiestoFichero.async('string')) as ManifiestoExport
  if (manifiesto.formato !== FORMATO_EXPORT) {
    throw new ErrorExport('zip_invalido', `Formato de export desconocido: «${manifiesto.formato}»`)
  }

  const anomalias: AnomaliaExport[] = []
  let ficherosComprobados = 0
  const extraidos: RegistroExtraido[] = []

  for (const lote of manifiesto.lotes) {
    const fichero = zip.file(lote.fichero)
    if (!fichero) {
      anomalias.push({ codigo: 'MANIFIESTO_INCONSISTENTE', posicion: null, detalle: `Falta el fichero ${lote.fichero} declarado en el manifiesto` })
      continue
    }
    const contenido = await fichero.async('string')
    ficherosComprobados++
    if (sha256HexDe(contenido) !== lote.sha256) {
      anomalias.push({ codigo: 'FICHERO_MANIPULADO', posicion: null, detalle: `${lote.fichero}: SHA-256 distinto del declarado en el manifiesto` })
      continue // un fichero manipulado no aporta registros fiables
    }
    const { registros } = extraerRegistrosDeEnvio(contenido)
    if (registros.length !== lote.registros) {
      anomalias.push({ codigo: 'MANIFIESTO_INCONSISTENTE', posicion: null, detalle: `${lote.fichero}: contiene ${registros.length} registros y el manifiesto declara ${lote.registros}` })
    }
    for (const r of registros) extraidos.push({ ...r, posicion: extraidos.length + 1 })
  }

  if (manifiesto.eventos) {
    const fichero = zip.file(manifiesto.eventos.fichero)
    if (!fichero) {
      anomalias.push({ codigo: 'MANIFIESTO_INCONSISTENTE', posicion: null, detalle: `Falta el fichero ${manifiesto.eventos.fichero} declarado en el manifiesto` })
    } else {
      const contenido = await fichero.async('string')
      ficherosComprobados++
      if (sha256HexDe(contenido) !== manifiesto.eventos.sha256) {
        anomalias.push({ codigo: 'FICHERO_MANIPULADO', posicion: null, detalle: `${manifiesto.eventos.fichero}: SHA-256 distinto del declarado en el manifiesto` })
      } else {
        const { eventos } = JSON.parse(contenido) as { eventos: FilaEventoExport[] }
        anomalias.push(...verificarEventosExportados(eventos))
        if (eventos.length !== manifiesto.eventos.total) {
          anomalias.push({ codigo: 'MANIFIESTO_INCONSISTENTE', posicion: null, detalle: `${manifiesto.eventos.fichero}: contiene ${eventos.length} eventos y el manifiesto declara ${manifiesto.eventos.total}` })
        }
      }
    }
  }

  const informe = verificarRegistrosExtraidos(extraidos, {
    ultimaHuellaEsperada: manifiesto.registros.ultimaHuella,
    debeSerDesdePrimerRegistro: manifiesto.alcance.desdePrimerRegistro,
  })
  if (extraidos.length !== manifiesto.registros.total) {
    anomalias.push({ codigo: 'MANIFIESTO_INCONSISTENTE', posicion: null, detalle: `El export contiene ${extraidos.length} registros y el manifiesto declara ${manifiesto.registros.total}` })
  }
  if (extraidos.length > 0 && (informe.primeraHuella ?? null) !== manifiesto.registros.primeraHuella) {
    anomalias.push({ codigo: 'MANIFIESTO_INCONSISTENTE', posicion: null, detalle: 'La primera huella del export no coincide con la declarada en el manifiesto' })
  }

  const todas = [...anomalias, ...informe.anomalias]
  return {
    ...informe,
    anomalias: todas,
    integra: todas.length === 0,
    manifiesto,
    ficherosComprobados,
  }
}
