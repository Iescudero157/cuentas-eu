// Numeración y fecha de las facturas que se crean sin VERI*FACTU activo (riesgo R1 de
// docs/verifactu/ARQUITECTURA-FACTURACION.md; arreglado el 26-nov-2026). Lógica pura, sin red: la usan el
// servidor (app/api/invoices/route.ts) y el formulario de nueva factura.
//
// Antes el navegador ponía «FACT-2026-» fijo + (facturas guardadas en ese navegador + 6): el número se repetía
// entre dispositivos y cuentas, y el 1-ene-2027 seguiría diciendo 2026. Ahora lo asigna el servidor al guardar:
// serie FACT-<año de la fecha de la factura>, correlativa por usuario, siguiente al mayor número usado ese año
// (art. 6.1.a RD 1619/2012). Con VERI*FACTU activo manda la numeración fiscal (sif_reservar_numero), que
// sustituye a esta al emitir.

const PATRON_NUMERO = /^FACT-(\d{4})-(\d{1,9})$/

/** Fecha de hoy en España (aaaa-mm-dd), que es la de expedición; no la UTC, que va una o dos horas por detrás. */
export function fechaHoyEspana(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

/** Año de una fecha aaaa-mm-dd que exista en el calendario (2000-2100), o null. Admite detrás una hora
 * («2026-11-26T10:00:00Z»), que la columna `date` ya aceptaba. */
export function anioDeFecha(fecha: unknown): number | null {
  if (typeof fecha !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(fecha.trim())
  if (!m) return null
  const anio = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  const existe = d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
  return existe && anio >= 2000 && anio <= 2100 ? anio : null
}

/** Siguiente número de la serie FACT-<año>: el mayor ya usado ese año más uno, con al menos tres cifras. */
export function siguienteNumeroFactura(anio: number, usados: readonly (string | null | undefined)[]): string {
  let mayor = 0
  for (const n of usados) {
    const m = PATRON_NUMERO.exec((n ?? '').trim())
    if (m && Number(m[1]) === anio) mayor = Math.max(mayor, Number(m[2]))
  }
  return `FACT-${anio}-${String(mayor + 1).padStart(3, '0')}`
}

export type FechaOperacionValidada = { ok: true; valor: string | null } | { ok: false; error: string }

/**
 * Fecha de la operación (art. 6.1.k RD 1619/2012; FechaOperacion del registro VERI*FACTU), 26-nov-2026.
 * Solo se guarda si es distinta de la fecha de la factura. La AEAT rechaza una posterior a hoy (error 1125)
 * o anterior a hace veinte años (1134). Vacía = la misma que la de la factura.
 */
export function validarFechaOperacion(
  fechaFactura: unknown,
  fechaOperacion: unknown,
  hoy: string = fechaHoyEspana()
): FechaOperacionValidada {
  if (fechaOperacion === undefined || fechaOperacion === null || fechaOperacion === '') return { ok: true, valor: null }
  if (typeof fechaOperacion !== 'string' || anioDeFecha(fechaOperacion) === null) {
    return { ok: false, error: 'La fecha de la operación no es válida (aaaa-mm-dd).' }
  }
  const f = fechaOperacion.trim().slice(0, 10)
  if (f > hoy) return { ok: false, error: 'La fecha de la operación no puede ser posterior a hoy: la AEAT la rechaza.' }
  if (f < String(Number(hoy.slice(0, 4)) - 20) + hoy.slice(4)) {
    return { ok: false, error: 'La fecha de la operación no puede ser de hace más de veinte años.' }
  }
  const factura = typeof fechaFactura === 'string' ? fechaFactura.trim().slice(0, 10) : ''
  return { ok: true, valor: f === factura ? null : f }
}
