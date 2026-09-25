// Tests V24: hardening de seguridad.
//  - seguridad-http: comparación timing-safe del CRON_SECRET (fail-closed),
//    limitador de tasa por ventana fija y rechazo temprano por Content-Length.
//  - templates de email: escape HTML de todo dato controlado por el usuario.
//  - xml-ligero: topes de tamaño/profundidad y referencias numéricas ilegales.
//  - registro-alta: caracteres de control rechazados en validarTexto.
//  - aeat-cliente: cuerpos crudos NO enumerables en los errores tipados.
// Ejecutar con: npm test  (node --test, sin transpilación).

import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import {
  autorizacionCronValida,
  claveIp,
  cuerpoExcedeLimite,
  limitarTasa,
  reiniciarLimitadorParaTests,
  respuesta429,
  secretosIguales,
} from '../seguridad-http.ts'
import { invoiceEmailTemplate } from '../../email/templates.ts'
import { parsearXml, ErrorXml } from '../xml-ligero.ts'
import { validarTexto } from '../registro-alta.ts'
import { ErrorHttpAeat, ErrorRespuestaAeat, ErrorTransporteAeat } from '../aeat-cliente.ts'

// ---------------------------------------------------------------------------
// seguridad-http · autorización de crons
// ---------------------------------------------------------------------------

const peticion = (auth) =>
  new Request('https://kuentas.eu/api/cron/x', {
    headers: auth === undefined ? {} : { authorization: auth },
  })

test('secretosIguales: iguales/distintos/longitudes distintas', () => {
  assert.equal(secretosIguales('abc', 'abc'), true)
  assert.equal(secretosIguales('abc', 'abd'), false)
  assert.equal(secretosIguales('abc', 'abcd'), false)
  assert.equal(secretosIguales('', ''), true)
})

test('autorizacionCronValida: acepta el Bearer correcto', () => {
  assert.equal(autorizacionCronValida(peticion('Bearer s3creto'), 's3creto'), true)
})

test('autorizacionCronValida: fail-closed sin secreto configurado', () => {
  // El caso «Bearer undefined» que dejaba abierta fiscal-alerts
  assert.equal(autorizacionCronValida(peticion('Bearer undefined'), undefined), false)
  assert.equal(autorizacionCronValida(peticion('Bearer '), ''), false)
})

test('autorizacionCronValida: rechaza cabecera ausente, malformada o errónea', () => {
  assert.equal(autorizacionCronValida(peticion(undefined), 's3creto'), false)
  assert.equal(autorizacionCronValida(peticion('s3creto'), 's3creto'), false)
  assert.equal(autorizacionCronValida(peticion('Bearer otro'), 's3creto'), false)
})

// ---------------------------------------------------------------------------
// seguridad-http · limitador de tasa
// ---------------------------------------------------------------------------

test('limitarTasa: permite hasta max y corta después con Retry-After', () => {
  reiniciarLimitadorParaTests()
  const t0 = 1_000_000
  for (let i = 0; i < 3; i++) {
    assert.equal(limitarTasa('k', 3, 60_000, t0 + i).permitido, true, `petición ${i + 1}`)
  }
  const cuarta = limitarTasa('k', 3, 60_000, t0 + 10)
  assert.equal(cuarta.permitido, false)
  assert.ok(cuarta.reintentarEnSegundos >= 1 && cuarta.reintentarEnSegundos <= 60)
})

test('limitarTasa: la ventana se reinicia al expirar', () => {
  reiniciarLimitadorParaTests()
  const t0 = 2_000_000
  limitarTasa('k2', 1, 1_000, t0)
  assert.equal(limitarTasa('k2', 1, 1_000, t0 + 500).permitido, false)
  assert.equal(limitarTasa('k2', 1, 1_000, t0 + 1_000).permitido, true)
})

test('limitarTasa: claves independientes por tenant', () => {
  reiniciarLimitadorParaTests()
  const t0 = 3_000_000
  limitarTasa('cert:A', 1, 60_000, t0)
  assert.equal(limitarTasa('cert:A', 1, 60_000, t0 + 1).permitido, false)
  assert.equal(limitarTasa('cert:B', 1, 60_000, t0 + 1).permitido, true)
})

test('respuesta429 lleva Retry-After', async () => {
  const r = respuesta429({ permitido: false, reintentarEnSegundos: 42 })
  assert.equal(r.status, 429)
  assert.equal(r.headers.get('Retry-After'), '42')
})

test('cuerpoExcedeLimite: usa Content-Length si está', () => {
  const conCL = new Request('https://x/', {
    method: 'POST',
    headers: { 'content-length': '2048' },
  })
  assert.equal(cuerpoExcedeLimite(conCL, 1024), true)
  assert.equal(cuerpoExcedeLimite(conCL, 4096), false)
})

test('claveIp: primera IP de x-forwarded-for o sin-ip', () => {
  const con = new Request('https://x/', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })
  assert.equal(claveIp(con), '1.2.3.4')
  assert.equal(claveIp(new Request('https://x/')), 'sin-ip')
})

// ---------------------------------------------------------------------------
// templates de email · escape HTML
// ---------------------------------------------------------------------------

test('invoiceEmailTemplate escapa datos controlados por el usuario', () => {
  const { html } = invoiceEmailTemplate({
    to: 'c@x.es',
    clientName: '<script>alert(1)</script>',
    issuerName: '<img src=x onerror=alert(2)>',
    invoiceNumber: 'F-1"<b>',
    invoiceDate: '1 de enero de 2026',
    dueDate: '1 de enero de 2026',
    total: 121,
    items: [{ description: '<a href="https://phish.example">click</a>', quantity: 1, unitPrice: 100, total: 100 }],
    subtotal: 100,
    iva: 21,
    ivaRate: 21,
    irpf: 0,
    irpfRate: 0,
    notes: '<iframe src="https://phish.example"></iframe>',
  })
  assert.ok(!html.includes('<script>'), 'clientName sin escapar')
  assert.ok(!html.includes('<img src=x'), 'issuerName sin escapar')
  assert.ok(!html.includes('<a href="https://phish.example">'), 'item.description sin escapar')
  assert.ok(!html.includes('<iframe'), 'notes sin escapar')
  assert.ok(html.includes('&lt;script&gt;'), 'debe conservar el texto escapado')
})

// ---------------------------------------------------------------------------
// xml-ligero · topes y referencias numéricas
// ---------------------------------------------------------------------------

test('parsearXml rechaza anidamiento desmedido', () => {
  const n = 300
  const xml = '<a>'.repeat(n) + '</a>'.repeat(n)
  assert.throws(() => parsearXml(xml), ErrorXml)
})

test('parsearXml rechaza referencias numéricas ilegales con ErrorXml (no RangeError)', () => {
  for (const mala of ['&#x110000;', '&#99999999;', '&#0;', '&#xD800;']) {
    assert.throws(() => parsearXml(`<a>${mala}</a>`), ErrorXml, mala)
  }
  // Las válidas siguen funcionando
  assert.equal(parsearXml('<a>&#65;&#x42;</a>').texto, 'AB')
})

test('parsearXml sigue rechazando DOCTYPE (anti-XXE)', () => {
  assert.throws(
    () => parsearXml('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><a>&xxe;</a>'),
    ErrorXml
  )
})

// ---------------------------------------------------------------------------
// registro-alta · caracteres de control
// ---------------------------------------------------------------------------

test('validarTexto rechaza caracteres de control ilegales en XML 1.0', () => {
  const errores = []
  validarTexto('Cliente' + String.fromCharCode(1) + 'SL', 'NombreRazon', 120, errores)
  assert.equal(errores.length, 1)
  assert.match(errores[0], /caracteres de control/)
})

test('validarTexto acepta tabulador/salto de línea y texto normal', () => {
  const errores = []
  validarTexto('Cliente único, S.L.\n(línea 2)\tfin', 'NombreRazon', 120, errores)
  assert.equal(errores.length, 0, errores.join('; '))
})

// ---------------------------------------------------------------------------
// aeat-cliente · cuerpos crudos no enumerables
// ---------------------------------------------------------------------------

test('los cuerpos crudos de los errores AEAT no se serializan', () => {
  const xmlSensible = '<xml>NIF B98407901 ImporteTotal 121.00</xml>'
  const errores = [
    new ErrorHttpAeat(502, xmlSensible),
    new ErrorRespuestaAeat('inesperada', xmlSensible),
    new ErrorTransporteAeat('tls', { detalle: xmlSensible }),
  ]
  for (const e of errores) {
    const volcado = JSON.stringify({ ...e })
    assert.ok(!volcado.includes('B98407901'), `${e.name} vuelca el cuerpo en spread`)
    assert.ok(!JSON.stringify(e).includes('B98407901'), `${e.name} vuelca el cuerpo en JSON.stringify`)
  }
  // Sigue accesible explícitamente para quien lo necesite
  assert.equal(errores[0].cuerpo, xmlSensible)
})
