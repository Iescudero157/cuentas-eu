// Importes de una factura a partir de sus líneas (26-nov-2026). Lógica pura: la usan el formulario de nueva
// factura y sus pruebas.
//
// · Precios sin IVA (lo de siempre): base = suma de las líneas; IVA = base × tipo; retención = base × tipo de IRPF.
// · Precios con el IVA incluido (Iván, 26-nov: el alquiler de 1.290 € con IVA incluido salía en 1.290,01 €): lo
//   escrito es el total con IVA; base = total / (1 + tipo), redondeada al céntimo; IVA = total − base. Así la factura
//   cuadra al céntimo con el importe acordado, igual que las facturas de MERCADONET y que la ruta del TPV
//   (lib/tpv/factura-tpv.ts). Las líneas se guardan con su precio sin IVA; la diferencia de redondeo se la lleva la
//   línea de mayor importe, para que la suma de las líneas sea la base.
// Todo se redondea al céntimo antes de sumar, como lo guarda la base de datos (DECIMAL(12,2)).

export const redondear = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100
const redondear4 = (n: number): number => Math.round((n + Number.EPSILON) * 10000) / 10000

export interface LineaPrecio {
  description: string
  quantity: number
  unitPrice: number
}

export interface LineaFactura extends LineaPrecio {
  /** Importe de la línea sin IVA, al céntimo. */
  total: number
}

export interface ImportesFactura {
  lineas: LineaFactura[]
  subtotal: number
  iva: number
  irpf: number
  total: number
}

export function calcularImportes(
  lineas: readonly LineaPrecio[],
  ivaRate: number,
  irpfRate: number,
  ivaIncluido = false
): ImportesFactura {
  const tipo = Number(ivaRate) || 0
  const tipoIrpf = Number(irpfRate) || 0
  const conIva = ivaIncluido && tipo > 0
  const brutas = lineas.map((l) => redondear((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)))

  let netas: number[]
  let subtotal: number
  let iva: number
  if (conIva) {
    const totalConIva = redondear(brutas.reduce((s, x) => s + x, 0))
    subtotal = redondear(totalConIva / (1 + tipo / 100))
    iva = redondear(totalConIva - subtotal)
    netas = brutas.map((b) => redondear(b / (1 + tipo / 100)))
    const descuadre = redondear(subtotal - netas.reduce((s, x) => s + x, 0))
    if (descuadre !== 0 && netas.length > 0) {
      const mayor = netas.reduce((m, x, i) => (Math.abs(x) > Math.abs(netas[m]) ? i : m), 0)
      netas[mayor] = redondear(netas[mayor] + descuadre)
    }
  } else {
    netas = brutas
    subtotal = redondear(netas.reduce((s, x) => s + x, 0))
    iva = redondear(subtotal * (tipo / 100))
  }
  const irpf = redondear(subtotal * (tipoIrpf / 100))
  const total = redondear(subtotal + iva - irpf)

  return {
    lineas: lineas.map((l, i) => {
      const cantidad = Number(l.quantity) || 0
      const precio = conIva ? (cantidad ? redondear4(netas[i] / cantidad) : 0) : Number(l.unitPrice) || 0
      return { description: l.description, quantity: cantidad, unitPrice: precio, total: netas[i] }
    }),
    subtotal,
    iva,
    irpf,
    total,
  }
}
