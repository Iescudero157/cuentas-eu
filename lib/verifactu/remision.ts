// ---------------------------------------------------------------------------
// V10 · Worker de remisión VERI*FACTU (outbox → AEAT).
//
// Orquesta la cola sif_outbox contra las funciones SQL atómicas de la
// migración 20260918100000_sif_remision.sql:
//   1. sif_remision_pendientes()  → obligados con trabajo listo (el control de
//      flujo TiempoEsperaEnvio y el circuit breaker se aplican en SQL).
//   2. sif_outbox_reclamar_lote() → reclama ≤1000 registros (art. 16 Orden).
//   3. Construye el mensaje RegFactuSistemaFacturacion (XML fijado en la
//      emisión o regenerado determinista desde el jsonb, verificando huella)
//      y lo remite con el cliente SOAP de V09 (mTLS).
//   4. sif_outbox_resolver_lote() con la respuesta parseada (estados internos
//      SPEC §5.5, duplicados idempotentes §5.4, CSV, TiempoEsperaEnvio) o
//      sif_outbox_fallar_lote() si no hubo respuesta interpretable (backoff
//      exponencial cap 60 min, incidencia=S, breaker).
//
// Lo ejecuta el cron de Vercel (app/api/cron/verifactu-remision). La emisión
// de facturas NUNCA se detiene por fallos de remisión (art. 16 Orden).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  ClienteAeat,
  ErrorHttpAeat,
  ErrorRespuestaAeat,
  ErrorSoapAeat,
  ErrorTransporteAeat,
  estadoInternoLinea,
  estadoSiDuplicado,
  type RespuestaLinea,
  type RespuestaRegFactu,
} from './aeat-cliente.ts'
import type { CabeceraRemision } from './registro-alta.ts'
import {
  reconstruirRegistroAlta,
  reconstruirRegistroAnulacion,
  type RegistroAltaPersistido,
  type RegistroAnulacionPersistido,
} from './emision.ts'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Fila devuelta por la RPC sif_outbox_reclamar_lote. */
export interface FilaLote {
  outbox_id: string
  lote_id: string
  registro_id: string
  tipo_registro: 'alta' | 'anulacion'
  num_serie_factura: string
  /** Fecha ISO `aaaa-mm-dd` (columna date de Postgres). */
  fecha_expedicion: string
  intentos: number
  incidencia: boolean
  xml: string | null
  registro: RegistroAltaPersistido | RegistroAnulacionPersistido
  huella: string
}

/** Estado interno de un registro tras la respuesta AEAT (SPEC §5.5). */
export type EstadoInterno = 'accepted' | 'accepted_with_errors' | 'rejected'

/** Línea que consume la RPC sif_outbox_resolver_lote. */
export interface LineaResuelta {
  registro_id: string
  estado: EstadoInterno
  codigo_error: string | null
  descripcion: string | null
  respuesta: RespuestaLinea | null
}

export interface ResumenObligado {
  userId: string
  lote: string | null
  enviados: number
  aceptados: number
  aceptadosConErrores: number
  rechazados: number
  sinRespuesta: number
  estadoEnvio?: RespuestaRegFactu['estadoEnvio']
  csv?: string
  tiempoEsperaEnvio?: number
  error?: string
  reintentable?: boolean
  /** El obligado se OMITIÓ sin tocar su cola (p. ej. sin certificado, V11). */
  motivo?: string
}

export interface ResumenRemision {
  obligados: ResumenObligado[]
  totalEnviados: number
  totalErrores: number
  /** Obligados con trabajo pendiente omitidos por no tener cliente AEAT (V11). */
  totalOmitidos: number
}

/**
 * Resultado de la fábrica de clientes por obligado: el cliente listo, o el
 * motivo por el que no se puede remitir (sin certificado, caducado, custodia
 * sin configurar…). Con `null`/motivo la cola del obligado NO se toca: sigue
 * acumulando y se remitirá con Incidencia=S cuando haya certificado (art. 16
 * Orden HAC/1177/2024).
 */
export type ClienteObligado = ClienteAeat | { motivo: string } | null

export interface OpcionesRemision {
  /** Registros máximos por envío (1..1000, art. 16 Orden). Por defecto 1000. */
  maxPorLote?: number
}

// ---------------------------------------------------------------------------
// Funciones puras (testeables sin red ni base de datos)
// ---------------------------------------------------------------------------

/** `aaaa-mm-dd` → `dd-mm-aaaa` (formato oficial de IDFactura). */
export function fechaOficialDeIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) throw new Error(`Fecha ISO inválida «${iso}»`)
  return `${m[3]}-${m[2]}-${m[1]}`
}

/**
 * XML del registro a remitir. V24: el XML fijado (`sif_registros.xml`) se
 * trata como simple CACHÉ — `sif_fijar_xml` es invocable por `authenticated`
 * y no puede validar en SQL que el texto corresponda al registro, así que
 * SIEMPRE se regenera el XML determinista desde el jsonb persistido, se
 * verifica su huella contra la registrada y, si había XML fijado, se exige
 * que coincida byte a byte con el regenerado. Cualquier divergencia es una
 * manipulación o un fallo de integridad y el lote NO debe remitirse.
 */
export function xmlDeFila(fila: FilaLote): string {
  const generado =
    fila.tipo_registro === 'alta'
      ? reconstruirRegistroAlta(fila.registro as RegistroAltaPersistido)
      : reconstruirRegistroAnulacion(fila.registro as RegistroAnulacionPersistido)
  if (generado.huella !== fila.huella) {
    throw new Error(
      `Integridad: huella regenerada (${generado.huella}) ≠ huella registrada (${fila.huella}) en el registro ${fila.registro_id}`
    )
  }
  if (fila.xml && fila.xml !== generado.xml) {
    throw new Error(
      `Integridad: el XML fijado del registro ${fila.registro_id} no coincide con el regenerado desde el registro persistido (posible manipulación vía sif_fijar_xml)`
    )
  }
  return generado.xml
}

function claveIdFactura(nif: string, numSerie: string, fechaOficial: string): string {
  return `${nif.trim().toUpperCase()}|${numSerie.trim()}|${fechaOficial}`
}

/**
 * Casa cada fila del lote con su RespuestaLinea (por IDFactura) y calcula el
 * estado interno, tratando idempotentemente los rechazos por duplicado (SPEC
 * §5.4): si el registro ya estaba almacenado, el reenvío se da por completado
 * con el estado del registro almacenado (incluida una anulación ya Anulada).
 */
export function resolverLineas(
  filas: readonly FilaLote[],
  respuesta: RespuestaRegFactu,
  nifEmisor: string
): { lineas: LineaResuelta[]; sinRespuesta: FilaLote[] } {
  const porClave = new Map<string, RespuestaLinea>()
  for (const linea of respuesta.lineas) {
    porClave.set(
      claveIdFactura(
        linea.idFactura.idEmisorFactura,
        linea.idFactura.numSerieFactura,
        linea.idFactura.fechaExpedicionFactura
      ),
      linea
    )
  }

  const lineas: LineaResuelta[] = []
  const sinRespuesta: FilaLote[] = []
  for (const fila of filas) {
    const linea = porClave.get(
      claveIdFactura(nifEmisor, fila.num_serie_factura, fechaOficialDeIso(fila.fecha_expedicion))
    )
    if (!linea) {
      sinRespuesta.push(fila)
      continue
    }

    let estado: EstadoInterno = estadoInternoLinea(linea)
    if (estado === 'rejected') {
      const dup = estadoSiDuplicado(linea)
      if (dup) {
        estado = dup
      } else if (
        fila.tipo_registro === 'anulacion' &&
        linea.registroDuplicado?.estadoRegistroDuplicado === 'Anulada'
      ) {
        // Reenvío de una anulación ya registrada: idempotente, completado.
        estado = 'accepted'
      }
    }

    lineas.push({
      registro_id: fila.registro_id,
      estado,
      codigo_error:
        estado === 'accepted' ? null : linea.codigoErrorRegistro?.toString() ?? null,
      descripcion: estado === 'accepted' ? null : linea.descripcionErrorRegistro ?? null,
      respuesta: linea,
    })
  }
  return { lineas, sinRespuesta }
}

/** Clasifica un error del envío: ¿merece reintento con backoff corto? */
export function esErrorReintentable(e: unknown): boolean {
  if (e instanceof ErrorTransporteAeat) return true
  if (e instanceof ErrorHttpAeat) return e.reintentable
  if (e instanceof ErrorSoapAeat) return false
  // Respuesta no interpretable: no sabemos si la AEAT registró el envío; el
  // reintento es seguro porque el tratamiento de duplicados es idempotente.
  if (e instanceof ErrorRespuestaAeat) return true
  return false
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

async function rpc<T>(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as T
}

/**
 * Remite UN lote del obligado: reclama, envía y cierra (resolver o fallar).
 * Devuelve null si no había nada que remitir (cola vacía, control de flujo o
 * circuit breaker). Nunca lanza por fallos del envío: los registra en la cola.
 */
export async function remitirObligado(
  supabase: SupabaseClient,
  cliente: ClienteAeat,
  userId: string,
  opciones: OpcionesRemision = {}
): Promise<ResumenObligado | null> {
  const filas = await rpc<FilaLote[]>(supabase, 'sif_outbox_reclamar_lote', {
    p_user_id: userId,
    p_max: opciones.maxPorLote ?? 1000,
  })
  if (!filas || filas.length === 0) return null

  const loteId = filas[0].lote_id
  const resumen: ResumenObligado = {
    userId,
    lote: loteId,
    enviados: filas.length,
    aceptados: 0,
    aceptadosConErrores: 0,
    rechazados: 0,
    sinRespuesta: 0,
  }

  const fallar = async (mensaje: string, reintentable: boolean) => {
    resumen.error = mensaje
    resumen.reintentable = reintentable
    await rpc<number>(supabase, 'sif_outbox_fallar_lote', {
      p_user_id: userId,
      p_lote_id: loteId,
      p_error: mensaje.slice(0, 2000),
      p_reintentable: reintentable,
    })
    return resumen
  }

  // Cabecera del envío desde sif_config (service_role: sin RLS)
  const { data: config, error: errConfig } = await supabase
    .from('sif_config')
    .select('nif_obligado, nombre_razon')
    .eq('user_id', userId)
    .maybeSingle()
  if (errConfig || !config) {
    return fallar(`No se pudo leer sif_config del obligado: ${errConfig?.message ?? 'sin datos'}`, true)
  }

  // XML de cada registro (fijado o regenerado con verificación de huella)
  let registrosXml: string[]
  try {
    registrosXml = filas.map(xmlDeFila)
  } catch (e) {
    // Integridad rota: NO remitir; queda en cola con backoff máximo para
    // revisión (V12) sin bloquear al resto de obligados.
    return fallar(e instanceof Error ? e.message : String(e), false)
  }

  const cabecera: CabeceraRemision = {
    obligadoEmision: { nombreRazon: config.nombre_razon, nif: config.nif_obligado },
    // Art. 16 Orden: los registros generados/retenidos durante una incidencia
    // se remiten marcando Incidencia=S.
    ...(filas.some((f) => f.incidencia) ? { incidencia: 'S' as const } : {}),
  }

  let respuesta: RespuestaRegFactu
  try {
    respuesta = await cliente.enviarRegistros(cabecera, registrosXml)
  } catch (e) {
    return fallar(e instanceof Error ? e.message : String(e), esErrorReintentable(e))
  }

  const { lineas, sinRespuesta } = resolverLineas(filas, respuesta, config.nif_obligado)
  await rpc<number>(supabase, 'sif_outbox_resolver_lote', {
    p_user_id: userId,
    p_lote_id: loteId,
    p_estado_envio: respuesta.estadoEnvio,
    p_csv: respuesta.csv ?? null,
    p_tiempo_espera: respuesta.tiempoEsperaEnvio,
    p_lineas: lineas,
  })

  resumen.estadoEnvio = respuesta.estadoEnvio
  if (respuesta.csv) resumen.csv = respuesta.csv
  resumen.tiempoEsperaEnvio = respuesta.tiempoEsperaEnvio
  resumen.sinRespuesta = sinRespuesta.length
  for (const l of lineas) {
    if (l.estado === 'accepted') resumen.aceptados++
    else if (l.estado === 'accepted_with_errors') resumen.aceptadosConErrores++
    else resumen.rechazados++
  }
  return resumen
}

/**
 * Un tick del worker: procesa TODOS los obligados con trabajo listo (un lote
 * por obligado y tick: el control de flujo del art. 16 Orden impone ≥60 s
 * entre envíos del mismo obligado). Un fallo en un obligado no detiene a los
 * demás. `crearCliente` da el cliente de CADA obligado (su certificado de
 * custodia V11, o el global de plataforma como respaldo); si devuelve
 * null/motivo, ese obligado se omite sin tocar su cola.
 */
export async function procesarRemision(
  supabase: SupabaseClient,
  crearCliente: (userId: string) => ClienteObligado | Promise<ClienteObligado>,
  opciones: OpcionesRemision = {}
): Promise<ResumenRemision> {
  const pendientes = await rpc<Array<{ user_id: string; pendientes: number }>>(
    supabase,
    'sif_remision_pendientes',
    {}
  )

  const obligados: ResumenObligado[] = []
  for (const p of pendientes ?? []) {
    try {
      const cliente = await crearCliente(p.user_id)
      if (!cliente || !(cliente instanceof ClienteAeat)) {
        obligados.push({
          userId: p.user_id,
          lote: null,
          enviados: 0,
          aceptados: 0,
          aceptadosConErrores: 0,
          rechazados: 0,
          sinRespuesta: 0,
          motivo: cliente?.motivo ?? 'cliente AEAT no disponible para el obligado',
        })
        continue
      }
      const resumen = await remitirObligado(supabase, cliente, p.user_id, opciones)
      if (resumen) obligados.push(resumen)
    } catch (e) {
      // Error inesperado del propio worker (RPC caída, bug): se informa y se
      // sigue con el resto; las filas en_envio se rescatan a los 15 min.
      obligados.push({
        userId: p.user_id,
        lote: null,
        enviados: 0,
        aceptados: 0,
        aceptadosConErrores: 0,
        rechazados: 0,
        sinRespuesta: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return {
    obligados,
    totalEnviados: obligados.reduce((s, o) => s + o.enviados, 0),
    totalErrores: obligados.filter((o) => o.error).length,
    totalOmitidos: obligados.filter((o) => o.motivo).length,
  }
}
