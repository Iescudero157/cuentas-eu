// ---------------------------------------------------------------------------
// V12 · Verificador de integridad de la cadena de registros de facturación.
//
// Recorre los registros de un obligado (sif_registros, orden de correlativo) y
// comprueba, de forma INDEPENDIENTE de SQL (defensa en profundidad: recalcula
// las huellas con la librería V04, no con pgcrypto):
//   1. Huecos de correlativo (registros no anotados o desaparecidos).
//   2. Coherencia del primer registro (art. 7 Orden HAC/1177/2024).
//   3. Encadenamiento: huella_anterior de cada eslabón = huella del anterior.
//   4. Huella: recalculada desde los datos oficiales (fórmula del doc. AEAT
//      «Especificaciones huella/hash» v0.1.2) = huella almacenada.
//   5. Consistencia del contenido oficial (jsonb) con las columnas.
//   6. Trazabilidad de fechas (FechaHoraHusoGenRegistro no retrocede ni es
//      futura — anomalías 11/13 de EventosSIF.xsd).
//   7. Sincronía del puntero sif_cadena con el último registro real.
//
// La detección espejo en SQL es sif_detectar_anomalias() (migración
// 20260919100000_sif_incidencias.sql); el informe puede contrastar ambas.
// Anomalías → evento de incidencia en sif_eventos vía sif_registrar_evento()
// (tipos 03/04 de EventosSIF.xsd; internos: Kuentas v1 es VERI*FACTU y está
// exenta de eventos por el art. 3 de la Orden).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  esHuellaValida,
  formatearFechaExpedicion,
  formatearImporte,
  huellaAlta,
  huellaAnulacion,
} from './huella.ts'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Columnas de sif_registros que usa el verificador. */
export interface FilaRegistroIntegridad {
  id: string
  correlativo: number | string
  tipo_registro: 'alta' | 'anulacion'
  id_emisor_factura: string
  num_serie_factura: string
  /** `aaaa-mm-dd` (columna date). */
  fecha_expedicion: string
  tipo_factura: string | null
  cuota_total: number | string | null
  importe_total: number | string | null
  primer_registro: boolean
  huella_anterior: string | null
  huella: string
  fecha_hora_huso_gen: string
  registro: {
    huella?: string
    fechaHoraHusoGenRegistro?: string
    encadenamiento?:
      | { primerRegistro?: boolean }
      | { registroAnterior?: { huella?: string } }
  } | null
  estado_remision: string
}

/** Columnas de sif_cadena que usa el verificador. */
export interface FilaCadenaIntegridad {
  correlativo_ultimo: number | string
  ultima_huella: string | null
}

export type CodigoAnomalia =
  | 'HUECO_CORRELATIVO'
  | 'PRIMER_REGISTRO_INCOHERENTE'
  | 'ENCADENADO_ROTO'
  | 'FORMATO_HUELLA'
  | 'HUELLA_NO_COINCIDE'
  | 'JSONB_INCONSISTENTE'
  | 'FECHA_RETROCEDIDA'
  | 'FECHA_FUTURA'
  | 'CADENA_DESINCRONIZADA'

/**
 * TipoAnomaliaType oficial (EventosSIF.xsd) equivalente a cada código interno,
 * para el evento 04 «detección de anomalías en registros de facturación».
 */
export const TIPO_ANOMALIA_OFICIAL: Record<CodigoAnomalia, string> = {
  HUELLA_NO_COINCIDE: '01', //  Integridad-huella
  FORMATO_HUELLA: '03', //      Integridad - Otros
  JSONB_INCONSISTENTE: '03', // Integridad - Otros
  HUECO_CORRELATIVO: '04', //   Reg. no primero con reg. anterior no anotado o inexistente
  PRIMER_REGISTRO_INCOHERENTE: '06', // Trazabilidad-cadena-registro - Otros
  ENCADENADO_ROTO: '08', //     Campo huella-anterior no se corresponde con la huella del reg. anterior
  CADENA_DESINCRONIZADA: '10', // Trazabilidad-cadena - Otros
  FECHA_RETROCEDIDA: '11', //   Fecha-hora anterior a la del reg. anterior
  FECHA_FUTURA: '13', //        Fecha-hora de generación posterior a la actual del sistema
}

export interface AnomaliaIntegridad {
  codigo: CodigoAnomalia
  /** Correlativo del registro afectado (null si es la propia sif_cadena). */
  correlativo: number | null
  registroId: string | null
  detalle: string
}

export interface InformeIntegridad {
  userId: string
  registros: number
  integra: boolean
  anomalias: AnomaliaIntegridad[]
  ultimaHuella: string | null
  /** Anomalías del detector SQL (sif_detectar_anomalias), si se contrastó. */
  anomaliasSql?: Array<{ codigo: string; correlativo: number | null; detalle: string }>
  /** Eventos de incidencia anotados en sif_eventos (si se pidió). */
  eventosRegistrados?: number
}

// ---------------------------------------------------------------------------
// Verificación pura (testeable sin base de datos)
// ---------------------------------------------------------------------------

/** Margen para no marcar como «futura» una fecha por deriva de reloj. */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000

function huellaRecalculada(fila: FilaRegistroIntegridad): string {
  if (fila.tipo_registro === 'alta') {
    return huellaAlta(
      {
        IDEmisorFactura: fila.id_emisor_factura,
        NumSerieFactura: fila.num_serie_factura,
        FechaExpedicionFactura: formatearFechaExpedicion(fila.fecha_expedicion),
        TipoFactura: fila.tipo_factura ?? '',
        CuotaTotal: formatearImporte(fila.cuota_total ?? 0),
        ImporteTotal: formatearImporte(fila.importe_total ?? 0),
        FechaHoraHusoGenRegistro: fila.fecha_hora_huso_gen,
      },
      fila.huella_anterior
    )
  }
  return huellaAnulacion(
    {
      IDEmisorFacturaAnulada: fila.id_emisor_factura,
      NumSerieFacturaAnulada: fila.num_serie_factura,
      FechaExpedicionFacturaAnulada: formatearFechaExpedicion(fila.fecha_expedicion),
      FechaHoraHusoGenRegistro: fila.fecha_hora_huso_gen,
    },
    fila.huella_anterior
  )
}

function huellaDelJsonb(fila: FilaRegistroIntegridad): {
  huella?: string
  fechaHoraHusoGenRegistro?: string
} {
  return fila.registro ?? {}
}

/**
 * Verifica la cadena completa de un obligado. `filas` debe contener TODOS sus
 * registros (el verificador las ordena por correlativo). Devuelve TODAS las
 * anomalías encontradas; una cadena íntegra devuelve un array vacío.
 */
export function verificarRegistrosObligado(
  filas: readonly FilaRegistroIntegridad[],
  cadena: FilaCadenaIntegridad | null,
  opciones: { ahora?: Date } = {}
): { anomalias: AnomaliaIntegridad[]; ultimaHuella: string | null } {
  const anomalias: AnomaliaIntegridad[] = []
  const ahora = opciones.ahora ?? new Date()
  const ordenadas = [...filas].sort((a, b) => Number(a.correlativo) - Number(b.correlativo))

  let previa: FilaRegistroIntegridad | null = null
  for (const fila of ordenadas) {
    const correlativo = Number(fila.correlativo)
    const anota = (codigo: CodigoAnomalia, detalle: string) =>
      anomalias.push({ codigo, correlativo, registroId: fila.id, detalle })

    // 1. Huecos de correlativo
    const esperado = previa === null ? 1 : Number(previa.correlativo) + 1
    if (correlativo !== esperado) {
      anota(
        'HUECO_CORRELATIVO',
        `Faltan los correlativos ${esperado} a ${correlativo - 1} (registros no anotados o desaparecidos)`
      )
    }

    // 2. Coherencia del primer registro (art. 7 Orden)
    if (correlativo === 1 && previa === null) {
      if (!fila.primer_registro || (fila.huella_anterior ?? '') !== '') {
        anota(
          'PRIMER_REGISTRO_INCOHERENTE',
          'El primer registro de la cadena debe llevar primer_registro=true y huella_anterior vacía'
        )
      }
    } else if (fila.primer_registro) {
      anota('PRIMER_REGISTRO_INCOHERENTE', 'Registro marcado primer_registro en mitad de la cadena')
    }

    // 3. Encadenamiento con el eslabón anterior (solo si son contiguos: un
    //    hueco ya queda anotado arriba y rompe la comparación)
    if (previa !== null && correlativo === Number(previa.correlativo) + 1) {
      if ((fila.huella_anterior ?? '') !== previa.huella) {
        anota(
          'ENCADENADO_ROTO',
          `huella_anterior «${fila.huella_anterior ?? ''}» no coincide con la huella del registro ${previa.correlativo} «${previa.huella}»`
        )
      }
    }

    // 4. Huella: formato y recálculo con la librería oficial (V04)
    if (!esHuellaValida(fila.huella)) {
      anota('FORMATO_HUELLA', `Huella almacenada con formato inválido: «${fila.huella}»`)
    } else {
      const recalculada = huellaRecalculada(fila)
      if (recalculada !== fila.huella) {
        anota(
          'HUELLA_NO_COINCIDE',
          `Huella recalculada «${recalculada}» ≠ huella almacenada «${fila.huella}»`
        )
      }
    }

    // 5. Contenido oficial (jsonb) coherente con las columnas
    const jsonb = huellaDelJsonb(fila)
    if (
      (jsonb.huella ?? null) !== fila.huella ||
      (jsonb.fechaHoraHusoGenRegistro ?? null) !== fila.fecha_hora_huso_gen
    ) {
      anota(
        'JSONB_INCONSISTENTE',
        'El contenido oficial (jsonb) no coincide con las columnas del registro (huella o FechaHoraHusoGenRegistro)'
      )
    }

    // 6. Trazabilidad de fechas (anomalías 11/13 de EventosSIF.xsd)
    const fechaGen = Date.parse(fila.fecha_hora_huso_gen)
    if (Number.isFinite(fechaGen)) {
      if (previa !== null) {
        const fechaPrevia = Date.parse(previa.fecha_hora_huso_gen)
        if (Number.isFinite(fechaPrevia) && fechaGen < fechaPrevia) {
          anota(
            'FECHA_RETROCEDIDA',
            `FechaHoraHusoGenRegistro «${fila.fecha_hora_huso_gen}» anterior a la del registro previo «${previa.fecha_hora_huso_gen}»`
          )
        }
      }
      if (fechaGen > ahora.getTime() + TOLERANCIA_FUTURO_MS) {
        anota(
          'FECHA_FUTURA',
          `FechaHoraHusoGenRegistro «${fila.fecha_hora_huso_gen}» posterior a la hora actual del sistema`
        )
      }
    }

    previa = fila
  }

  // 7. Puntero de la cadena sincronizado con el último registro real
  const ultima = ordenadas.length > 0 ? ordenadas[ordenadas.length - 1] : null
  const maxCorrelativo = ultima ? Number(ultima.correlativo) : 0
  const ultimaHuella = ultima?.huella ?? null
  if (cadena === null) {
    if (ordenadas.length > 0) {
      anomalias.push({
        codigo: 'CADENA_DESINCRONIZADA',
        correlativo: null,
        registroId: null,
        detalle: `Hay ${ordenadas.length} registros pero el obligado no tiene fila en sif_cadena`,
      })
    }
  } else if (
    Number(cadena.correlativo_ultimo) !== maxCorrelativo ||
    (maxCorrelativo > 0 && cadena.ultima_huella !== ultimaHuella)
  ) {
    anomalias.push({
      codigo: 'CADENA_DESINCRONIZADA',
      correlativo: null,
      registroId: null,
      detalle: `sif_cadena apunta a correlativo ${cadena.correlativo_ultimo} / huella «${cadena.ultima_huella ?? ''}» pero los registros llegan a ${maxCorrelativo} / «${ultimaHuella ?? ''}»`,
    })
  }

  return { anomalias, ultimaHuella }
}

// ---------------------------------------------------------------------------
// Acceso a datos y eventos de incidencia
// ---------------------------------------------------------------------------

const COLUMNAS_REGISTRO =
  'id, correlativo, tipo_registro, id_emisor_factura, num_serie_factura, fecha_expedicion, tipo_factura, cuota_total, importe_total, primer_registro, huella_anterior, huella, fecha_hora_huso_gen, registro, estado_remision'

const PAGINA = 1000

async function cargarRegistros(
  supabase: SupabaseClient,
  userId: string
): Promise<FilaRegistroIntegridad[]> {
  const filas: FilaRegistroIntegridad[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from('sif_registros')
      .select(COLUMNAS_REGISTRO)
      .eq('user_id', userId)
      .order('correlativo', { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error) throw new Error(`Error leyendo sif_registros: ${error.message}`)
    const pagina = (data ?? []) as unknown as FilaRegistroIntegridad[]
    filas.push(...pagina)
    if (pagina.length < PAGINA) break
  }
  return filas
}

export interface OpcionesVerificacion {
  /** Contrastar con el detector SQL sif_detectar_anomalias (service_role). */
  contrastarSql?: boolean
  /**
   * Anotar eventos de incidencia en sif_eventos (service_role): un evento 03
   * (lanzamiento de la detección) por ejecución y un evento 04 por anomalía
   * (con tope, para no inundar la cadena de eventos).
   */
  registrarEventos?: boolean
  /** Máximo de eventos 04 por ejecución (por defecto 50). */
  maxEventosAnomalia?: number
}

/**
 * Verifica la integridad de la cadena de un obligado leyendo de la base de
 * datos. Con `registrarEventos` deja constancia en sif_eventos (art. 9 Orden;
 * registro interno: VERI*FACTU está exento de eventos por el art. 3).
 */
export async function verificarIntegridadObligado(
  supabase: SupabaseClient,
  userId: string,
  opciones: OpcionesVerificacion = {}
): Promise<InformeIntegridad> {
  const filas = await cargarRegistros(supabase, userId)

  const { data: cadenaData, error: errCadena } = await supabase
    .from('sif_cadena')
    .select('correlativo_ultimo, ultima_huella')
    .eq('user_id', userId)
    .maybeSingle()
  if (errCadena) throw new Error(`Error leyendo sif_cadena: ${errCadena.message}`)

  const { anomalias, ultimaHuella } = verificarRegistrosObligado(
    filas,
    (cadenaData as FilaCadenaIntegridad | null) ?? null
  )

  const informe: InformeIntegridad = {
    userId,
    registros: filas.length,
    integra: anomalias.length === 0,
    anomalias,
    ultimaHuella,
  }

  if (opciones.contrastarSql) {
    const { data, error } = await supabase.rpc('sif_detectar_anomalias', { p_user_id: userId })
    if (error) throw new Error(`sif_detectar_anomalias: ${error.message}`)
    informe.anomaliasSql = ((data ?? []) as Array<{ codigo: string; correlativo: number | null; detalle: string }>).map(
      (a) => ({ codigo: a.codigo, correlativo: a.correlativo, detalle: a.detalle })
    )
  }

  if (opciones.registrarEventos) {
    informe.eventosRegistrados = await registrarEventosDeteccion(supabase, userId, filas.length, anomalias, opciones)
  }

  return informe
}

/**
 * Anota en sif_eventos el lanzamiento de la detección (tipo 03) y una entrada
 * por anomalía (tipo 04, con tope). Los `datos` guardan el detalle interno y
 * el TipoAnomalia oficial de EventosSIF.xsd para el XML de V14.
 */
export async function registrarEventosDeteccion(
  supabase: SupabaseClient,
  userId: string,
  registrosProcesados: number,
  anomalias: readonly AnomaliaIntegridad[],
  opciones: Pick<OpcionesVerificacion, 'maxEventosAnomalia'> = {}
): Promise<number> {
  const rpc = async (tipo: string, datos: Record<string, unknown>) => {
    const { error } = await supabase.rpc('sif_registrar_evento', {
      p_user_id: userId,
      p_tipo_evento: tipo,
      p_datos: datos,
    })
    if (error) throw new Error(`sif_registrar_evento(${tipo}): ${error.message}`)
  }

  let registrados = 0
  await rpc('deteccion_anomalias_registros', {
    procesoIntegridadHuellas: 'S',
    numeroRegistrosIntegridadHuellas: registrosProcesados,
    procesoIntegridadFirmas: 'N', // sin firma en VERI*FACTU (art. 3 Orden)
    procesoTrazabilidadCadena: 'S',
    numeroRegistrosTrazabilidadCadena: registrosProcesados,
    procesoTrazabilidadFechas: 'S',
    numeroRegistrosTrazabilidadFechas: registrosProcesados,
    anomaliasDetectadas: anomalias.length,
  })
  registrados++

  const tope = opciones.maxEventosAnomalia ?? 50
  for (const anomalia of anomalias.slice(0, tope)) {
    await rpc('anomalia_registro', {
      tipoAnomalia: TIPO_ANOMALIA_OFICIAL[anomalia.codigo],
      codigoInterno: anomalia.codigo,
      correlativo: anomalia.correlativo,
      registroId: anomalia.registroId,
      detalle: anomalia.detalle.slice(0, 500),
    })
    registrados++
  }
  return registrados
}

/** Verifica todos los obligados con cadena iniciada. */
export async function verificarTodosLosObligados(
  supabase: SupabaseClient,
  opciones: OpcionesVerificacion = {}
): Promise<InformeIntegridad[]> {
  const { data, error } = await supabase.from('sif_cadena').select('user_id')
  if (error) throw new Error(`Error leyendo sif_cadena: ${error.message}`)
  const informes: InformeIntegridad[] = []
  for (const fila of (data ?? []) as Array<{ user_id: string }>) {
    informes.push(await verificarIntegridadObligado(supabase, fila.user_id, opciones))
  }
  return informes
}
