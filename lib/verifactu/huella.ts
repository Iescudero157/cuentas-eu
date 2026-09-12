// Huella («hash») encadenada de los registros de facturación Verifactu.
//
// Implementación EXACTA del documento oficial de la AEAT «Detalle de las
// especificaciones técnicas para generación de la huella o hash de los
// registros de facturación» (v0.1.2, 27/08/2024), que desarrolla el art. 13
// de la Orden HAC/1177/2024 y el art. 12 del RRSIF (RD 1007/2023).
// Diseño y citas completas: docs/verifactu/SPEC.md §4.
//
// Reglas del documento oficial:
//  - Algoritmo SHA-256 (único valor admitido de la lista L12: TipoHuella = "01").
//  - Entrada: cadena `Campo1=valor1&Campo2=valor2&...` en el ORDEN oficial,
//    codificada en UTF-8. Los valores son los del XML del registro, sin
//    espacios al inicio ni al final; campo ausente o vacío → `Campo=`.
//  - Salida: digest en hexadecimal, 64 caracteres, MAYÚSCULAS.
//  - La huella del registro anterior entra en la cadena (campo `Huella=`);
//    en el primer registro de la cadena va vacía (`Huella=`).
//
// Solo se usa `node:crypto` (síncrono, server-only). NO importar desde
// componentes cliente.

import { createHash } from 'node:crypto'

/** Único algoritmo admitido (lista L12 del anexo de la Orden HAC/1177/2024). */
export const TIPO_HUELLA_SHA256 = '01'

/** Formato de salida oficial: 64 caracteres hexadecimales en mayúsculas. */
export const HUELLA_REGEX = /^[0-9A-F]{64}$/

export function esHuellaValida(huella: string): boolean {
  return HUELLA_REGEX.test(huella)
}

/**
 * Campos de un registro de alta que entran en la huella (doc. AEAT §3.a),
 * con sus nombres oficiales del XML y en su orden. Los valores deben ser
 * EXACTAMENTE los que van en el XML del registro (mismos formatos):
 * fechas `dd-mm-aaaa`, importes con punto decimal, fecha-hora ISO 8601 con
 * huso (`2024-01-01T19:20:30+01:00`).
 */
export interface DatosHuellaAlta {
  IDEmisorFactura: string
  NumSerieFactura: string
  FechaExpedicionFactura: string
  TipoFactura: string
  CuotaTotal: string
  ImporteTotal: string
  FechaHoraHusoGenRegistro: string
}

/** Campos de un registro de anulación que entran en la huella (doc. AEAT §3.b). */
export interface DatosHuellaAnulacion {
  IDEmisorFacturaAnulada: string
  NumSerieFacturaAnulada: string
  FechaExpedicionFacturaAnulada: string
  FechaHoraHusoGenRegistro: string
}

/**
 * Campos de un registro de evento que entran en la huella (doc. AEAT §3.c).
 * `NIFSistemaInformatico`/`ID` son excluyentes (productor con NIF español o
 * IDOtro); ambos aparecen SIEMPRE en la cadena (vacío el que no aplique).
 * En el par de la cadena ambos usan su nombre oficial de campo XML: `NIF=` e `ID=`.
 */
export interface DatosHuellaEvento {
  /** RegistroEvento/Evento/SistemaInformatico/NIF */
  NIFSistemaInformatico: string
  /** RegistroEvento/Evento/SistemaInformatico/IDOtro/ID */
  ID: string
  IdSistemaInformatico: string
  Version: string
  NumeroInstalacion: string
  /** RegistroEvento/Evento/ObligadoEmision/NIF */
  NIFObligadoEmision: string
  TipoEvento: string
  FechaHoraHusoGenEvento: string
}

/**
 * Huella del registro anterior de la cadena. `null`/`''` = primer registro
 * (el campo `Huella=` de la cadena de entrada va vacío).
 */
export type HuellaAnterior = string | null

// ---------------------------------------------------------------------------
// Cadena de entrada
// ---------------------------------------------------------------------------

// Valor según doc. oficial: el del XML sin espacios al inicio/final; campo
// ausente o vacío → cadena vacía tras el `=`.
function par(nombre: string, valor: string | null | undefined): string {
  return `${nombre}=${(valor ?? '').trim()}`
}

/** Cadena de entrada oficial de la huella de un registro de alta (8 campos). */
export function cadenaEntradaAlta(datos: DatosHuellaAlta, huellaAnterior: HuellaAnterior): string {
  return [
    par('IDEmisorFactura', datos.IDEmisorFactura),
    par('NumSerieFactura', datos.NumSerieFactura),
    par('FechaExpedicionFactura', datos.FechaExpedicionFactura),
    par('TipoFactura', datos.TipoFactura),
    par('CuotaTotal', datos.CuotaTotal),
    par('ImporteTotal', datos.ImporteTotal),
    par('Huella', huellaAnterior),
    par('FechaHoraHusoGenRegistro', datos.FechaHoraHusoGenRegistro),
  ].join('&')
}

/** Cadena de entrada oficial de la huella de un registro de anulación (5 campos). */
export function cadenaEntradaAnulacion(
  datos: DatosHuellaAnulacion,
  huellaAnterior: HuellaAnterior
): string {
  return [
    par('IDEmisorFacturaAnulada', datos.IDEmisorFacturaAnulada),
    par('NumSerieFacturaAnulada', datos.NumSerieFacturaAnulada),
    par('FechaExpedicionFacturaAnulada', datos.FechaExpedicionFacturaAnulada),
    par('Huella', huellaAnterior),
    par('FechaHoraHusoGenRegistro', datos.FechaHoraHusoGenRegistro),
  ].join('&')
}

/** Cadena de entrada oficial de la huella de un registro de evento (9 campos). */
export function cadenaEntradaEvento(
  datos: DatosHuellaEvento,
  huellaEventoAnterior: HuellaAnterior
): string {
  return [
    par('NIF', datos.NIFSistemaInformatico),
    par('ID', datos.ID),
    par('IdSistemaInformatico', datos.IdSistemaInformatico),
    par('Version', datos.Version),
    par('NumeroInstalacion', datos.NumeroInstalacion),
    par('NIF', datos.NIFObligadoEmision),
    par('TipoEvento', datos.TipoEvento),
    par('HuellaEvento', huellaEventoAnterior),
    par('FechaHoraHusoGenEvento', datos.FechaHoraHusoGenEvento),
  ].join('&')
}

// ---------------------------------------------------------------------------
// Cálculo de la huella
// ---------------------------------------------------------------------------

/** SHA-256 de la cadena en UTF-8, en hexadecimal de 64 caracteres MAYÚSCULAS. */
export function sha256HexMayusculas(cadena: string): string {
  return createHash('sha256').update(cadena, 'utf8').digest('hex').toUpperCase()
}

/** Huella oficial de un registro de alta. Va en `RegistroAlta/Huella`. */
export function huellaAlta(datos: DatosHuellaAlta, huellaAnterior: HuellaAnterior): string {
  return sha256HexMayusculas(cadenaEntradaAlta(datos, huellaAnterior))
}

/** Huella oficial de un registro de anulación. Va en `RegistroAnulacion/Huella`. */
export function huellaAnulacion(
  datos: DatosHuellaAnulacion,
  huellaAnterior: HuellaAnterior
): string {
  return sha256HexMayusculas(cadenaEntradaAnulacion(datos, huellaAnterior))
}

/** Huella oficial de un registro de evento. Va en `RegistroEvento/Evento/HuellaEvento`. */
export function huellaEvento(
  datos: DatosHuellaEvento,
  huellaEventoAnterior: HuellaAnterior
): string {
  return sha256HexMayusculas(cadenaEntradaEvento(datos, huellaEventoAnterior))
}

// ---------------------------------------------------------------------------
// Verificación de integridad de una cadena (art. 7 Orden; defensa en
// profundidad D-05/SPEC §4.3 antes de encolar la remisión)
// ---------------------------------------------------------------------------

/**
 * Un eslabón de la cadena de huellas de un obligado, en orden de generación
 * (altas y anulaciones juntas). Espeja las columnas de `sif_registros`
 * (primer_registro, huella_anterior, huella) más los datos oficiales.
 */
export type EslabonCadena =
  | {
      tipo: 'alta'
      primerRegistro: boolean
      huellaAnterior: HuellaAnterior
      huella: string
      datos: DatosHuellaAlta
    }
  | {
      tipo: 'anulacion'
      primerRegistro: boolean
      huellaAnterior: HuellaAnterior
      huella: string
      datos: DatosHuellaAnulacion
    }

export interface ErrorCadena {
  /** Posición del eslabón con problema (0-based) dentro del array verificado. */
  indice: number
  codigo:
    | 'FORMATO_HUELLA'
    | 'HUELLA_NO_COINCIDE'
    | 'ENCADENADO_ROTO'
    | 'PRIMER_REGISTRO_INCOHERENTE'
  detalle: string
}

export interface ResultadoVerificacion {
  valida: boolean
  errores: ErrorCadena[]
  /** Huella del último eslabón (para continuar la cadena), si hay eslabones. */
  ultimaHuella: string | null
}

/**
 * Verifica la integridad de una cadena (o un fragmento contiguo de ella):
 *  1. Formato de cada huella (64 hex mayúsculas).
 *  2. Recalcula cada huella desde los datos y la compara con la declarada.
 *  3. Cada eslabón enlaza con la huella del anterior.
 *  4. Coherencia del flag de primer registro.
 *
 * Sin `opciones.huellaPrevia`, el array debe empezar por el PRIMER registro
 * de la cadena (primerRegistro = true, sin huella anterior). Con
 * `opciones.huellaPrevia`, se verifica un fragmento que continúa una cadena
 * ya existente cuya última huella es esa.
 *
 * Devuelve TODOS los errores encontrados (no se detiene en el primero).
 */
export function verificarCadena(
  eslabones: readonly EslabonCadena[],
  opciones?: { huellaPrevia?: string }
): ResultadoVerificacion {
  const errores: ErrorCadena[] = []
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

    // Coherencia del primer registro (art. 7 Orden: PrimerRegistro=S y sin
    // huella anterior; el resto siempre encadenado).
    if (esPrimero) {
      if (!eslabon.primerRegistro || (eslabon.huellaAnterior ?? '') !== '') {
        errores.push({
          indice,
          codigo: 'PRIMER_REGISTRO_INCOHERENTE',
          detalle:
            'El primer eslabón de la cadena debe tener primerRegistro=true y huellaAnterior vacía',
        })
      }
    } else {
      if (eslabon.primerRegistro) {
        errores.push({
          indice,
          codigo: 'PRIMER_REGISTRO_INCOHERENTE',
          detalle: 'Eslabón marcado como primer registro en mitad de la cadena',
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

    const recalculada =
      eslabon.tipo === 'alta'
        ? huellaAlta(eslabon.datos, eslabon.huellaAnterior)
        : huellaAnulacion(eslabon.datos, eslabon.huellaAnterior)
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

// ---------------------------------------------------------------------------
// Formateadores de valores oficiales (el valor de la huella debe ser IDÉNTICO
// al del XML; estos helpers son la fuente única de formato para V05/V07)
// ---------------------------------------------------------------------------

/**
 * Importe oficial: punto decimal y 2 decimales (p. ej. 123.45). El doc. AEAT
 * v0.1.2 admite 1 o 2 decimales indistintamente en la verificación, pero
 * Kuentas SIEMPRE genera con 2 (D-07 de SPEC.md).
 */
export function formatearImporte(valor: number | string): string {
  const numero = typeof valor === 'string' ? Number(valor.trim()) : valor
  if (!Number.isFinite(numero)) {
    throw new Error(`Importe no numérico: «${valor}»`)
  }
  // Evita el redondeo binario de toFixed en casos límite (p. ej. 1.005).
  const centimos = Math.round((numero + Number.EPSILON) * 100)
  return (centimos / 100).toFixed(2)
}

/** Fecha oficial `dd-mm-aaaa` a partir de `aaaa-mm-dd` (fecha SQL) o Date. */
export function formatearFechaExpedicion(fecha: Date | string): string {
  if (typeof fecha === 'string') {
    const m = fecha.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) throw new Error(`Fecha no reconocida (se espera aaaa-mm-dd): «${fecha}»`)
    return `${m[3]}-${m[2]}-${m[1]}`
  }
  // Date: se interpreta en horario peninsular (huso del obligado, SPEC §4.3).
  const partes = partesEnZona(fecha, 'Europe/Madrid')
  return `${partes.day}-${partes.month}-${partes.year}`
}

/**
 * `FechaHoraHusoGenRegistro` oficial: ISO 8601 con segundos y huso de España
 * peninsular (`Europe/Madrid`: +01:00 invierno / +02:00 verano), p. ej.
 * `2024-01-01T19:20:30+01:00`. Debe usarse el MISMO valor en huella y XML.
 */
export function fechaHoraHusoGenRegistro(fecha: Date = new Date()): string {
  const zona = 'Europe/Madrid'
  const p = partesEnZona(fecha, zona)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offsetEnZona(fecha, zona)}`
}

function partesEnZona(fecha: Date, timeZone: string) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(fecha)
  const valor = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? ''
  return {
    year: valor('year'),
    month: valor('month'),
    day: valor('day'),
    // Intl con hour12:false puede devolver "24" a medianoche en algunos motores.
    hour: valor('hour') === '24' ? '00' : valor('hour'),
    minute: valor('minute'),
    second: valor('second'),
  }
}

function offsetEnZona(fecha: Date, timeZone: string): string {
  const nombre =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(fecha)
      .find((x) => x.type === 'timeZoneName')?.value ?? ''
  // "GMT+02:00" → "+02:00"; "GMT" (UTC exacto) → "+00:00".
  const m = nombre.match(/([+-]\d{2}:\d{2})/)
  return m ? m[1] : '+00:00'
}
