// ---------------------------------------------------------------------------
// V22 · Export contable «ClassicConta (AIG)» — función del plan Business.
//
// Genera los dos ficheros ASCII de ancho fijo que acepta el «Importador de
// Asientos» de ClassicConta 6/7 (Herramientas > Importación de datos), según
// el Protocolo de Comunicación Conta6 de AIG (documento público:
// aigclassic.com/download/pdf/Protocolo_Comunicacion_Conta6.pdf, copia en
// docs/export-contable/):
//
//   · Diario:     869 caracteres/registro (16 campos, pág. 6 del protocolo)
//   · Subcuentas: 444 caracteres/registro (20 campos, pág. 4 del protocolo)
//
// El layout y el formato de cada campo están verificados posición a posición
// contra los ficheros reales CC_diario.txt (2.001 apuntes) y CC_subcuentas.txt
// (93 subcuentas) importados con éxito en la contabilidad interna de
// Mercadonet (importación real de 647 asientos sin incidencias, Anexo A del
// plan maestro Kuentas × ClassicConta). En caso de duda entre el protocolo y
// esos ficheros probados, se sigue el formato probado:
//   · Importes N16 CON punto decimal y 2 decimales, rellenos de ceros por la
//     izquierda; el signo negativo va delante de los ceros («-000000000121.00»).
//   · Separador de registro CRLF y CRLF final tras el último registro.
//   · Codificación ANSI (Windows-1252), la que espera CC7 en Windows.
//   · TPC/RecEquiv/nIRPF a «00000» también en subcuentas de IVA (el importador
//     de CC7 calcula el registro de IVA por la estructura del asiento; así se
//     importaron los ficheros reales).
//
// Mapeo factura de venta → asiento (Anexo A.2 del plan maestro):
//   430x (cliente)            Debe   total a cobrar (base + IVA − IRPF)
//   473x (HP ret. y pagos)    Debe   retención IRPF (si la hay)
//   705x (prestac. servicios) Haber  base imponible
//   477x (IVA repercutido)    Haber  cuota, una subcuenta por tipo (4770000TT)
// El asiento SIEMPRE cuadra por construcción (el total del Debe se deriva de
// base/cuota/retención); si el `total` almacenado de la factura difiere en
// más de un céntimo se emite un aviso, nunca un fichero descuadrado.
// Rectificativas R1-R5: mismos apuntes con los importes tal y como estén
// almacenados (negativos) y Rectifica='T' (campo 14 del diario).
//
// Los códigos de subcuenta de cliente son ESTABLES entre exports: se derivan
// de un hash FNV-1a del NIF (o nombre) del cliente, de modo que la gestoría
// recibe siempre el mismo código para el mismo cliente aunque cambie el
// período exportado. Las colisiones se resuelven por sondeo lineal dentro del
// espacio de códigos y quedan igualmente deterministas para un mismo censo.
// ---------------------------------------------------------------------------

import JSZip from 'jszip'

// ---------------------------------------------------------------------------
// Layout oficial (Protocolo de Comunicación Conta6, págs. 4 y 6)
// ---------------------------------------------------------------------------

export const ANCHO_DIARIO = 869
export const ANCHO_SUBCUENTAS = 444
export const EOL = '\r\n'

/** Campos del fichero de diario, en orden y con su ancho (suman 869). */
export const LAYOUT_DIARIO = [
  { campo: 'Asien', tipo: 'N', ancho: 6 },
  { campo: 'Fecha', tipo: 'F', ancho: 8 },
  { campo: 'Subcta', tipo: 'C', ancho: 12 },
  { campo: 'Reservado4', tipo: 'C', ancho: 28 },
  { campo: 'Concepto', tipo: 'C', ancho: 25 },
  { campo: 'Reservado6', tipo: 'C', ancho: 50 },
  { campo: 'Documento', tipo: 'C', ancho: 10 },
  { campo: 'Reservado8', tipo: 'C', ancho: 3 },
  { campo: 'Clave', tipo: 'C', ancho: 6 },
  { campo: 'Reservado10', tipo: 'C', ancho: 90 },
  { campo: 'EuroDebe', tipo: 'N', ancho: 16 },
  { campo: 'EuroHaber', tipo: 'N', ancho: 16 },
  { campo: 'Reservado13', tipo: 'C', ancho: 68 },
  { campo: 'Rectifica', tipo: 'L', ancho: 1 },
  { campo: 'Reservado15', tipo: 'C', ancho: 529 },
  { campo: 'TipoFac', tipo: 'C', ancho: 1 },
] as const

/** Campos del fichero de subcuentas, en orden y con su ancho (suman 444). */
export const LAYOUT_SUBCUENTAS = [
  { campo: 'Cod', tipo: 'C', ancho: 12 },
  { campo: 'Titulo', tipo: 'C', ancho: 40 },
  { campo: 'NIF', tipo: 'C', ancho: 15 },
  { campo: 'Domicilio', tipo: 'C', ancho: 35 },
  { campo: 'Poblacion', tipo: 'C', ancho: 25 },
  { campo: 'Provincia', tipo: 'C', ancho: 20 },
  { campo: 'CodPostal', tipo: 'C', ancho: 5 },
  { campo: 'Reservado8', tipo: 'C', ancho: 8 },
  { campo: 'TipoIVA', tipo: 'C', ancho: 1 },
  { campo: 'Reservado10', tipo: 'C', ancho: 46 },
  { campo: 'TPC', tipo: 'N', ancho: 5 },
  { campo: 'RecEquiv', tipo: 'N', ancho: 5 },
  { campo: 'Fax01', tipo: 'C', ancho: 15 },
  { campo: 'Email', tipo: 'C', ancho: 50 },
  { campo: 'Reservado15', tipo: 'C', ancho: 100 },
  { campo: 'IdNif', tipo: 'N', ancho: 1 },
  { campo: 'CodPais', tipo: 'C', ancho: 2 },
  { campo: 'Rep14NIF', tipo: 'C', ancho: 9 },
  { campo: 'Reservado19', tipo: 'C', ancho: 45 },
  { campo: 'nIRPF', tipo: 'N', ancho: 5 },
] as const

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Datos contables mínimos de una factura de venta de la app. */
export interface FacturaContable {
  /** Número definitivo (numero_fiscal si está emitida; number en flujo legacy). */
  numero: string
  /** Fecha de expedición, YYYY-MM-DD. */
  fecha: string
  clienteNombre: string
  clienteNif?: string | null
  clienteDireccion?: string | null
  clienteEmail?: string | null
  /** Identificador estable del cliente en la app (mejor clave que el nombre). */
  clienteId?: string | null
  /** Base imponible (subtotal). */
  base: number
  /** Cuota de IVA repercutido. */
  cuotaIva: number
  /** Tipo de IVA en % (21, 10, 4...). Solo se usa si cuotaIva ≠ 0. */
  tipoIva: number
  /** Retención IRPF (importe, no %). */
  retencionIrpf: number
  /** Total a cobrar almacenado en la app (base + IVA − IRPF); solo para avisos. */
  totalFactura: number
  /** true si es rectificativa R1-R5 (importes ya almacenados en negativo). */
  rectificativa: boolean
}

export interface OpcionesExportCC {
  /** Dígitos de subcuenta del plan contable destino (CC7 los admite variables). */
  digitos?: number
  /** Número del primer asiento (correlativo del ejercicio destino). */
  asientoInicial?: number
  /** Cuenta de ventas (prefijo o subcuenta completa). Por defecto 705. */
  cuentaVentas?: string
  /** Cuenta de retenciones IRPF. Por defecto 473. */
  cuentaIrpf?: string
  /** Prefijo de clientes. Por defecto 430. */
  prefijoClientes?: string
  /** Prefijo de IVA repercutido. Por defecto 477 (+ sufijo del tipo). */
  prefijoIva?: string
}

export interface ApunteDiario {
  asien: number
  /** YYYY-MM-DD */
  fecha: string
  subcuenta: string
  concepto: string
  documento: string
  debeCent: number
  haberCent: number
  rectifica: boolean
  tipoFac: 'E' | ''
}

export interface SubcuentaCC {
  codigo: string
  titulo: string
  nif?: string
  domicilio?: string
  email?: string
}

export interface ResultadoExportCC {
  diarioTxt: string
  subcuentasTxt: string
  leemeTxt: string
  apuntes: ApunteDiario[]
  subcuentas: SubcuentaCC[]
  /** Discrepancias no bloqueantes detectadas (p. ej. total almacenado ≠ derivado). */
  avisos: string[]
  asientos: number
}

export class ErrorExportCC extends Error {
  readonly codigo: string
  constructor(codigo: string, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorExportCC'
    this.codigo = codigo
  }
}

// ---------------------------------------------------------------------------
// Formateo de campos (reglas del protocolo, pág. 4 y 6: alfanuméricos a la
// izquierda rellenos de blancos, numéricos a la derecha rellenos de ceros)
// ---------------------------------------------------------------------------

/** Sustituciones de caracteres fuera de Windows-1252/latin1 más habituales. */
const TRANSLITERACIONES: Record<string, string> = {
  '\u2026': '...', // puntos suspensivos
  '\u20ac': 'EUR', // euro
  '\u2018': "'", '\u2019': "'", '\u201a': "'",
  '\u201c': '"', '\u201d': '"', '\u201e': '"',
  '\u2013': '-', '\u2014': '-', '\u2212': '-',
}


/**
 * Normaliza un texto a caracteres representables en ANSI (Windows-1252):
 * conserva ASCII y latin1 (á, ñ, ç...), translitera puntuación tipográfica y
 * despoja de diacríticos el resto; lo irrepresentable se sustituye por '?'.
 */
export function aAnsi(texto: string): string {
  let s = texto.normalize('NFC').replace(/[\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
  for (const [de, a] of Object.entries(TRANSLITERACIONES)) s = s.split(de).join(a)
  let out = ''
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp === 0x0a || cp === 0x0d || cp === 0x09) { out += ' '; continue }
    if (cp < 0x20) continue
    if (cp <= 0xff) { out += ch; continue }
    const sinDiacriticos = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const cp2 = sinDiacriticos.codePointAt(0) ?? 0
    out += cp2 > 0 && cp2 <= 0xff && cp2 >= 0x20 ? sinDiacriticos : '?'
  }
  return out
}

/** Campo alfanumérico: ANSI, recortado al ancho y relleno de blancos a la derecha. */
export function campoTexto(valor: string | null | undefined, ancho: number): string {
  const s = aAnsi((valor ?? '').trim())
  return s.length > ancho ? s.slice(0, ancho) : s.padEnd(ancho, ' ')
}

/** Campo numérico entero: relleno de ceros a la izquierda. */
export function campoEntero(valor: number, ancho: number): string {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new ErrorExportCC('numero_invalido', `Valor entero no válido: ${valor}`)
  }
  const s = String(valor)
  if (s.length > ancho) {
    throw new ErrorExportCC('numero_desborda', `El valor ${valor} no cabe en ${ancho} posiciones`)
  }
  return s.padStart(ancho, '0')
}

/**
 * Importe en céntimos → campo N16 del diario: punto decimal, 2 decimales,
 * ceros a la izquierda y signo negativo delante de los ceros
 * (formato verificado en CC_diario.txt: «0000000003000.00», «-000000003693.95»).
 */
export function campoImporte(centimos: number, ancho = 16): string {
  if (!Number.isInteger(centimos)) {
    throw new ErrorExportCC('importe_invalido', `Importe en céntimos no entero: ${centimos}`)
  }
  const abs = Math.abs(centimos)
  const base = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
  const s = centimos < 0 ? `-${base.padStart(ancho - 1, '0')}` : base.padStart(ancho, '0')
  if (s.length > ancho) {
    throw new ErrorExportCC('importe_desborda', `El importe ${centimos} no cabe en ${ancho} posiciones`)
  }
  return s
}

/** Fecha YYYY-MM-DD → aaaammdd (formato del campo Fecha del diario). */
export function fechaAIG(fechaIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaIso ?? '')
  if (!m) throw new ErrorExportCC('fecha_invalida', `Fecha no válida (se espera YYYY-MM-DD): ${fechaIso}`)
  return `${m[1]}${m[2]}${m[3]}`
}

/** Euros (number de la app) → céntimos enteros. */
export function centimos(euros: number): number {
  if (typeof euros !== 'number' || !Number.isFinite(euros)) {
    throw new ErrorExportCC('importe_invalido', `Importe no numérico: ${euros}`)
  }
  return Math.round(euros * 100)
}

// ---------------------------------------------------------------------------
// Códigos de subcuenta
// ---------------------------------------------------------------------------

const DIGITOS_MIN = 6
const DIGITOS_MAX = 12
const DIGITOS_DEFECTO = 9 // el desglose usado en la contabilidad interna de Mercadonet

function validarDigitos(digitos: number): number {
  if (!Number.isInteger(digitos) || digitos < DIGITOS_MIN || digitos > DIGITOS_MAX) {
    throw new ErrorExportCC('digitos_invalidos', `Dígitos de subcuenta fuera de rango (${DIGITOS_MIN}-${DIGITOS_MAX}): ${digitos}`)
  }
  return digitos
}

/** Completa un prefijo de cuenta (p. ej. '705') con ceros hasta los dígitos del plan. */
export function subcuentaFija(prefijo: string, digitos: number): string {
  const p = prefijo.replace(/\D/g, '')
  if (!p || p.length > digitos) {
    throw new ErrorExportCC('subcuenta_invalida', `Prefijo de subcuenta no válido: ${prefijo}`)
  }
  return p.padEnd(digitos, '0')
}

/** Subcuenta de IVA repercutido por tipo: 477 + ceros + tipo a 2 dígitos (4770000TT). */
export function subcuentaIva(prefijo: string, tipo: number, digitos: number): string {
  const sufijo = String(Math.round(Math.abs(tipo))).padStart(2, '0').slice(-2)
  const p = prefijo.replace(/\D/g, '')
  if (!p || p.length + sufijo.length > digitos) {
    throw new ErrorExportCC('subcuenta_invalida', `Prefijo de IVA no válido: ${prefijo}`)
  }
  return p + '0'.repeat(digitos - p.length - sufijo.length) + sufijo
}

/** Hash FNV-1a de 32 bits (estable, sin dependencias). */
function fnv1a(texto: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Clave estable de un cliente: id de la app > NIF > nombre normalizado. */
export function claveCliente(f: Pick<FacturaContable, 'clienteId' | 'clienteNif' | 'clienteNombre'>): string {
  const nif = (f.clienteNif ?? '').replace(/[\s.-]/g, '').toUpperCase()
  if (f.clienteId) return `id:${f.clienteId}`
  if (nif) return `nif:${nif}`
  return `nom:${f.clienteNombre.trim().toLowerCase().replace(/\s+/g, ' ')}`
}

/**
 * Asigna a cada cliente un código 430x estable entre exports (hash de su
 * clave dentro del espacio de códigos del plan), resolviendo colisiones por
 * sondeo lineal en orden de primera aparición.
 */
export function asignarCodigosClientes(
  claves: string[],
  prefijo: string,
  digitos: number
): Map<string, string> {
  const p = prefijo.replace(/\D/g, '')
  const libres = digitos - p.length
  if (!p || libres < 1) {
    throw new ErrorExportCC('subcuenta_invalida', `Prefijo de clientes no válido: ${prefijo}`)
  }
  const espacio = Math.pow(10, Math.min(libres, 9)) // nº de sufijos posibles
  const asignados = new Map<string, string>() // clave cliente → código
  const ocupados = new Set<string>()
  for (const clave of claves) {
    if (asignados.has(clave)) continue
    let n = fnv1a(clave) % espacio
    let codigo = p + String(n).padStart(libres, '0')
    while (ocupados.has(codigo)) {
      n = (n + 1) % espacio
      codigo = p + String(n).padStart(libres, '0')
    }
    asignados.set(clave, codigo)
    ocupados.add(codigo)
  }
  return asignados
}

// ---------------------------------------------------------------------------
// Generación de asientos y ficheros
// ---------------------------------------------------------------------------

/** Renderiza una línea del diario (869 caracteres exactos, sin EOL). */
export function lineaDiario(a: ApunteDiario): string {
  const linea =
    campoEntero(a.asien, 6) +
    fechaAIG(a.fecha) +
    campoTexto(a.subcuenta, 12) +
    ' '.repeat(28) +
    campoTexto(a.concepto, 25) +
    ' '.repeat(50) +
    campoTexto(a.documento, 10) +
    ' '.repeat(3) +
    ' '.repeat(6) + // Clave (proyecto): sin uso
    ' '.repeat(90) +
    campoImporte(a.debeCent) +
    campoImporte(a.haberCent) +
    ' '.repeat(68) +
    (a.rectifica ? 'T' : ' ') +
    ' '.repeat(529) +
    (a.tipoFac === 'E' ? 'E' : ' ')
  if (linea.length !== ANCHO_DIARIO) {
    throw new ErrorExportCC('ancho_diario', `Línea de diario de ${linea.length} caracteres (esperados ${ANCHO_DIARIO})`)
  }
  return linea
}

/** Renderiza una línea de subcuentas (444 caracteres exactos, sin EOL). */
export function lineaSubcuenta(s: SubcuentaCC): string {
  const nif = (s.nif ?? '').trim()
  const esNifEspanol = /^[0-9]{8}[A-Z]$|^[XYZ][0-9]{7}[A-Z]$|^[A-HJNP-SUVW][0-9]{7}[0-9A-J]$/i
    .test(nif.replace(/[\s.-]/g, ''))
  const linea =
    campoTexto(s.codigo, 12) +
    campoTexto(s.titulo, 40) +
    campoTexto(nif, 15) +
    campoTexto(s.domicilio, 35) +
    ' '.repeat(25) + // Población: la dirección de la app no está estructurada
    ' '.repeat(20) + // Provincia
    ' '.repeat(5) +  // Código Postal
    ' '.repeat(8) +  // Reservado
    ' ' +            // Tipo IVA de la subcuenta: en blanco, como el fichero probado
    ' '.repeat(46) + // Reservado
    '00000' +        // TPC: como el fichero probado (CC7 calcula el IVA del asiento)
    '00000' +        // RecEquiv
    ' '.repeat(15) + // Fax
    campoTexto(s.email, 50) +
    ' '.repeat(100) +
    (nif ? '1' : '0') + // IdNif: 1 = NIF (Nota 2 del protocolo)
    campoTexto(nif ? (esNifEspanol ? 'ES' : '') : '', 2) +
    ' '.repeat(9) +  // Rep14NIF
    ' '.repeat(45) + // Reservado
    '00000'          // nIRPF
  if (linea.length !== ANCHO_SUBCUENTAS) {
    throw new ErrorExportCC('ancho_subcuentas', `Línea de subcuentas de ${linea.length} caracteres (esperados ${ANCHO_SUBCUENTAS})`)
  }
  return linea
}

/**
 * Convierte las facturas del período en asientos AIG + fichero de subcuentas.
 * Un asiento por factura; el Debe se deriva de base/cuota/retención para que
 * el asiento cuadre SIEMPRE; las discrepancias con el total almacenado se
 * devuelven en `avisos`.
 */
export function construirExportClassicConta(
  facturas: FacturaContable[],
  opciones: OpcionesExportCC = {}
): ResultadoExportCC {
  if (!facturas.length) {
    throw new ErrorExportCC('sin_facturas', 'No hay facturas en el período seleccionado')
  }
  const digitos = validarDigitos(opciones.digitos ?? DIGITOS_DEFECTO)
  const asientoInicial = opciones.asientoInicial ?? 1
  if (!Number.isInteger(asientoInicial) || asientoInicial < 1 || asientoInicial > 999999) {
    throw new ErrorExportCC('asiento_invalido', `Número de primer asiento no válido: ${asientoInicial}`)
  }
  const ctaVentas = subcuentaFija(opciones.cuentaVentas ?? '705', digitos)
  const ctaIrpf = subcuentaFija(opciones.cuentaIrpf ?? '473', digitos)
  const prefClientes = opciones.prefijoClientes ?? '430'
  const prefIva = opciones.prefijoIva ?? '477'

  // Orden estable: fecha y, a igualdad, número de factura
  const ordenadas = [...facturas].sort((a, b) =>
    a.fecha === b.fecha ? a.numero.localeCompare(b.numero, 'es') : a.fecha.localeCompare(b.fecha)
  )
  if (asientoInicial + ordenadas.length - 1 > 999999) {
    throw new ErrorExportCC('asiento_desborda', 'La numeración de asientos supera las 6 posiciones del campo Asien')
  }

  const codigosClientes = asignarCodigosClientes(ordenadas.map(claveCliente), prefClientes, digitos)

  const apuntes: ApunteDiario[] = []
  const avisos: string[] = []
  const clientesVistos = new Map<string, SubcuentaCC>()
  const tiposIvaUsados = new Map<string, number>() // subcuenta → tipo
  let usaIrpf = false

  ordenadas.forEach((f, i) => {
    const asien = asientoInicial + i
    const baseC = centimos(f.base)
    const ivaC = centimos(f.cuotaIva)
    const irpfC = centimos(f.retencionIrpf)
    const totalC = baseC + ivaC - irpfC
    if (Math.abs(centimos(f.totalFactura) - totalC) > 1) {
      avisos.push(
        `Factura ${f.numero}: el total almacenado (${(centimos(f.totalFactura) / 100).toFixed(2)}) no cuadra con ` +
        `base + IVA - IRPF (${(totalC / 100).toFixed(2)}); el asiento usa el importe derivado, que cuadra.`
      )
    }
    const clave = claveCliente(f)
    const codigoCliente = codigosClientes.get(clave)!
    if (!clientesVistos.has(clave)) {
      clientesVistos.set(clave, {
        codigo: codigoCliente,
        titulo: f.clienteNombre || 'Cliente sin nombre',
        nif: f.clienteNif ?? undefined,
        domicilio: f.clienteDireccion ?? undefined,
        email: f.clienteEmail ?? undefined,
      })
    }
    const concepto = `Fra. ${f.numero}`
    const documento = f.numero.length > 10 ? f.numero.slice(-10) : f.numero
    const comunes = { asien, fecha: f.fecha, concepto, documento, rectifica: f.rectificativa, tipoFac: 'E' as const }

    // Debe: cliente por el total a cobrar y, si hay retención, HP retenciones
    apuntes.push({ ...comunes, subcuenta: codigoCliente, debeCent: totalC, haberCent: 0 })
    if (irpfC !== 0) {
      usaIrpf = true
      apuntes.push({ ...comunes, subcuenta: ctaIrpf, debeCent: irpfC, haberCent: 0 })
    }
    // Haber: ventas por la base y, si hay cuota, IVA repercutido por tipo
    apuntes.push({ ...comunes, subcuenta: ctaVentas, debeCent: 0, haberCent: baseC })
    if (ivaC !== 0) {
      const sc = subcuentaIva(prefIva, f.tipoIva, digitos)
      tiposIvaUsados.set(sc, Math.round(Math.abs(f.tipoIva)))
      apuntes.push({ ...comunes, subcuenta: sc, debeCent: 0, haberCent: ivaC })
    }
  })

  // Verificación de cuadre por asiento (defensa en profundidad: por
  // construcción siempre cuadra; si no, es un bug y NO se exporta)
  const porAsiento = new Map<number, { debe: number; haber: number }>()
  for (const a of apuntes) {
    const acc = porAsiento.get(a.asien) ?? { debe: 0, haber: 0 }
    acc.debe += a.debeCent
    acc.haber += a.haberCent
    porAsiento.set(a.asien, acc)
  }
  for (const [asien, { debe, haber }] of porAsiento) {
    if (debe !== haber) {
      throw new ErrorExportCC('descuadre', `Asiento ${asien} descuadrado: Debe ${debe} ≠ Haber ${haber} (céntimos)`)
    }
  }

  // Fichero de subcuentas: clientes + cuentas de ventas/IVA/retenciones usadas
  const subcuentas: SubcuentaCC[] = [
    ...clientesVistos.values(),
    { codigo: ctaVentas, titulo: 'Prestaciones de servicios' },
    ...[...tiposIvaUsados.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([codigo, tipo]) => ({ codigo, titulo: `HP IVA REPERCUTIDO ${tipo}%` })),
    ...(usaIrpf ? [{ codigo: ctaIrpf, titulo: 'HP Retenciones y pagos a cuenta' }] : []),
  ]

  const diarioTxt = apuntes.map(lineaDiario).join(EOL) + EOL
  const subcuentasTxt = subcuentas.map(lineaSubcuenta).join(EOL) + EOL

  return {
    diarioTxt,
    subcuentasTxt,
    leemeTxt: textoLeeme(ordenadas, apuntes.length, subcuentas.length, avisos),
    apuntes,
    subcuentas,
    avisos,
    asientos: ordenadas.length,
  }
}

function textoLeeme(facturas: FacturaContable[], apuntes: number, subcuentas: number, avisos: string[]): string {
  const desde = facturas[0]?.fecha ?? ''
  const hasta = facturas[facturas.length - 1]?.fecha ?? ''
  return [
    'EXPORT CONTABLE KUENTAS -> CLASSICCONTA (AIG)',
    '=============================================',
    '',
    `Período exportado: ${desde} a ${hasta} (fecha de expedición de la factura).`,
    `Contenido: ${facturas.length} facturas de venta -> ${facturas.length} asientos (${apuntes} apuntes) y ${subcuentas} subcuentas.`,
    '',
    'Ficheros (formato oficial del Protocolo de Comunicación Conta6 de AIG):',
    '  CC_subcuentas.txt  registros de 444 caracteres (altas de subcuentas)',
    '  CC_diario.txt      registros de 869 caracteres (apuntes del diario)',
    '',
    'CÓMO IMPORTAR EN CLASSICCONTA 6/7',
    '  1. Abra la empresa y el ejercicio destino (las fechas del diario deben pertenecer a él).',
    '  2. Menú Herramientas > Importación de datos > Importador de Asientos.',
    '  3. Seleccione PRIMERO el fichero de subcuentas (CC_subcuentas.txt) y después el diario (CC_diario.txt).',
    '  4. Revise la rejilla de previsualización antes de finalizar (puede ajustar códigos o títulos ahí).',
    '',
    'CRITERIOS DEL EXPORT',
    '  - Un asiento por factura: cliente (430x) al Debe por el total a cobrar; retención IRPF (473x) al Debe si la hay;',
    '    ventas (705x) al Haber por la base; IVA repercutido (477x, una subcuenta por tipo: 4770000TT) al Haber por la cuota.',
    '  - Rectificativas R1-R5: mismos apuntes con importes en negativo y marca de rectificativa del protocolo.',
    '  - Los códigos de cliente son estables: el mismo cliente recibe el mismo código 430x en todos los exports.',
    '  - No se incluyen facturas anuladas ni borradores sin emitir.',
    '  - Codificación ANSI (Windows-1252), separador de registro CRLF, numeración de asientos correlativa.',
    '',
    avisos.length
      ? ['AVISOS', ...avisos.map((a) => `  - ${a}`), ''].join('\n')
      : 'Sin avisos: todos los asientos cuadran con los totales almacenados.',
    '',
    'Generado por Kuentas (kuentas.eu) - Mercadonet Global S.L.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Codificación ANSI y empaquetado ZIP
// ---------------------------------------------------------------------------

/**
 * Codifica un texto ya normalizado con aAnsi() a bytes Windows-1252.
 * Tras aAnsi() todos los puntos de código son <= 0xFF, donde latin1 y
 * Windows-1252 coinciden byte a byte.
 */
export function bytesAnsi(texto: string): Uint8Array {
  return Uint8Array.from(Buffer.from(texto, 'latin1'))
}

export const FICHERO_DIARIO = 'CC_diario.txt'
export const FICHERO_SUBCUENTAS = 'CC_subcuentas.txt'
export const FICHERO_LEEME = 'LEEME.txt'

/** Empaqueta el export en un ZIP (subcuentas + diario + instrucciones). */
export async function zipExportClassicConta(resultado: ResultadoExportCC): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(FICHERO_SUBCUENTAS, bytesAnsi(resultado.subcuentasTxt))
  zip.file(FICHERO_DIARIO, bytesAnsi(resultado.diarioTxt))
  zip.file(FICHERO_LEEME, bytesAnsi(aAnsi(resultado.leemeTxt)))
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
