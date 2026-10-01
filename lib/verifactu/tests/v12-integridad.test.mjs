// Tests V12: verificador de integridad de la cadena (integridad.ts) y
// preparación de la subsanación (subsanacion.ts), con el XML subsanador
// validado contra los XSD OFICIALES de la AEAT. Ejecutar con: npm test.

import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import {
  fechaHoraHusoGenRegistro,
  formatearFechaExpedicion,
  formatearImporte,
  huellaAlta,
  huellaAnulacion,
} from '../huella.ts'
import {
  TIPO_ANOMALIA_OFICIAL,
  verificarRegistrosObligado,
} from '../integridad.ts'
import { prepararEntradaSubsanacion } from '../subsanacion.ts'
import { construirRegistroAlta, sistemaInformaticoKuentas } from '../registro-alta.ts'
import { validarRegistroXsd } from './helpers/xsd-validator.mjs'

// ---------------------------------------------------------------------------
// Fabricación de una cadena íntegra (mismas columnas que sif_registros)
// ---------------------------------------------------------------------------

const NIF = 'B98407901'

/** Construye una cadena consistente de n registros (altas y una anulación). */
function cadenaValida(n = 4) {
  const filas = []
  let huellaAnterior = null
  for (let i = 1; i <= n; i++) {
    const tipo = i === 3 ? 'anulacion' : 'alta'
    const fechaExp = '2026-09-18'
    const fh = `2026-09-18T10:0${i}:00+02:00`
    const base = {
      id: `reg-${i}`,
      correlativo: i,
      tipo_registro: tipo,
      id_emisor_factura: NIF,
      num_serie_factura: `F-2026-00000${i}`,
      fecha_expedicion: fechaExp,
      tipo_factura: tipo === 'alta' ? 'F1' : null,
      cuota_total: tipo === 'alta' ? 21 : null,
      importe_total: tipo === 'alta' ? 121 : null,
      primer_registro: i === 1,
      huella_anterior: huellaAnterior,
      fecha_hora_huso_gen: fh,
      estado_remision: 'accepted',
    }
    const huella =
      tipo === 'alta'
        ? huellaAlta(
            {
              IDEmisorFactura: NIF,
              NumSerieFactura: base.num_serie_factura,
              FechaExpedicionFactura: formatearFechaExpedicion(fechaExp),
              TipoFactura: 'F1',
              CuotaTotal: formatearImporte(21),
              ImporteTotal: formatearImporte(121),
              FechaHoraHusoGenRegistro: fh,
            },
            huellaAnterior
          )
        : huellaAnulacion(
            {
              IDEmisorFacturaAnulada: NIF,
              NumSerieFacturaAnulada: base.num_serie_factura,
              FechaExpedicionFacturaAnulada: formatearFechaExpedicion(fechaExp),
              FechaHoraHusoGenRegistro: fh,
            },
            huellaAnterior
          )
    filas.push({ ...base, huella, registro: { huella, fechaHoraHusoGenRegistro: fh } })
    huellaAnterior = huella
  }
  const cadena = { correlativo_ultimo: n, ultima_huella: huellaAnterior }
  return { filas, cadena }
}

const AHORA = { ahora: new Date('2026-09-19T12:00:00+02:00') }

function codigos(resultado) {
  return resultado.anomalias.map((a) => a.codigo)
}

// ---------------------------------------------------------------------------
// Verificador: cadena íntegra y cada tipo de anomalía
// ---------------------------------------------------------------------------

test('cadena íntegra (altas + anulación): 0 anomalías y última huella correcta', () => {
  const { filas, cadena } = cadenaValida()
  const r = verificarRegistrosObligado(filas, cadena, AHORA)
  assert.deepEqual(r.anomalias, [])
  assert.equal(r.ultimaHuella, filas.at(-1).huella)
})

test('el orden de entrada no importa: el verificador ordena por correlativo', () => {
  const { filas, cadena } = cadenaValida()
  const r = verificarRegistrosObligado([...filas].reverse(), cadena, AHORA)
  assert.deepEqual(r.anomalias, [])
})

test('hueco de correlativo (registro desaparecido) → HUECO_CORRELATIVO', () => {
  const { filas, cadena } = cadenaValida()
  const sinTercero = filas.filter((f) => f.correlativo !== 3)
  const r = verificarRegistrosObligado(sinTercero, cadena, AHORA)
  assert.ok(codigos(r).includes('HUECO_CORRELATIVO'))
  // El hueco además rompe la relación de huellas del siguiente… pero al no ser
  // contiguos NO se acusa ENCADENADO_ROTO (ya está acusado el hueco).
  assert.ok(!codigos(r).includes('ENCADENADO_ROTO'))
})

test('cadena que no empieza en 1 → HUECO_CORRELATIVO inicial', () => {
  const { filas, cadena } = cadenaValida()
  const r = verificarRegistrosObligado(filas.slice(1), cadena, AHORA)
  assert.ok(codigos(r).includes('HUECO_CORRELATIVO'))
})

test('huella_anterior manipulada → ENCADENADO_ROTO (y HUELLA_NO_COINCIDE del recálculo)', () => {
  const { filas, cadena } = cadenaValida()
  filas[2] = { ...filas[2], huella_anterior: 'A'.repeat(64) }
  const r = verificarRegistrosObligado(filas, cadena, AHORA)
  assert.ok(codigos(r).includes('ENCADENADO_ROTO'))
  assert.ok(codigos(r).includes('HUELLA_NO_COINCIDE'))
})

test('contenido alterado (importe) → HUELLA_NO_COINCIDE', () => {
  const { filas, cadena } = cadenaValida()
  filas[1] = { ...filas[1], importe_total: 999 }
  const r = verificarRegistrosObligado(filas, cadena, AHORA)
  assert.ok(codigos(r).includes('HUELLA_NO_COINCIDE'))
})

test('huella con formato inválido → FORMATO_HUELLA (sin recalcular)', () => {
  const { filas, cadena } = cadenaValida()
  filas[3] = { ...filas[3], huella: 'no-es-una-huella' }
  const r = verificarRegistrosObligado(filas, cadena, AHORA)
  assert.ok(codigos(r).includes('FORMATO_HUELLA'))
})

test('primer registro incoherente (flag en mitad de cadena y ausente al inicio)', () => {
  const { filas, cadena } = cadenaValida()
  filas[0] = { ...filas[0], primer_registro: false }
  filas[2] = { ...filas[2], primer_registro: true }
  const r = verificarRegistrosObligado(filas, cadena, AHORA)
  const primeros = r.anomalias.filter((a) => a.codigo === 'PRIMER_REGISTRO_INCOHERENTE')
  assert.equal(primeros.length, 2)
})

test('jsonb con huella distinta de la columna → JSONB_INCONSISTENTE', () => {
  const { filas, cadena } = cadenaValida()
  filas[1] = { ...filas[1], registro: { ...filas[1].registro, huella: 'B'.repeat(64) } }
  const r = verificarRegistrosObligado(filas, cadena, AHORA)
  assert.ok(codigos(r).includes('JSONB_INCONSISTENTE'))
})

test('FechaHoraHusoGenRegistro que retrocede → FECHA_RETROCEDIDA', () => {
  const { filas, cadena } = cadenaValida()
  // Nota: cambiar la fecha invalida también la huella (comprobación aparte)
  filas[2] = { ...filas[2], fecha_hora_huso_gen: '2026-09-18T08:00:00+02:00' }
  const r = verificarRegistrosObligado(filas, cadena, AHORA)
  assert.ok(codigos(r).includes('FECHA_RETROCEDIDA'))
})

test('FechaHoraHusoGenRegistro futura → FECHA_FUTURA', () => {
  const { filas, cadena } = cadenaValida()
  filas[3] = { ...filas[3], fecha_hora_huso_gen: '2027-01-01T10:00:00+01:00' }
  const r = verificarRegistrosObligado(filas, cadena, AHORA)
  assert.ok(codigos(r).includes('FECHA_FUTURA'))
})

test('puntero sif_cadena desincronizado → CADENA_DESINCRONIZADA', () => {
  const { filas } = cadenaValida()
  const r1 = verificarRegistrosObligado(filas, { correlativo_ultimo: 7, ultima_huella: 'C'.repeat(64) }, AHORA)
  assert.ok(codigos(r1).includes('CADENA_DESINCRONIZADA'))
  const r2 = verificarRegistrosObligado(filas, null, AHORA)
  assert.ok(codigos(r2).includes('CADENA_DESINCRONIZADA'))
})

test('sin registros y sin cadena: nada que acusar', () => {
  const r = verificarRegistrosObligado([], null, AHORA)
  assert.deepEqual(r.anomalias, [])
  assert.equal(r.ultimaHuella, null)
})

test('todo código interno tiene TipoAnomalia oficial de EventosSIF.xsd', () => {
  const oficiales = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','90']
  for (const [codigo, oficial] of Object.entries(TIPO_ANOMALIA_OFICIAL)) {
    assert.ok(oficiales.includes(oficial), `${codigo} → ${oficial} no es un TipoAnomaliaType válido`)
  }
})

// ---------------------------------------------------------------------------
// Subsanación: preparación de la entrada y XML validado contra el XSD oficial
// ---------------------------------------------------------------------------

const CONFIG = {
  user_id: 'u-1',
  nif_obligado: NIF,
  nombre_razon: 'Mercadonet Global S.L.',
  numero_instalacion: 'KU-test-0001',
  modalidad: 'verifactu',
  entorno_aeat: 'pruebas',
  activo: true,
}

const INVOICE = {
  id: 'inv-1',
  user_id: 'u-1',
  number: 'F-2026-000123',
  date: '2026-09-12',
  client_name: 'Cliente Ejemplo S.L.',
  client_nif: 'A58818501',
  items: [{ description: 'Desarrollo web', quantity: 1, unitPrice: 1000, total: 1000 }],
  subtotal: 1000,
  iva: 210,
  iva_rate: 21,
  irpf: 0,
  irpf_rate: 0,
  total: 1210,
  verifactu_estado: 'emitida',
  numero_fiscal: 'F-2026-000123',
  tipo_factura: 'F1',
  rectifica_invoice_id: null,
  tipo_rectificativa: null,
}

test('subsanación de un alta aceptado con errores: Subsanacion=S sin RechazoPrevio', () => {
  const entrada = prepararEntradaSubsanacion(INVOICE, CONFIG, {
    num_serie_factura: 'F-2026-000123',
    estado_remision: 'accepted_with_errors',
    tipo_factura: 'F1',
  })
  assert.equal(entrada.subsanacion, 'S')
  assert.equal(entrada.rechazoPrevio, undefined)
  assert.equal(entrada.numSerieFactura, 'F-2026-000123')
  assert.equal(entrada.tipoFactura, 'F1')
})

test('reenvío de un alta rechazado: Subsanacion=S + RechazoPrevio=S y destinatario corregible', () => {
  const corregido = { nombreRazon: 'Cliente Corregido S.L.', nif: 'B12345674' }
  const entrada = prepararEntradaSubsanacion(
    INVOICE,
    CONFIG,
    { num_serie_factura: 'F-2026-000123', estado_remision: 'rejected', tipo_factura: 'F1' },
    { destinatario: corregido }
  )
  assert.equal(entrada.subsanacion, 'S')
  assert.equal(entrada.rechazoPrevio, 'S')
  assert.deepEqual(entrada.destinatarios, [corregido])
})

test('el XML subsanador (Subsanacion=S + RechazoPrevio=S) valida contra el XSD oficial', async () => {
  const entrada = prepararEntradaSubsanacion(INVOICE, CONFIG, {
    num_serie_factura: 'F-2026-000123',
    estado_remision: 'rejected',
    tipo_factura: 'F1',
  })
  const generado = construirRegistroAlta(entrada, {
    encadenamiento: {
      registroAnterior: {
        idEmisorFactura: NIF,
        numSerieFactura: 'F-2026-000122',
        fechaExpedicion: '2026-09-11',
        huella: 'D'.repeat(64),
      },
    },
    sistemaInformatico: sistemaInformaticoKuentas(CONFIG.numero_instalacion),
    fechaGeneracion: new Date('2026-09-19T10:00:00+02:00'),
  })
  assert.ok(generado.xml.includes('<sf:Subsanacion>S</sf:Subsanacion>'))
  assert.ok(generado.xml.includes('<sf:RechazoPrevio>S</sf:RechazoPrevio>'))
  const r = await validarRegistroXsd(generado.xml)
  assert.ok(r.valida, `XML no válido contra el XSD oficial:\n${r.errores.join('\n')}`)
})

test('la huella del registro subsanador sigue la fórmula oficial (cadena V04)', () => {
  const entrada = prepararEntradaSubsanacion(INVOICE, CONFIG, {
    num_serie_factura: 'F-2026-000123',
    estado_remision: 'accepted_with_errors',
    tipo_factura: 'F1',
  })
  const cuando = new Date('2026-09-19T10:00:00+02:00')
  const generado = construirRegistroAlta(entrada, {
    encadenamiento: { primerRegistro: true },
    sistemaInformatico: sistemaInformaticoKuentas(CONFIG.numero_instalacion),
    fechaGeneracion: cuando,
  })
  const esperada = huellaAlta(
    {
      IDEmisorFactura: NIF,
      NumSerieFactura: 'F-2026-000123',
      FechaExpedicionFactura: '12-09-2026',
      TipoFactura: 'F1',
      CuotaTotal: '210.00',
      ImporteTotal: '1210.00',
      FechaHoraHusoGenRegistro: fechaHoraHusoGenRegistro(cuando),
    },
    null
  )
  assert.equal(generado.huella, esperada)
})
