// Tests V11: gestión y custodia de certificados del emisor.
//
// Cubre: el sobre AES-256-GCM (roundtrip, manipulación, AAD, rotación de KEK),
// el análisis del PKCS#12 con node-forge (fixture real de OpenSSL 3 con
// PBES2/AES y PKCS#12 generados en el propio test con 3DES, contraseña
// incorrecta, extracción de NIF español IDCES-/VATES-, caducidad), la
// normalización a PEM aceptada por node:tls, y la custodia completa
// (guardarCertificado/certificadoActivo/retirar/materialRemision) con un
// Supabase simulado, incluida la clasificación obligado/representante/sello
// y la omisión de obligados sin certificado en procesarRemision (V10).
// Ejecutar con: npm test  (node --test, sin transpilación).

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createSecureContext } from 'node:tls'
import forge from 'node-forge'

import {
  cifrar,
  descifrar,
  clavesDesdeEnv,
  idDeClave,
  ErrorCifrado,
} from '../cert-cifrado.ts'
import {
  analizarPkcs12,
  estadoCaducidad,
  nifDeAtributo,
  serializarMaterial,
  deserializarMaterial,
  materialParaCliente,
  DIAS_AVISO_CADUCIDAD,
  ErrorCertificado,
} from '../certificados.ts'
import {
  guardarCertificado,
  certificadoActivo,
  retirarCertificado,
  materialRemision,
  ErrorCustodia,
} from '../cert-store.ts'
import { procesarRemision } from '../remision.ts'

const DIR_CERTS = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'certs-prueba')
const CLIENTE_PFX = readFileSync(join(DIR_CERTS, 'cliente.pfx'))

// KEK de pruebas en el entorno para toda la batería
const KEK_B64 = randomBytes(32).toString('base64')
process.env.VERIFACTU_CERT_KEK_BASE64 = KEK_B64
delete process.env.VERIFACTU_CERT_KEK_ANTERIOR_BASE64

// ---------------------------------------------------------------------------
// Generación de certificados españoles de prueba (forge, autofirmados)
// ---------------------------------------------------------------------------

const PAR_CLAVES = forge.pki.rsa.generateKeyPair(2048)

function certEspanol({ cn, serialNumber, orgIdentifier, desde, hasta }) {
  const cert = forge.pki.createCertificate()
  cert.publicKey = PAR_CLAVES.publicKey
  cert.serialNumber = '0abc' + Math.floor(Math.random() * 1e6).toString(16)
  cert.validity.notBefore = desde ?? new Date(Date.now() - 86_400_000)
  cert.validity.notAfter = hasta ?? new Date(Date.now() + 4 * 365 * 86_400_000)
  const attrs = [{ name: 'commonName', value: cn }]
  if (serialNumber) attrs.push({ type: '2.5.4.5', value: serialNumber })
  if (orgIdentifier) attrs.push({ type: '2.5.4.97', value: orgIdentifier })
  cert.setSubject(attrs)
  cert.setIssuer([{ name: 'commonName', value: 'CA Pruebas Kuentas' }])
  cert.sign(PAR_CLAVES.privateKey, forge.md.sha256.create())
  return cert
}

function aPfx(cert, password, algorithm = '3des') {
  const asn1 = forge.pkcs12.toPkcs12Asn1(PAR_CLAVES.privateKey, [cert], password, {
    algorithm,
    generateLocalKeyId: true,
    friendlyName: 'prueba',
  })
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary')
}

// ---------------------------------------------------------------------------
// Supabase simulado con estado (sif_config + sif_certificados)
// ---------------------------------------------------------------------------

function supabaseFalso({ nifObligado = 'B98407901' } = {}) {
  const estado = {
    config: nifObligado ? { nif_obligado: nifObligado, certificado_ref: null } : null,
    certificados: [],
  }
  function ejecutar(q) {
    if (q.tabla === 'sif_config') {
      if (q.op === 'select') return { data: estado.config, error: null }
      if (q.op === 'update' && estado.config) Object.assign(estado.config, q.payload)
      return { data: null, error: null }
    }
    // sif_certificados
    const coincide = (fila) => Object.entries(q.filtros).every(([c, v]) => fila[c] === v)
    if (q.op === 'insert') {
      const fila = { estado: 'activo', retirado_at: null, ...q.payload }
      estado.certificados.push(fila)
      return { data: q.single ? fila : [fila], error: null }
    }
    if (q.op === 'update') {
      const filas = estado.certificados.filter(coincide)
      for (const f of filas) {
        Object.assign(f, q.payload)
        if (q.payload.estado === 'retirado') {
          // El guard SQL purga material y sella retirado_at
          f.material_cifrado = null
          f.retirado_at = new Date().toISOString()
        }
      }
      return { data: filas, error: null }
    }
    const filas = estado.certificados.filter(coincide)
    return { data: q.single ? filas[0] ?? null : filas, error: null }
  }
  const supabase = {
    estado,
    from(tabla) {
      const q = { tabla, op: 'select', payload: null, filtros: {}, single: false }
      const api = {
        select() { return api },
        insert(p) { q.op = 'insert'; q.payload = p; return api },
        update(p) { q.op = 'update'; q.payload = p; return api },
        eq(c, v) { q.filtros[c] = v; return api },
        maybeSingle() { q.single = true; return Promise.resolve(ejecutar(q)) },
        single() { q.single = true; return Promise.resolve(ejecutar(q)) },
        then(res, rej) { return Promise.resolve(ejecutar(q)).then(res, rej) },
      }
      return api
    },
  }
  return supabase
}

const USER = '11111111-1111-1111-1111-111111111111'

// ---------------------------------------------------------------------------
// 1. Sobre de cifrado (cert-cifrado)
// ---------------------------------------------------------------------------

test('cifrar/descifrar: roundtrip con AAD y formato v1.<kekId>.<iv>.<ct>.<tag>', () => {
  const claves = clavesDesdeEnv()
  assert.ok(claves)
  const claro = Buffer.from('material secreto de prueba', 'utf8')
  const sobre = cifrar(claro, 'ctx:1', claves.actual)
  const partes = sobre.split('.')
  assert.equal(partes.length, 5)
  assert.equal(partes[0], 'v1')
  assert.equal(partes[1], claves.actual.id)
  assert.deepEqual(descifrar(sobre, 'ctx:1', claves.todas), claro)
})

test('descifrar: AAD distinto (sobre copiado a otra fila/tenant) falla', () => {
  const claves = clavesDesdeEnv()
  const sobre = cifrar(Buffer.from('x'), 'sif_certificados:id1:userA', claves.actual)
  assert.throws(
    () => descifrar(sobre, 'sif_certificados:id1:userB', claves.todas),
    (e) => e instanceof ErrorCifrado && e.codigo === 'DESCIFRADO_FALLIDO'
  )
})

test('descifrar: sobre manipulado (ct alterado) falla sin filtrar detalle', () => {
  const claves = clavesDesdeEnv()
  const sobre = cifrar(Buffer.from('material'), 'ctx', claves.actual)
  const partes = sobre.split('.')
  partes[3] = Buffer.from('otracosa').toString('base64')
  assert.throws(
    () => descifrar(partes.join('.'), 'ctx', claves.todas),
    (e) => e instanceof ErrorCifrado && e.codigo === 'DESCIFRADO_FALLIDO'
  )
})

test('rotación de KEK: sobres viejos se descifran con la KEK anterior', () => {
  const vieja = { id: idDeClave(Buffer.alloc(32, 7)), clave: Buffer.alloc(32, 7) }
  const nueva = { id: idDeClave(Buffer.alloc(32, 9)), clave: Buffer.alloc(32, 9) }
  const sobre = cifrar(Buffer.from('legado'), 'ctx', vieja)
  assert.deepEqual(descifrar(sobre, 'ctx', [nueva, vieja]).toString(), 'legado')
  assert.throws(
    () => descifrar(sobre, 'ctx', [nueva]),
    (e) => e instanceof ErrorCifrado && e.codigo === 'KEK_DESCONOCIDA'
  )
})

test('clavesDesdeEnv: valida longitud y devuelve null sin configurar', () => {
  assert.equal(clavesDesdeEnv({}), null)
  assert.throws(
    () => clavesDesdeEnv({ VERIFACTU_CERT_KEK_BASE64: Buffer.alloc(16).toString('base64') }),
    (e) => e instanceof ErrorCifrado && e.codigo === 'KEK_INVALIDA'
  )
  const juego = clavesDesdeEnv({
    VERIFACTU_CERT_KEK_BASE64: Buffer.alloc(32, 1).toString('base64'),
    VERIFACTU_CERT_KEK_ANTERIOR_BASE64: Buffer.alloc(32, 2).toString('base64'),
  })
  assert.equal(juego.todas.length, 2)
})

// ---------------------------------------------------------------------------
// 2. Análisis del PKCS#12 (certificados)
// ---------------------------------------------------------------------------

test('analizarPkcs12: fixture OpenSSL 3 (PBES2/AES) → metadatos y PEM normalizado', () => {
  const { metadatos, material } = analizarPkcs12(CLIENTE_PFX, 'pruebas')
  assert.match(metadatos.subjectCn, /PRUEBA cliente Kuentas/)
  assert.match(metadatos.huellaSha256, /^[0-9A-F]{64}$/)
  assert.ok(metadatos.validoHasta instanceof Date)
  assert.equal(material.formato, 'pem')
  assert.match(material.keyPem, /BEGIN PRIVATE KEY/)
  assert.match(material.certPem, /BEGIN CERTIFICATE/)
  // El material normalizado debe ser directamente utilizable por node:tls
  const cliente = materialParaCliente(material)
  assert.doesNotThrow(() => createSecureContext({ cert: cliente.cert, key: cliente.key }))
})

test('analizarPkcs12: PKCS#12 legado (3DES) generado en el test también se abre', () => {
  const cert = certEspanol({ cn: 'MERCADONET GLOBAL SL', orgIdentifier: 'VATES-B98407901' })
  const { metadatos, material } = analizarPkcs12(aPfx(cert, 'clave-prueba'), 'clave-prueba')
  assert.equal(metadatos.subjectCn, 'MERCADONET GLOBAL SL')
  assert.equal(metadatos.nifRepresentado, 'B98407901')
  assert.equal(material.formato, 'pem')
})

test('analizarPkcs12: contraseña incorrecta → PASSPHRASE_INCORRECTA', () => {
  assert.throws(
    () => analizarPkcs12(CLIENTE_PFX, 'contraseña-mala'),
    (e) => e instanceof ErrorCertificado && e.codigo === 'PASSPHRASE_INCORRECTA'
  )
})

test('analizarPkcs12: fichero que no es PKCS#12 → PKCS12_INVALIDO', () => {
  assert.throws(
    () => analizarPkcs12(Buffer.from('esto no es un pfx'), 'x'),
    (e) => e instanceof ErrorCertificado && e.codigo === 'PKCS12_INVALIDO'
  )
})

test('extracción de NIF español: serialNumber IDCES- y organizationIdentifier VATES-', () => {
  const cert = certEspanol({
    cn: 'APELLIDO NOMBRE - 12345678Z',
    serialNumber: 'IDCES-12345678Z',
    orgIdentifier: 'VATES-B98407901',
  })
  const { metadatos } = analizarPkcs12(aPfx(cert, 'pw'), 'pw')
  assert.equal(metadatos.nifCertificado, '12345678Z')
  assert.equal(metadatos.nifRepresentado, 'B98407901')
})

test('nifDeAtributo: variantes y rechazos', () => {
  assert.equal(nifDeAtributo('IDCES-12345678Z'), '12345678Z')
  assert.equal(nifDeAtributo('VATES-B98407901'), 'B98407901')
  assert.equal(nifDeAtributo('b98407901'), 'B98407901')
  assert.equal(nifDeAtributo('12345678Z'), '12345678Z')
  assert.equal(nifDeAtributo('no-es-un-nif'), null)
  assert.equal(nifDeAtributo(''), null)
  assert.equal(nifDeAtributo(null), null)
})

test('estadoCaducidad: válido / caduca_pronto (<60 días) / caducado', () => {
  const ahora = new Date('2026-09-18T12:00:00Z')
  const en90d = new Date('2026-12-17T12:00:00Z')
  const en10d = new Date('2026-09-28T12:00:00Z')
  const ayer = new Date('2026-09-17T12:00:00Z')
  assert.equal(estadoCaducidad(en90d, ahora).estado, 'valido')
  assert.equal(estadoCaducidad(en10d, ahora).estado, 'caduca_pronto')
  assert.equal(estadoCaducidad(en10d, ahora).diasRestantes, 10)
  assert.equal(estadoCaducidad(ayer, ahora).estado, 'caducado')
  assert.ok(DIAS_AVISO_CADUCIDAD >= 30)
})

test('serializar/deserializar material: roundtrip pem y pfx', () => {
  const pem = { formato: 'pem', keyPem: 'K', certPem: 'C' }
  assert.deepEqual(deserializarMaterial(serializarMaterial(pem)), pem)
  const pfx = { formato: 'pfx', pfxBase64: Buffer.from('p12').toString('base64'), passphrase: 'pw' }
  const vuelto = deserializarMaterial(serializarMaterial(pfx))
  assert.deepEqual(materialParaCliente(vuelto).pfx, Buffer.from('p12'))
  assert.equal(materialParaCliente(vuelto).passphrase, 'pw')
})

// ---------------------------------------------------------------------------
// 3. Custodia (cert-store) con Supabase simulado
// ---------------------------------------------------------------------------

test('guardarCertificado: certificado del obligado → cifrado, activo y certificado_ref', async () => {
  const sb = supabaseFalso({ nifObligado: 'B98407901' })
  const cert = certEspanol({ cn: 'MERCADONET GLOBAL SL', serialNumber: 'IDCES-B98407901' })
  const resumen = await guardarCertificado(sb, USER, aPfx(cert, 'pw'), 'pw')
  assert.equal(resumen.tipo, 'obligado')
  assert.equal(resumen.caducidad.estado, 'valido')
  assert.equal(sb.estado.certificados.length, 1)
  const fila = sb.estado.certificados[0]
  assert.equal(fila.estado, 'activo')
  assert.match(fila.material_cifrado, /^v1\./)
  assert.ok(!fila.material_cifrado.includes('PRIVATE KEY'), 'el material en BD va cifrado')
  assert.equal(sb.estado.config.certificado_ref, fila.id)
})

test('guardarCertificado: representante (VATES del obligado) y sustitución retira el anterior', async () => {
  const sb = supabaseFalso({ nifObligado: 'B98407901' })
  const primero = certEspanol({ cn: 'MERCADONET GLOBAL SL', serialNumber: 'IDCES-B98407901' })
  await guardarCertificado(sb, USER, aPfx(primero, 'pw'), 'pw')
  const representante = certEspanol({
    cn: 'REPRESENTANTE - 12345678Z',
    serialNumber: 'IDCES-12345678Z',
    orgIdentifier: 'VATES-B98407901',
  })
  const resumen = await guardarCertificado(sb, USER, aPfx(representante, 'pw'), 'pw')
  assert.equal(resumen.tipo, 'representante')
  const estados = sb.estado.certificados.map((c) => c.estado).sort()
  assert.deepEqual(estados, ['activo', 'retirado'])
  const retirado = sb.estado.certificados.find((c) => c.estado === 'retirado')
  assert.equal(retirado.material_cifrado, null, 'retirar purga el material')
})

test('guardarCertificado: sello de entidad (solo VATES, sin serialNumber)', async () => {
  const sb = supabaseFalso({ nifObligado: 'B98407901' })
  const sello = certEspanol({ cn: 'SELLO MERCADONET', orgIdentifier: 'VATES-B98407901' })
  const resumen = await guardarCertificado(sb, USER, aPfx(sello, 'pw'), 'pw')
  assert.equal(resumen.tipo, 'sello')
})

test('guardarCertificado: NIF que no corresponde al obligado → NIF_NO_COINCIDE', async () => {
  const sb = supabaseFalso({ nifObligado: 'B98407901' })
  const ajeno = certEspanol({ cn: 'OTRO TITULAR', serialNumber: 'IDCES-99999999R' })
  await assert.rejects(
    guardarCertificado(sb, USER, aPfx(ajeno, 'pw'), 'pw'),
    (e) => e instanceof ErrorCustodia && e.codigo === 'NIF_NO_COINCIDE'
  )
})

test('guardarCertificado: sin sif_config → CONFIG_FALTA; caducado → CADUCADO; sin KEK → KEK_NO_CONFIGURADA', async () => {
  const cert = certEspanol({ cn: 'MERCADONET GLOBAL SL', serialNumber: 'IDCES-B98407901' })
  const pfx = aPfx(cert, 'pw')

  await assert.rejects(
    guardarCertificado(supabaseFalso({ nifObligado: null }), USER, pfx, 'pw'),
    (e) => e instanceof ErrorCustodia && e.codigo === 'CONFIG_FALTA'
  )

  const caducado = certEspanol({
    cn: 'MERCADONET GLOBAL SL',
    serialNumber: 'IDCES-B98407901',
    desde: new Date('2020-01-01'),
    hasta: new Date('2021-01-01'),
  })
  await assert.rejects(
    guardarCertificado(supabaseFalso({}), USER, aPfx(caducado, 'pw'), 'pw'),
    (e) => e instanceof ErrorCustodia && e.codigo === 'CADUCADO'
  )

  delete process.env.VERIFACTU_CERT_KEK_BASE64
  try {
    await assert.rejects(
      guardarCertificado(supabaseFalso({}), USER, pfx, 'pw'),
      (e) => e instanceof ErrorCustodia && e.codigo === 'KEK_NO_CONFIGURADA'
    )
  } finally {
    process.env.VERIFACTU_CERT_KEK_BASE64 = KEK_B64
  }
})

test('certificadoActivo/retirarCertificado: metadatos sin material y retirada limpia certificado_ref', async () => {
  const sb = supabaseFalso({})
  const cert = certEspanol({ cn: 'MERCADONET GLOBAL SL', serialNumber: 'IDCES-B98407901' })
  await guardarCertificado(sb, USER, aPfx(cert, 'pw'), 'pw')

  const resumen = await certificadoActivo(sb, USER)
  assert.equal(resumen.subjectCn, 'MERCADONET GLOBAL SL')
  assert.equal(resumen.nifCertificado, 'B98407901')
  assert.ok(!('material_cifrado' in resumen) && !('materialCifrado' in resumen))

  assert.equal(await retirarCertificado(sb, USER), true)
  assert.equal(await certificadoActivo(sb, USER), null)
  assert.equal(sb.estado.config.certificado_ref, null)
  assert.equal(await retirarCertificado(sb, USER), false)
})

test('materialRemision: descifra y devuelve material utilizable para ClienteAeat', async () => {
  const sb = supabaseFalso({})
  const cert = certEspanol({ cn: 'MERCADONET GLOBAL SL', serialNumber: 'IDCES-B98407901' })
  await guardarCertificado(sb, USER, aPfx(cert, 'pw'), 'pw')

  const res = await materialRemision(sb, USER)
  assert.equal(res.ok, true)
  assert.equal(res.tipoCertificado, 'normal')
  assert.doesNotThrow(() => createSecureContext({ cert: res.certificado.cert, key: res.certificado.key }))
})

test('materialRemision: sin certificado, sobre movido de tenant y caducado → motivo (nunca lanza)', async () => {
  const sb = supabaseFalso({})
  const sinCert = await materialRemision(sb, USER)
  assert.equal(sinCert.ok, false)
  assert.match(sinCert.motivo, /sin certificado|no tiene certificado/)

  const cert = certEspanol({ cn: 'MERCADONET GLOBAL SL', serialNumber: 'IDCES-B98407901' })
  await guardarCertificado(sb, USER, aPfx(cert, 'pw'), 'pw')
  // Un atacante con escritura en BD reasigna la fila a otro tenant: el AAD lo frustra
  sb.estado.certificados[0].user_id = '99999999-9999-9999-9999-999999999999'
  const robado = await materialRemision(sb, '99999999-9999-9999-9999-999999999999')
  assert.equal(robado.ok, false)

  // Caducado tras la subida: se detecta en cada tick sin descifrar
  sb.estado.certificados[0].user_id = USER
  sb.estado.certificados[0].valido_hasta = new Date('2020-01-01').toISOString()
  const caducado = await materialRemision(sb, USER)
  assert.equal(caducado.ok, false)
  assert.match(caducado.motivo, /caducado/)
})

// ---------------------------------------------------------------------------
// 4. Integración con el worker V10: omisión sin tocar la cola
// ---------------------------------------------------------------------------

test('procesarRemision: obligado sin certificado se omite SIN reclamar lote (la cola acumula)', async () => {
  const llamadas = []
  const sb = {
    rpc: async (fn) => {
      llamadas.push(fn)
      if (fn === 'sif_remision_pendientes') {
        return { data: [{ user_id: USER, pendientes: 3 }], error: null }
      }
      return { data: [], error: null }
    },
  }
  const resumen = await procesarRemision(sb, async () => ({ motivo: 'el obligado no tiene certificado activo' }))
  assert.equal(resumen.totalOmitidos, 1)
  assert.equal(resumen.totalEnviados, 0)
  assert.equal(resumen.obligados[0].motivo, 'el obligado no tiene certificado activo')
  assert.ok(!llamadas.includes('sif_outbox_reclamar_lote'), 'no debe tocar la cola del obligado')
})
