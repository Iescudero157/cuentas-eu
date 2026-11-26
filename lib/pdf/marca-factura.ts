// Modelo de factura de una cuenta (26-nov-2026, Iván: «adaptar el modelo de factura de MERCADONET y generar
// el de MILBROTES»). Se guarda en `profiles.factura_marca` (migración 20261126100000) y lo usa la plantilla
// PDF con marca (lib/pdf/invoice-pdf-server.tsx). Sin modelo, el PDF sale con el diseño de Kuentas.
// Lógica pura: valida lo guardado para que un dato raro nunca rompa la factura.

export interface MarcaFactura {
  /** Logo como data URL PNG o JPEG (≤ 400 KB). */
  logo?: string
  /** Barras, cabecera de la tabla y fila del TOTAL. */
  colorPrincipal?: string
  /** Palabra «FACTURA». */
  colorTitulo?: string
  /** Filas alternas y cuadro de totales. */
  colorSuave?: string
  /** Pie: razón social, datos registrales, web… (≤ 400 caracteres). */
  pie?: string
}

const HEX = /^#[0-9a-fA-F]{6}$/
const LOGO = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/
const MAX_LOGO = 400_000

export function normalizarMarca(raw: unknown): MarcaFactura | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const m: MarcaFactura = {}
  if (typeof r.logo === 'string' && r.logo.length <= MAX_LOGO && LOGO.test(r.logo)) m.logo = r.logo
  for (const k of ['colorPrincipal', 'colorTitulo', 'colorSuave'] as const) {
    const v = r[k]
    if (typeof v === 'string' && HEX.test(v)) m[k] = v
  }
  if (typeof r.pie === 'string' && r.pie.trim() !== '') m.pie = r.pie.replace(/\s+/g, ' ').trim().slice(0, 400)
  return Object.keys(m).length > 0 ? m : null
}

const FORMAS_PAGO: Readonly<Record<string, string>> = {
  transferencia: 'Transferencia bancaria',
  tarjeta: 'Tarjeta',
  card: 'Tarjeta',
  efectivo: 'Efectivo',
  domiciliacion: 'Domiciliación bancaria',
  cheque: 'Cheque',
  bizum: 'Bizum',
  paypal: 'PayPal',
  otro: 'Otro',
  stripe: 'Tarjeta',
  bbva: 'Tarjeta o Bizum',
  redsys_mercadonet: 'Tarjeta',
}

/** Forma de pago legible. El TPV guarda «pasarela:método» (p. ej. «bbva:bizum»): manda el método. */
export function etiquetaFormaPago(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor.trim() === '') return null
  const [pasarela, metodo] = valor.trim().toLowerCase().split(':')
  if (metodo) return FORMAS_PAGO[metodo] ?? null
  return FORMAS_PAGO[pasarela] ?? null
}

/** Notas que se imprimen: sin la marca interna del TPV («[TPV pedido]») que sirve para no facturar dos veces. */
export function notasImprimibles(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.replace(/^\s*\[TPV [^\]]*\]\s*/, '').trim()
  return t === '' ? null : t.slice(0, 600)
}

/**
 * Importe en euros con formato español y separador de millares SIEMPRE: «1.290,00 €» (Iván, 26-nov-2026).
 * No se usa Intl es-ES: su agrupación mínima de 2 cifras deja «1290,00» hasta 9.999.
 */
export function formatearEuros(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100
  const [entero, decimales] = Math.abs(v).toFixed(2).split('.')
  return (v < 0 ? '-' : '') + entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + decimales + ' €'
}
