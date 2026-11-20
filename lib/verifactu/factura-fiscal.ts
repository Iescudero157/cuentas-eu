// Reglas fiscales de clasificación de una factura de Kuentas: causa de exención,
// clase de factura (completa, simplificada, rectificativa), serie que le
// corresponde, título del documento y validación del NIF.
//
// Módulo PURO y sin dependencias (ni node:crypto ni Supabase): lo importan tanto
// el motor de registros (servidor) como las pantallas (cliente) y el PDF, para
// que la factura, su PDF y su registro VERI*FACTU digan siempre lo mismo.
//
// Fuentes comprobadas el 20-nov-2026 (docs/verifactu/CUMPLIMIENTO-20261120.md):
//  · Lista L10 y L2/L3/L8A: «DsRegistroVeriFactu.xlsx» (pestaña 6) y documento
//    «Validaciones» v1.2.2 (08/04/2026) del portal de desarrolladores de la AEAT.
//  · RD 1619/2012 (BOE-A-2012-14696, consolidado a 31/03/2026): arts. 4, 6.1.a),
//    6.1.j), 7.1.a) y 15.
//  · Ley 37/1992 del IVA (BOE-A-1992-28740): arts. 20 a 25 y 80.

// ---------------------------------------------------------------------------
// NIF español
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

/** NIF tal como se escribe a mano → forma canónica (mayúsculas, sin espacios, puntos ni guiones). */
export function normalizarNif(nif: string | null | undefined): string {
  return (nif ?? '').toUpperCase().replace(/[\s.\-]/g, '')
}

export type SituacionNifCliente = 'vacio' | 'valido' | 'invalido'

/**
 * Situación del NIF del cliente: sin NIF (la factura será simplificada), NIF
 * español válido (factura completa) o texto que no es un NIF español válido
 * (errata o documento extranjero: Kuentas no lo admite todavía y no debe
 * convertirse en simplificada en silencio).
 */
export function situacionNifCliente(nif: string | null | undefined): SituacionNifCliente {
  const v = normalizarNif(nif)
  if (v === '') return 'vacio'
  return esNifValido(v) ? 'valido' : 'invalido'
}

// ---------------------------------------------------------------------------
// Causas de exención del IVA (lista L10)
// ---------------------------------------------------------------------------

/** Lista L10 para IVA. E7 y E8 existen en el XSD, pero solo para IGIC (Validaciones §15.5). */
export type CausaExencionIva = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6'

export interface InfoCausaExencion {
  clave: CausaExencionIva
  /** Descripción oficial de la lista L10 (DsRegistroVeriFactu.xlsx). */
  descripcionOficial: string
  /** Artículo o artículos de la Ley 37/1992; null en E6 («otros»). */
  articulos: string | null
  /** Rúbrica del artículo en la Ley 37/1992 (texto del BOE). */
  rubrica: string
  /**
   * false = Kuentas todavía no puede emitirla bien desde sus pantallas. E5
   * (entregas a otro Estado miembro) exige identificar al cliente con su
   * NIF-IVA (bloque IDOtro, Validaciones §15.5.1) y la app solo admite NIF español.
   */
  disponible: boolean
}

export const CAUSAS_EXENCION_IVA: readonly InfoCausaExencion[] = Object.freeze([
  {
    clave: 'E1',
    descripcionOficial: 'Exenta por el artículo 20',
    articulos: 'artículo 20',
    rubrica: 'Exenciones en operaciones interiores',
    disponible: true,
  },
  {
    clave: 'E2',
    descripcionOficial: 'Exenta por el artículo 21',
    articulos: 'artículo 21',
    rubrica: 'Exenciones en las exportaciones de bienes',
    disponible: true,
  },
  {
    clave: 'E3',
    descripcionOficial: 'Exenta por el artículo 22',
    articulos: 'artículo 22',
    rubrica: 'Exenciones en las operaciones asimiladas a las exportaciones',
    disponible: true,
  },
  {
    clave: 'E4',
    descripcionOficial: 'Exenta por los artículos 23 y 24',
    articulos: 'artículos 23 y 24',
    rubrica:
      'Exenciones relativas a las situaciones de depósito temporal y otras situaciones (art. 23) y a regímenes aduaneros y fiscales (art. 24)',
    disponible: true,
  },
  {
    clave: 'E5',
    descripcionOficial: 'Exenta por el artículo 25',
    articulos: 'artículo 25',
    rubrica: 'Exenciones en las entregas de bienes destinados a otro Estado miembro',
    disponible: false,
  },
  {
    clave: 'E6',
    descripcionOficial: 'Exenta por otros',
    articulos: null,
    rubrica: 'Otras exenciones de la Ley del IVA',
    disponible: true,
  },
])

const CLAVES_EXENCION_IVA: readonly string[] = CAUSAS_EXENCION_IVA.map((c) => c.clave)

export function esCausaExencionIva(valor: unknown): valor is CausaExencionIva {
  return typeof valor === 'string' && CLAVES_EXENCION_IVA.includes(valor)
}

export function infoCausaExencion(clave: CausaExencionIva): InfoCausaExencion {
  return CAUSAS_EXENCION_IVA.find((c) => c.clave === clave) as InfoCausaExencion
}

/** Longitud máxima del detalle libre de la exención (columna invoices.exencion_detalle). */
export const MAX_DETALLE_EXENCION = 200

const LEY_IVA = 'Ley 37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido'

/**
 * Mención de exención que debe constar en la factura (art. 6.1.j RD 1619/2012:
 * referencia a los preceptos de la Ley del Impuesto o indicación de que la
 * operación está exenta; también en simplificadas, art. 7.1.i).
 * `detalle` es el texto libre del usuario (precepto concreto, p. ej.
 * «art. 20.Uno.23.º, arrendamiento de vivienda»); obligatorio en E6.
 */
export function mencionExencion(clave: CausaExencionIva, detalle?: string | null): string {
  const info = infoCausaExencion(clave)
  const base = info.articulos
    ? `Operación exenta de IVA (${info.articulos} de la ${LEY_IVA}).`
    : `Operación exenta de IVA conforme a la ${LEY_IVA}.`
  const extra = (detalle ?? '').trim()
  return extra ? `${base} ${extra}` : base
}

export type ExencionValidada =
  | { ok: true; operacion_exenta: CausaExencionIva | null; exencion_detalle: string | null }
  | { ok: false; error: string }

/**
 * Valida lo que el usuario indica sobre la exención al crear una factura:
 *  · con IVA repercutido (tipo > 0) no puede haber causa de exención;
 *  · con IVA al 0 % la causa es obligatoria y debe ser de la lista L10 (E1-E6);
 *  · E5 no está disponible todavía (ver CAUSAS_EXENCION_IVA);
 *  · en E6 («otros») hay que escribir el precepto, porque la clave no lo dice.
 */
export function validarExencion(ivaRate: number, causa: unknown, detalle: unknown): ExencionValidada {
  const texto = typeof detalle === 'string' ? detalle.replace(/[\u0000-\u001F]+/g, ' ').trim() : ''
  const hayCausa = causa !== undefined && causa !== null && causa !== ''
  if (Number(ivaRate) !== 0) {
    if (hayCausa) {
      return { ok: false, error: 'La causa de exención solo se indica cuando el IVA es 0 % (operación exenta).' }
    }
    return { ok: true, operacion_exenta: null, exencion_detalle: null }
  }
  if (!esCausaExencionIva(causa)) {
    return {
      ok: false,
      error:
        'Con IVA al 0 % hay que indicar la causa de exención (artículo de la Ley del IVA que ampara la operación): ' +
        'debe constar en la factura y en su registro VERI*FACTU.',
    }
  }
  if (!infoCausaExencion(causa).disponible) {
    return {
      ok: false,
      error:
        'Las entregas de bienes a otro Estado miembro (art. 25 de la Ley del IVA) todavía no se pueden facturar con ' +
        'Kuentas: exigen identificar al cliente con su NIF-IVA.',
    }
  }
  if (texto.length > MAX_DETALLE_EXENCION) {
    return { ok: false, error: `El detalle de la exención no puede superar los ${MAX_DETALLE_EXENCION} caracteres.` }
  }
  if (causa === 'E6' && texto.length < 3) {
    return {
      ok: false,
      error: 'En «exenta por otros» hay que escribir el precepto que ampara la exención: se imprime en la factura.',
    }
  }
  return { ok: true, operacion_exenta: causa, exencion_detalle: texto === '' ? null : texto }
}

/**
 * Clave de régimen (lista L8A) que acompaña a una operación exenta. Con la
 * clave 01 la AEAT no admite E2 ni E3 (Validaciones §15.5) y la clave 02
 * («Exportación») solo admite operaciones exentas (§15.6.1): E2 y E3 van con 02.
 */
export function claveRegimenParaExenta(clave: CausaExencionIva): '01' | '02' {
  return clave === 'E2' || clave === 'E3' ? '02' : '01'
}

// ---------------------------------------------------------------------------
// Clase de factura, serie y título del documento
// ---------------------------------------------------------------------------

/** Lista L2 del diseño de registro. */
export type TipoFacturaFiscal = 'F1' | 'F2' | 'F3' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'

const TIPOS_FACTURA_FISCAL: readonly string[] = ['F1', 'F2', 'F3', 'R1', 'R2', 'R3', 'R4', 'R5']

export function esTipoFacturaFiscal(valor: unknown): valor is TipoFacturaFiscal {
  return typeof valor === 'string' && TIPOS_FACTURA_FISCAL.includes(valor)
}

/**
 * Clase de serie: una serie solo contiene facturas de una clase.
 *  · Las rectificativas van «en todo caso» en serie específica (art. 6.1.a.2.º).
 *  · Si en un mismo año natural se expiden facturas completas (art. 6) y
 *    simplificadas (art. 7), es obligatorio usar series separadas (art. 7.1.a,
 *    último párrafo). Las rectificativas de simplificadas son también facturas
 *    simplificadas (arts. 7.1.h y 15.5), así que no comparten serie con las
 *    rectificativas completas.
 */
export type ClaseSerie = 'ordinaria' | 'simplificada' | 'rectificativa' | 'rectificativa_simplificada'

export function claseSerie(tipo: TipoFacturaFiscal): ClaseSerie {
  if (tipo === 'F2') return 'simplificada'
  if (tipo === 'R5') return 'rectificativa_simplificada'
  if (tipo.startsWith('R')) return 'rectificativa'
  return 'ordinaria'
}

/** Serie por defecto de cada clase: F completas · S simplificadas · R rectificativas · RS rectificativas de simplificadas. */
export const SERIE_POR_CLASE: Readonly<Record<ClaseSerie, string>> = Object.freeze({
  ordinaria: 'F',
  simplificada: 'S',
  rectificativa: 'R',
  rectificativa_simplificada: 'RS',
})

export function serieParaTipoFactura(tipo: TipoFacturaFiscal): string {
  return SERIE_POR_CLASE[claseSerie(tipo)]
}

export function esSimplificada(tipo: TipoFacturaFiscal): boolean {
  return tipo === 'F2' || tipo === 'R5'
}

export function esRectificativa(tipo: TipoFacturaFiscal): boolean {
  return tipo.startsWith('R')
}

/** Título que encabeza el documento (PDF) según el tipo de factura. */
export function tituloDocumento(tipo: TipoFacturaFiscal): string {
  switch (claseSerie(tipo)) {
    case 'simplificada':
      return 'FACTURA SIMPLIFICADA'
    case 'rectificativa':
      return 'FACTURA RECTIFICATIVA'
    case 'rectificativa_simplificada':
      return 'FACTURA SIMPLIFICADA RECTIFICATIVA'
    default:
      return 'FACTURA'
  }
}

/**
 * Tipo de factura de un documento, para titularlo. Si la factura ya está
 * emitida manda el tipo con el que se registró (`tipo_factura`). Si no (flujo
 * sin VERI*FACTU o vista previa): sin NIF del cliente es simplificada (F2) y
 * con NIF es completa (F1). Un NIF que no sea español válido no la convierte en
 * simplificada: con VERI*FACTU activo esa factura no llega a emitirse
 * (`nif_cliente_invalido`), y sin él es una factura con un documento extranjero.
 */
export function tipoFacturaDeDocumento(doc: {
  tipo_factura?: string | null
  client_nif?: string | null
}): TipoFacturaFiscal {
  if (esTipoFacturaFiscal(doc.tipo_factura)) return doc.tipo_factura
  return situacionNifCliente(doc.client_nif) === 'vacio' ? 'F2' : 'F1'
}

/** Tipo de rectificativa que corresponde según la factura que se rectifica (lista L2). */
export function tipoRectificativaPara(
  tipoRectificada: string | null | undefined,
  elegido?: string | null
): TipoFacturaFiscal {
  // R5 = «Factura rectificativa en facturas simplificadas».
  if (tipoRectificada === 'F2' || tipoRectificada === 'R5') return 'R5'
  if (elegido === 'R1' || elegido === 'R2' || elegido === 'R3' || elegido === 'R4') return elegido
  return 'R1'
}

export interface InfoTipoRectificativa {
  clave: 'R1' | 'R2' | 'R3' | 'R4'
  /** Descripción oficial de la lista L2 (DsRegistroVeriFactu.xlsx). */
  descripcionOficial: string
  /** A qué se refiere, con las palabras del art. 80 de la Ley 37/1992. */
  ayuda: string
}

/** Tipos de rectificativa de facturas completas que el usuario puede elegir. */
export const TIPOS_RECTIFICATIVA: readonly InfoTipoRectificativa[] = Object.freeze([
  {
    clave: 'R1',
    descripcionOficial: 'Factura rectificativa (error fundado en derecho y art. 80 Uno, Dos y Seis LIVA)',
    ayuda:
      'Devolución de envases y embalajes, descuentos y bonificaciones posteriores, operaciones que quedan sin efecto o cambio del precio, precio fijado provisionalmente, o error fundado en derecho.',
  },
  {
    clave: 'R2',
    descripcionOficial: 'Factura rectificativa (art. 80.3)',
    ayuda: 'El cliente no ha pagado y se ha dictado auto de declaración de concurso.',
  },
  {
    clave: 'R3',
    descripcionOficial: 'Factura rectificativa (art. 80.4)',
    ayuda: 'Créditos total o parcialmente incobrables.',
  },
  {
    clave: 'R4',
    descripcionOficial: 'Factura rectificativa (resto)',
    ayuda: 'Cualquier otra causa de rectificación.',
  },
])

// ---------------------------------------------------------------------------
// Límites de la factura simplificada (art. 4 RD 1619/2012)
// ---------------------------------------------------------------------------

/** Art. 4.1.a): importe máximo, IVA incluido, con carácter general. */
export const LIMITE_SIMPLIFICADA_GENERAL = 400
/** Art. 4.2: importe máximo, IVA incluido, en las actividades que enumera (comercio al por menor, hostelería, transporte de personas…). */
export const LIMITE_SIMPLIFICADA_ART_4_2 = 3000
