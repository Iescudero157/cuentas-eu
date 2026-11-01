// Tests V19: declaración responsable del SIF (declaracion-responsable.ts).
// Comprueba que la declaración contiene TODO el contenido mínimo del art. 15.1
// de la Orden HAC/1177/2024 (letras a–l), que sus datos identificativos
// coinciden 1:1 con el bloque SistemaInformatico que viaja en cada registro
// (art. 10.1.l RRSIF), que mientras sea borrador va marcada como tal y con
// los placeholders de [REVISIÓN IVAN], y que solo sale como definitiva con
// lugar, fecha y firmante. Ejecutar con: npm test.

import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { sistemaInformaticoKuentas } from '../registro-alta.ts'
import { PRODUCTOR_PRUEBAS } from './helpers/productor-pruebas.mjs'
import {
  DECLARACION_ES_BORRADOR,
  SUSCRIPCION_DECLARACION,
  declaracionResponsableKuentas,
  suscripcionCompleta,
  textoDeclaracionResponsable,
} from '../declaracion-responsable.ts'

const SUSCRIPCION_EJEMPLO = {
  lugar: 'Madrid',
  fecha: '2026-11-01',
  firmante: 'Nombre Apellido Apellido',
  cargo: 'administrador solidario',
}

test('V19: los datos identificativos coinciden 1:1 con el bloque SistemaInformatico', () => {
  const si = sistemaInformaticoKuentas('KU-cualquiera', PRODUCTOR_PRUEBAS)
  const d = declaracionResponsableKuentas()

  assert.equal(d.sistema.nombre, si.nombreSistemaInformatico)
  assert.equal(d.sistema.idSistemaInformatico, si.idSistemaInformatico)
  assert.equal(d.sistema.version, si.version)
  assert.equal(d.sistema.soloVerifactu, si.tipoUsoPosibleSoloVerifactu === 'S')
  assert.equal(d.sistema.multiplesObligados, si.tipoUsoPosibleMultiOT === 'S')
  // El productor real (PRODUCTOR_SIF) es el de la declaración; el de pruebas solo alimenta los generadores.
  const real = sistemaInformaticoKuentas('KU-cualquiera')
  assert.equal(d.productor.razonSocial, real.nombreRazon)
  assert.equal(d.productor.nif, real.nif || '{{MILBROTES_CIF}}')
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
  // Productor: MILBROTES, S.L. (Mercadonet pasa a ser solo cliente).
  assert.ok(texto.includes('MILBROTES, S.L.'))
  assert.ok(!texto.includes('Mercadonet'))
  assert.ok(texto.includes(d.productor.nif))
  assert.ok(texto.includes('28006 Madrid'))
  // k) declaración expresa de cumplimiento con las tres normas
  assert.ok(texto.includes('DECLARA BAJO SU RESPONSABILIDAD'))
  assert.ok(texto.includes('Ley 58/2003'))
  assert.ok(texto.includes('Real Decreto 1007/2023'))
  assert.ok(texto.includes('Orden HAC/1177/2024'))
  // l) fecha y lugar de suscripción (placeholder mientras sea borrador)
  assert.ok(texto.includes(d.esBorrador ? 'LUGAR Y FECHA DE SUSCRIPCIÓN' : 'Suscrita en '))
})

test('V19: el borrador va marcado y con placeholders de revisión', () => {
  const d = declaracionResponsableKuentas({ borrador: true, suscripcion: { lugar: '', fecha: '', firmante: '', cargo: '' } })
  assert.ok(d.esBorrador)

  const texto = textoDeclaracionResponsable(d)
  assert.ok(texto.startsWith('*** BORRADOR PENDIENTE DE SUSCRIPCIÓN'))
  assert.ok(texto.trimEnd().endsWith('***'))

  // Todo apartado pendiente lleva su marca visible en el propio texto.
  const pendientes = d.apartados.filter((a) => a.pendienteRevision)
  assert.deepEqual(pendientes.map((a) => a.letra), ['l'])
  for (const ap of pendientes) {
    const cuerpo = ap.parrafos.join('\n')
    assert.ok(
      /REVISIÓN IVAN/.test(cuerpo),
      `apartado ${ap.letra} pendiente sin marca [REVISIÓN IVAN]: ${cuerpo.slice(0, 80)}`
    )
  }
  assert.ok(d.pendientes.some((p) => p.includes('SUSCRIPCION_DECLARACION')))
})

test('V19: sin lugar, fecha válida y firmante nunca sale como definitiva', () => {
  for (const s of [
    { ...SUSCRIPCION_EJEMPLO, lugar: '' },
    { ...SUSCRIPCION_EJEMPLO, fecha: '' },
    { ...SUSCRIPCION_EJEMPLO, fecha: '2026-02-30' },
    { ...SUSCRIPCION_EJEMPLO, fecha: '01-11-2026' },
    { ...SUSCRIPCION_EJEMPLO, firmante: '  ' },
    { ...SUSCRIPCION_EJEMPLO, cargo: '' },
  ]) {
    assert.equal(suscripcionCompleta(s), false)
    const d = declaracionResponsableKuentas({ borrador: false, suscripcion: s })
    assert.ok(d.esBorrador, `debería seguir en borrador con ${JSON.stringify(s)}`)
    assert.ok(textoDeclaracionResponsable(d).startsWith('*** BORRADOR'))
  }
})

test('V19: versión suscrita, sin avisos ni placeholders', () => {
  const d = declaracionResponsableKuentas({ borrador: false, suscripcion: SUSCRIPCION_EJEMPLO })
  assert.equal(d.esBorrador, false)
  assert.deepEqual(d.pendientes, [])
  assert.ok(d.apartados.every((a) => !a.pendienteRevision))

  const texto = textoDeclaracionResponsable(d)
  assert.ok(texto.startsWith(d.titulo))
  assert.ok(!/\*\*\*|BORRADOR|REVISIÓN|\{\{|\[/.test(texto), 'la versión suscrita no lleva marcas ni placeholders')
  assert.ok(texto.includes('Suscrita en Madrid, a 1 de noviembre de 2026.'))
  assert.ok(texto.includes('Por MILBROTES, S.L.: Nombre Apellido Apellido, administrador solidario.'))
})

test('V19: el estado publicado es coherente (definitiva solo con suscripción completa)', () => {
  const d = declaracionResponsableKuentas()
  assert.equal(d.esBorrador, DECLARACION_ES_BORRADOR || !suscripcionCompleta(SUSCRIPCION_DECLARACION))
  if (!DECLARACION_ES_BORRADOR) {
    assert.ok(suscripcionCompleta(SUSCRIPCION_DECLARACION), 'DECLARACION_ES_BORRADOR = false exige SUSCRIPCION_DECLARACION completa')
    assert.deepEqual(d.pendientes, [])
  }
})

test('V19: salida determinista (misma declaración en cada llamada)', () => {
  assert.equal(textoDeclaracionResponsable(), textoDeclaracionResponsable())
  assert.deepEqual(declaracionResponsableKuentas(), declaracionResponsableKuentas())
})
