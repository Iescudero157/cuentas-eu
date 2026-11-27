// V31 — API v1 y conector MCP (27-nov-2026): validación de borradores y tokens.
import test from 'node:test'
import assert from 'node:assert/strict'
import { validarBorrador } from '../borrador.ts'
import { generarToken, hashToken, normalizarPermisos, secretoValido, vueltaPermitida } from '../tokens.ts'

const HOY = '2026-11-27'
const linea = (precio, concepto = 'Consultoría') => ({ concepto, cantidad: 1, precio_unitario: precio })

test('borrador con IVA incluido: 1.210 € → base 1.000 + IVA 210, IRPF 15 % → total 1.060', () => {
  const r = validarBorrador({ cliente: { nombre: 'Cliente S.L.', nif: 'B12345674' }, lineas: [linea(1210)], iva_incluido: true }, null, HOY)
  assert.equal(r.ok, true)
  assert.deepEqual([r.borrador.importes.subtotal, r.borrador.importes.iva, r.borrador.importes.irpf, r.borrador.importes.total], [1000, 210, 150, 1060])
  assert.equal(r.borrador.simplificada, false)
  assert.deepEqual(r.borrador.lineas, [{ description: 'Consultoría', quantity: 1, unitPrice: 1210 }])
})

test('sin NIF: simplificada hasta 400 €; por encima se rechaza', () => {
  const ok = validarBorrador({ cliente: { nombre: 'Particular' }, lineas: [linea(300)], irpf_tipo: 0 }, null, HOY)
  assert.equal(ok.ok, true)
  assert.equal(ok.borrador.simplificada, true)
  const mal = validarBorrador({ cliente: { nombre: 'Particular' }, lineas: [linea(500)], irpf_tipo: 0 }, null, HOY)
  assert.equal(mal.ok, false)
  assert.equal(mal.error, 'simplificada')
})

test('NIF extranjero o mal escrito: se rechaza (solo NIF españoles)', () => {
  for (const nif of ['DE123456789', '12345678A']) {
    const r = validarBorrador({ cliente: { nombre: 'Empresa', nif }, lineas: [linea(10)] }, null, HOY)
    assert.equal(r.ok, false, nif)
    assert.equal(r.error, 'nif')
  }
})

test('IVA 0 %: exige causa de exención; E6 exige el precepto; IVA > 0 con causa se rechaza', () => {
  assert.equal(validarBorrador({ cliente: { nombre: 'Academia', nif: 'B12345674' }, iva_tipo: 0, lineas: [linea(50)] }, null, HOY).error, 'exencion')
  assert.equal(validarBorrador({ cliente: { nombre: 'Academia', nif: 'B12345674' }, iva_tipo: 0, causa_exencion: 'E6', lineas: [linea(50)] }, null, HOY).error, 'exencion')
  const e1 = validarBorrador({ cliente: { nombre: 'Academia', nif: 'B12345674' }, iva_tipo: 0, causa_exencion: 'E1', lineas: [linea(50)] }, null, HOY)
  assert.equal(e1.ok, true)
  assert.equal(e1.borrador.operacion_exenta, 'E1')
  assert.equal(validarBorrador({ cliente: { nombre: 'X S.L.', nif: 'B12345674' }, iva_tipo: 21, causa_exencion: 'E1', lineas: [linea(50)] }, null, HOY).error, 'exencion')
})

test('fecha de operación: futura no; la de hoy se guarda como null; una pasada sí', () => {
  assert.equal(validarBorrador({ cliente: { nombre: 'X S.L.', nif: 'B12345674' }, fecha_operacion: '2026-12-01', lineas: [linea(10)] }, null, HOY).error, 'fecha_operacion')
  assert.equal(validarBorrador({ cliente: { nombre: 'X S.L.', nif: 'B12345674' }, fecha_operacion: HOY, lineas: [linea(10)] }, null, HOY).borrador.fecha_operacion, null)
  assert.equal(validarBorrador({ cliente: { nombre: 'X S.L.', nif: 'B12345674' }, fecha_operacion: '2026-10-31', lineas: [linea(10)] }, null, HOY).borrador.fecha_operacion, '2026-10-31')
})

test('tipos y líneas fuera de rango', () => {
  const base = { cliente: { nombre: 'X S.L.', nif: 'B12345674' } }
  assert.equal(validarBorrador({ ...base, iva_tipo: 7, lineas: [linea(1)] }, null, HOY).error, 'iva')
  assert.equal(validarBorrador({ ...base, irpf_tipo: 19, lineas: [linea(1)] }, null, HOY).error, 'irpf')
  assert.equal(validarBorrador({ ...base, lineas: [] }, null, HOY).error, 'lineas')
  assert.equal(validarBorrador({ ...base, lineas: Array.from({ length: 51 }, () => linea(1)) }, null, HOY).error, 'lineas')
  assert.equal(validarBorrador({ ...base, lineas: [{ concepto: 'X', cantidad: 1, precio_unitario: 1 }] }, null, HOY).error, 'linea')
  assert.equal(validarBorrador({ ...base, lineas: [{ concepto: 'Servicio', cantidad: 0, precio_unitario: 1 }] }, null, HOY).error, 'linea')
  assert.equal(validarBorrador({ ...base, lineas: [linea(-5)] }, null, HOY).error, 'linea')
  assert.equal(validarBorrador({ ...base, dias_vencimiento: 45, lineas: [linea(1)] }, null, HOY).error, 'vencimiento')
  assert.equal(validarBorrador('texto', null, HOY).error, 'cuerpo')
})

test('cliente guardado: manda sobre los datos sueltos y su NIF se normaliza', () => {
  const r = validarBorrador({ cliente: { nombre: 'Otro' }, lineas: [linea(100)] }, { id: 'c1', nombre: 'Guardado S.L.', nif: 'b-12345674', direccion: null, email: null }, HOY)
  assert.equal(r.ok, true)
  assert.equal(r.borrador.cliente.nombre, 'Guardado S.L.')
  assert.equal(r.borrador.cliente.nif, 'B12345674')
})

test('tokens: formato kua_, hash SHA-256 y prefijo visible', () => {
  const t = generarToken()
  assert.match(t.token, /^kua_[A-Za-z0-9_-]{32}$/)
  assert.equal(t.hash, hashToken(t.token))
  assert.match(t.hash, /^[0-9a-f]{64}$/)
  assert.equal(t.prefijo, t.token.slice(0, 8))
  assert.notEqual(generarToken().token, t.token)
})

test('permisos: siempre incluye leer y descarta los desconocidos', () => {
  assert.deepEqual(normalizarPermisos('kuentas:borradores admin:todo'), ['kuentas:leer', 'kuentas:borradores'])
  assert.deepEqual(normalizarPermisos(''), ['kuentas:leer'])
  assert.deepEqual(normalizarPermisos(['kuentas:leer']), ['kuentas:leer'])
})

test('secreto del conector: tiempo constante, mínimo 32 caracteres', () => {
  const s = 'x'.repeat(40)
  assert.equal(secretoValido(`Bearer ${s}`, s), true)
  assert.equal(secretoValido(`Bearer ${s}y`, s), false)
  assert.equal(secretoValido('Bearer corto', 'corto'), false)
  assert.equal(secretoValido(null, s), false)
})

test('vuelta de /conectar-ia: solo a las URL de callback configuradas', () => {
  const lista = 'https://mcp.kuentas.eu/callback, http://127.0.0.1:8788/callback'
  assert.equal(vueltaPermitida('https://mcp.kuentas.eu/callback', lista), true)
  assert.equal(vueltaPermitida('https://mcp.kuentas.eu/callback?x=1', lista), true)
  assert.equal(vueltaPermitida('https://mcp.kuentas.eu.evil.example/callback', lista), false)
  assert.equal(vueltaPermitida('https://mcp.kuentas.eu/otra', lista), false)
  assert.equal(vueltaPermitida('javascript:alert(1)', lista), false)
  assert.equal(vueltaPermitida('https://mcp.kuentas.eu/callback', undefined), false)
})
