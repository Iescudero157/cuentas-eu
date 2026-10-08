// ---------------------------------------------------------------------------
// V18 · Catálogo de validaciones y errores AEAT (lib/verifactu/errores-aeat.ts).
//
// Verifica que el catálogo tipado coincide CÓDIGO A CÓDIGO con el fichero
// oficial docs/verifactu/validaciones/errores.properties (conservado intacto,
// ISO-8859-1). Si la AEAT publica una versión nueva del fichero, este test
// obliga a regenerar el catálogo.
// ---------------------------------------------------------------------------

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ERRORES_AEAT,
  FUENTE_ERRORES_AEAT,
  errorAeat,
  descripcionErrorAeat,
  esRechazoEnvio,
  esRechazoRegistro,
  esAceptadoConErrores,
  CODIGO_DUPLICADO,
} from '../errores-aeat.ts'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const PROPERTIES = join(RAIZ, 'docs', 'verifactu', 'validaciones', 'errores.properties')

function parsearProperties() {
  const crudo = readFileSync(PROPERTIES)
  const texto = crudo.toString('latin1')
  const ambitos = ['rechazo_envio', 'rechazo_registro', 'aceptado_con_errores']
  let seccion = -1
  const entradas = new Map()
  for (const linea of texto.split(/\r?\n/)) {
    if (/^\*{5,}/.test(linea.trim())) {
      seccion++
      continue
    }
    const m = /^(\d+)\s*=\s*(.*)$/.exec(linea.trim())
    if (!m) continue
    assert.ok(seccion >= 0 && seccion <= 2, `código ${m[1]} fuera de las 3 secciones oficiales`)
    entradas.set(Number(m[1]), { ambito: ambitos[seccion], descripcion: m[2].trim() })
  }
  return { crudo, entradas }
}

test('el fichero oficial no ha cambiado desde la generación del catálogo (SHA-256)', () => {
  const { crudo } = parsearProperties()
  const sha = createHash('sha256').update(crudo).digest('hex')
  assert.equal(
    sha,
    FUENTE_ERRORES_AEAT.sha256,
    'errores.properties cambió: re-descargar de la AEAT, regenerar errores-aeat.ts y actualizar FUENTES.md'
  )
})

test('el catálogo coincide código a código con errores.properties', () => {
  const { entradas } = parsearProperties()
  assert.equal(ERRORES_AEAT.size, entradas.size)
  for (const [codigo, oficial] of entradas) {
    const e = ERRORES_AEAT.get(codigo)
    assert.ok(e, `código ${codigo} ausente del catálogo`)
    assert.equal(e.ambito, oficial.ambito, `ámbito distinto en ${codigo}`)
    assert.equal(e.descripcion, oficial.descripcion, `descripción distinta en ${codigo}`)
  }
})

test('semántica de los ámbitos en códigos clave', () => {
  // 4102: XML fuera de esquema → rechaza el envío completo.
  assert.ok(esRechazoEnvio(4102))
  // 1142: cuota incoherente con base×tipo → rechaza el registro.
  assert.ok(esRechazoRegistro(1142))
  // 3000: duplicado → rechazo del registro con tratamiento idempotente (V09/V10).
  assert.equal(CODIGO_DUPLICADO, 3000)
  assert.ok(esRechazoRegistro(3000))
  // 2000 (huella incorrecta) y 2001 (destinatario no censado): aceptados con
  // errores → quedan registrados y deben subsanarse (flujo V12).
  assert.ok(esAceptadoConErrores(2000))
  assert.ok(esAceptadoConErrores(2001))
  // Un código nunca puede estar en dos ámbitos.
  assert.equal(esRechazoEnvio(2000) || esRechazoRegistro(2000), false)
})

test('descripcionErrorAeat y errorAeat', () => {
  assert.match(descripcionErrorAeat(3000), /^\[3000\] Registro de facturación duplicado\./)
  assert.equal(errorAeat(999999), undefined)
  assert.match(descripcionErrorAeat(999999), /no catalogado/i)
})

test('todo código tiene descripción no vacía y ámbito válido', () => {
  for (const e of ERRORES_AEAT.values()) {
    assert.ok(e.descripcion.length > 0, `código ${e.codigo} sin descripción`)
    assert.ok(
      ['rechazo_envio', 'rechazo_registro', 'aceptado_con_errores'].includes(e.ambito),
      `código ${e.codigo} con ámbito inválido`
    )
  }
})
