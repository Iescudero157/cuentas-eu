// ---------------------------------------------------------------------------
// V09 · Parser XML ligero para las respuestas del servicio web de la AEAT.
//
// Sin dependencias: analiza el subconjunto de XML que produce el servicio
// RegFactuSistemaFacturacion (elementos con espacios de nombres, atributos,
// texto, CDATA y comentarios). Por seguridad RECHAZA cualquier DOCTYPE o
// entidad no predefinida: las respuestas AEAT nunca los usan y así el parser
// es inmune a XXE / billion laughs por construcción.
// ---------------------------------------------------------------------------

export class ErrorXml extends Error {
  constructor(mensaje: string) {
    super(`XML mal formado: ${mensaje}`)
    this.name = 'ErrorXml'
  }
}

export interface ElementoXml {
  /** Nombre local del elemento, sin prefijo de espacio de nombres. */
  nombre: string
  /** Atributos con su nombre tal cual aparece (incluido prefijo si lo hay). */
  atributos: Record<string, string>
  hijos: ElementoXml[]
  /** Texto directo del elemento (concatenado y con entidades resueltas), sin recortar. */
  texto: string
}

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

// V24: una referencia numérica solo es válida si es un carácter permitido en
// XML 1.0 (fuera de rango o surrogate suelto, `String.fromCodePoint` lanzaría
// un RangeError NO tipado; aquí se convierte en ErrorXml).
function codePointXmlValido(codigo: number): boolean {
  if (!Number.isInteger(codigo)) return false
  if (codigo === 0x9 || codigo === 0xa || codigo === 0xd) return true
  if (codigo >= 0x20 && codigo <= 0xd7ff) return true
  if (codigo >= 0xe000 && codigo <= 0xfffd) return true
  return codigo >= 0x10000 && codigo <= 0x10ffff
}

function decodificarEntidades(texto: string): string {
  // Captura cada entidad `&…;` o, si no la hay, el `&` suelto (mal formado).
  return texto.replace(/&([^;&\s]{1,32});|&/g, (todo, cuerpo?: string) => {
    if (cuerpo === undefined) throw new ErrorXml('«&» sin entidad (debe escaparse como &amp;)')
    if (cuerpo in ENTIDADES) return ENTIDADES[cuerpo]
    if (cuerpo.startsWith('#x') || cuerpo.startsWith('#X')) {
      const codigo = Number.parseInt(cuerpo.slice(2), 16)
      if (codePointXmlValido(codigo)) return String.fromCodePoint(codigo)
    } else if (cuerpo.startsWith('#')) {
      const codigo = Number.parseInt(cuerpo.slice(1), 10)
      if (codePointXmlValido(codigo)) return String.fromCodePoint(codigo)
    }
    throw new ErrorXml(`entidad no soportada «&${cuerpo};»`)
  })
}

function nombreLocal(nombre: string): string {
  const i = nombre.lastIndexOf(':')
  return i === -1 ? nombre : nombre.slice(i + 1)
}

const RE_NOMBRE = /^[A-Za-z_][\w.:-]*/
const RE_ATRIBUTO = /^([A-Za-z_][\w.:-]*)\s*=\s*("([^"<]*)"|'([^'<]*)')/

/**
 * Parsea un documento XML y devuelve su elemento raíz.
 * Los nombres de elemento se devuelven SIN prefijo (nombre local): la AEAT
 * es libre de elegir los prefijos (`env:`, `soapenv:`, `sfR:`…) y el
 * consumidor solo debe depender de los nombres locales del XSD.
 */
// V24: topes defensivos. Las respuestas reales de la AEAT son de unos KB;
// estos límites solo cortan documentos anómalos (agotamiento de memoria).
const MAX_XML_CHARS = 20 * 1024 * 1024
const MAX_PROFUNDIDAD = 256

export function parsearXml(xml: string): ElementoXml {
  if (xml.length > MAX_XML_CHARS) {
    throw new ErrorXml(`documento de más de ${MAX_XML_CHARS} caracteres rechazado`)
  }
  let pos = 0
  const fin = xml.length
  const pila: ElementoXml[] = []
  let raiz: ElementoXml | null = null

  const fallo = (mensaje: string): never => {
    throw new ErrorXml(`${mensaje} (posición ${pos})`)
  }

  const anadirTexto = (bruto: string, decodificar: boolean) => {
    if (pila.length === 0) {
      if (bruto.trim() !== '') fallo('texto fuera del elemento raíz')
      return
    }
    const el = pila[pila.length - 1]
    el.texto += decodificar ? decodificarEntidades(bruto) : bruto
  }

  while (pos < fin) {
    const abre = xml.indexOf('<', pos)
    if (abre === -1) {
      anadirTexto(xml.slice(pos), true)
      break
    }
    if (abre > pos) anadirTexto(xml.slice(pos, abre), true)
    pos = abre

    if (xml.startsWith('<?', pos)) {
      const cierre = xml.indexOf('?>', pos + 2)
      if (cierre === -1) fallo('instrucción de proceso sin cerrar')
      pos = cierre + 2
    } else if (xml.startsWith('<!--', pos)) {
      const cierre = xml.indexOf('-->', pos + 4)
      if (cierre === -1) fallo('comentario sin cerrar')
      pos = cierre + 3
    } else if (xml.startsWith('<![CDATA[', pos)) {
      const cierre = xml.indexOf(']]>', pos + 9)
      if (cierre === -1) fallo('CDATA sin cerrar')
      anadirTexto(xml.slice(pos + 9, cierre), false)
      pos = cierre + 3
    } else if (xml.startsWith('<!', pos)) {
      // DOCTYPE u otra declaración: prohibido a propósito (anti-XXE).
      fallo('declaración <!…> no permitida (DOCTYPE rechazado por seguridad)')
    } else if (xml.startsWith('</', pos)) {
      pos += 2
      const m = RE_NOMBRE.exec(xml.slice(pos))
      if (!m) fallo('nombre de cierre inválido')
      const nombre = nombreLocal(m![0])
      pos += m![0].length
      while (pos < fin && /\s/.test(xml[pos])) pos++
      if (xml[pos] !== '>') fallo('cierre de etiqueta inválido')
      pos++
      const el = pila.pop()
      if (!el) fallo(`cierre «${nombre}» sin apertura`)
      if (el!.nombre !== nombre) fallo(`cierre «${nombre}» no casa con apertura «${el!.nombre}»`)
    } else {
      pos++
      const m = RE_NOMBRE.exec(xml.slice(pos))
      if (!m) fallo('nombre de elemento inválido')
      const el: ElementoXml = { nombre: nombreLocal(m![0]), atributos: {}, hijos: [], texto: '' }
      pos += m![0].length
      for (;;) {
        while (pos < fin && /\s/.test(xml[pos])) pos++
        if (pos >= fin) fallo('etiqueta sin cerrar')
        if (xml[pos] === '>' || xml.startsWith('/>', pos)) break
        const a = RE_ATRIBUTO.exec(xml.slice(pos))
        if (!a) fallo('atributo inválido')
        el.atributos[a![1]] = decodificarEntidades(a![3] ?? a![4] ?? '')
        pos += a![0].length
      }
      if (raiz && pila.length === 0) fallo('más de un elemento raíz')
      if (pila.length > 0) pila[pila.length - 1].hijos.push(el)
      else raiz = el
      if (xml.startsWith('/>', pos)) {
        pos += 2
      } else {
        pos++ // '>'
        if (pila.length >= MAX_PROFUNDIDAD) fallo(`anidamiento de más de ${MAX_PROFUNDIDAD} niveles`)
        pila.push(el)
      }
    }
  }

  if (pila.length > 0) throw new ErrorXml(`elemento «${pila[pila.length - 1].nombre}» sin cerrar`)
  if (!raiz) throw new ErrorXml('documento vacío, sin elemento raíz')
  return raiz
}

/** Primer hijo directo con ese nombre local, o null. */
export function hijo(el: ElementoXml, nombre: string): ElementoXml | null {
  return el.hijos.find((h) => h.nombre === nombre) ?? null
}

/** Todos los hijos directos con ese nombre local. */
export function hijosDe(el: ElementoXml, nombre: string): ElementoXml[] {
  return el.hijos.filter((h) => h.nombre === nombre)
}

/** Texto (recortado) del primer hijo con ese nombre, o null si no existe. */
export function textoDe(el: ElementoXml, nombre: string): string | null {
  const h = hijo(el, nombre)
  return h ? h.texto.trim() : null
}

/** Como `textoDe` pero exige que el hijo exista y tenga texto. */
export function textoObligatorio(el: ElementoXml, nombre: string, contexto: string): string {
  const t = textoDe(el, nombre)
  if (t === null || t === '') throw new ErrorXml(`falta «${nombre}» en ${contexto}`)
  return t
}
