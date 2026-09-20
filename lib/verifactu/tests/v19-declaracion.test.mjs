// Tests V19: declaración responsable del SIF (declaracion-responsable.ts).
// Comprueba que la declaración contiene TODO el contenido mínimo del art. 15.1
// de la Orden HAC/1177/2024 (letras a–l), que sus datos identificativos
// coinciden 1:1 con el bloque SistemaInformatico que viaja en cada registro
// (art. 10.1.l RRSIF) y que, mientras sea borrador, va marcada como tal y con
// los placeholders de [REVISIÓN IVAN/ASESOR]. Ejecutar con: npm test.

import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { sistemaInformaticoKuentas } from '../registro-alta.ts'
import {
  DECLARACION_ES_BORRADOR,
  declaracionResponsableKuentas,
  textoDeclaracionResponsable,
} from '../declaracion-responsable.ts'

test('V19: los datos identificativos coinciden 1:1 con el bloque SistemaInformatico', () => {
  const si = sistemaInformaticoKuentas('KU-cualquiera')
  const d = declaracionResponsableKuentas()

  assert.equal(d.sistema.nombre, si.nombreSistemaInformatico)
  assert.equal(d.sistema.idSistemaInformatico, si.idSistemaInformatico)
  assert.equal(d.sistema.version, si.version)
  assert.equal(d.sistema.soloVerifactu, si.tipoUsoPosibleSoloVerifactu === 'S')
  assert.equal(d.sistema.multiplesObligados, si.tipoUsoPosibleMultiOT === 'S')
  assert.equal(d.productor.razonSocial, si.nombreRazon)
  assert.equal(d.productor.nif, si.nif)
})

test('V19: título literal del art. 15.1 de la Orden HAC/1177/2024', () => {
  const d = declaracionResponsableKuentas()
  assert.equal(d.titulo, 'DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN')
  assert.ok(textoDeclaracionResponsable(d).includes(d.titulo))
})

test('V19: contenido mínimo completo (letras a–l del art. 15.1 Orden)', () => {
  const d = declaracionResponsableKuentas()
  const texto = textoDeclaracionResponsable(d)

  // Todas las letras presentes (h, i y j van agrupadas como datos del productor).
  const letras = d.apartados.map((ap) => ap.letra)
  assert.deepEqual(letras, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h-j', 'k', 'l'])

  // a) nombre · b) código · c) versión
  assert.ok(texto.includes('Kuentas'))
  assert.ok(texto.includes(`«${d.sistema.idSistemaInformatico}»`))
  assert.ok(texto.includes(`Versión ${d.sistema.version}`))
  // d) componentes y funcionalidades, incluida la prohibición de doble uso
  assert.ok(texto.includes('SaaS'))
  assert.ok(texto.includes('modos de funcionamiento ocultos'))
  // e) solo VERI*FACTU (coherente con TipoUsoPosibleSoloVerifactu='S', DEC-V14)
  assert.ok(d.sistema.soloVerifactu)
  assert.ok(texto.includes('únicamente puede funcionar como sistema de emisión de facturas verificables'))
  // f) varios obligados tributarios
  assert.ok(texto.includes('varios obligados tributarios'))
  // g) tipos de firma (en VERI*FACTU no se firman: art. 16.3 RRSIF)
  assert.ok(texto.includes('No se utiliza firma electrónica'))
  assert.ok(texto.includes('art. 16.3 del Real Decreto 1007/2023'))
  // h-j) productor: razón social, NIF y dirección postal completa
  assert.ok(texto.includes('Mercadonet Global S.L.'))
  assert.ok(texto.includes('B98407901'))
  assert.ok(texto.includes('Torrent (Valencia)'))
  // k) declaración expresa de cumplimiento con las tres normas
  assert.ok(texto.includes('DECLARA BAJO SU RESPONSABILIDAD'))
  assert.ok(texto.includes('Ley 58/2003'))
  assert.ok(texto.includes('Real Decreto 1007/2023'))
  assert.ok(texto.includes('Orden HAC/1177/2024'))
  // l) fecha y lugar de suscripción (placeholder mientras sea borrador)
  assert.ok(texto.includes('LUGAR Y FECHA DE SUSCRIPCIÓN'))
})

test('V19: el borrador va marcado y con placeholders de revisión', () => {
  const d = declaracionResponsableKuentas()
  assert.equal(d.esBorrador, DECLARACION_ES_BORRADOR)
  assert.ok(d.esBorrador, 'sigue siendo borrador hasta la ratificación de Iván/asesor')

  const texto = textoDeclaracionResponsable(d)
  assert.ok(texto.startsWith('*** BORRADOR PENDIENTE DE REVISIÓN'))
  assert.ok(texto.trimEnd().endsWith('***'))

  // Todo apartado pendiente lleva su marca visible en el propio texto.
  for (const ap of d.apartados.filter((a) => a.pendienteRevision)) {
    const cuerpo = ap.parrafos.join('\n')
    assert.ok(
      /REVISIÓN IVAN/.test(cuerpo),
      `apartado ${ap.letra} pendiente sin marca [REVISIÓN IVAN]: ${cuerpo.slice(0, 80)}`
    )
  }
  assert.ok(d.pendientes.length >= 4)
})

test('V19: salida determinista (misma declaración en cada llamada)', () => {
  assert.equal(textoDeclaracionResponsable(), textoDeclaracionResponsable())
  assert.deepEqual(declaracionResponsableKuentas(), declaracionResponsableKuentas())
})
