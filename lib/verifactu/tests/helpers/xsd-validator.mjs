// Validación de XML contra los XSD OFICIALES de la AEAT descargados en
// docs/verifactu/xsd/ (V05). Usa xmllint-wasm (libxml2 compilado a WASM,
// devDependency): sin binarios nativos, sin Java y sin red.
//
// Los ficheros oficiales se cargan INTACTOS del disco; los únicos ajustes,
// en memoria, son los necesarios para validar sin acceso a red:
//  - SuministroInformacion.xsd importa el esquema de XMLDSig desde una URL
//    (http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd): se reescribe
//    el schemaLocation a la copia local docs/verifactu/xsd/xmldsig-core-schema.xsd.
//  - A esa copia local de W3C se le retira el DOCTYPE (libxml2 intentaría
//    resolver el DTD externo).

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateXML } from 'xmllint-wasm'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const DIR_XSD = join(RAIZ, 'docs', 'verifactu', 'xsd')

function leer(nombre) {
  return readFileSync(join(DIR_XSD, nombre), 'utf8')
}

const suministroInformacion = leer('SuministroInformacion.xsd').replace(
  'http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd',
  'xmldsig-core-schema.xsd'
)
const suministroLR = leer('SuministroLR.xsd')
const respuestaSuministro = leer('RespuestaSuministro.xsd')
const eventosSIF = leer('EventosSIF.xsd').replace(
  'http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd',
  'xmldsig-core-schema.xsd'
)
const xmldsig = leer('xmldsig-core-schema.xsd').replace(/<!DOCTYPE[\s\S]*?\]>\s*/, '')

/**
 * Valida un fragmento autónomo `sf:RegistroAlta`/`sf:RegistroAnulacion`
 * contra SuministroInformacion.xsd (elementos globales del esquema).
 */
export async function validarRegistroXsd(xml) {
  const r = await validateXML({
    xml: [{ fileName: 'registro.xml', contents: `<?xml version="1.0" encoding="UTF-8"?>\n${xml}` }],
    schema: [{ fileName: 'SuministroInformacion.xsd', contents: suministroInformacion }],
    preload: [{ fileName: 'xmldsig-core-schema.xsd', contents: xmldsig }],
  })
  return { valida: r.valid, errores: r.errors.map((e) => e.message) }
}

/** Valida un documento `RegistroEvento` contra EventosSIF.xsd (V06). */
export async function validarEventoXsd(xml) {
  const r = await validateXML({
    xml: [{ fileName: 'evento.xml', contents: `<?xml version="1.0" encoding="UTF-8"?>\n${xml}` }],
    schema: [{ fileName: 'EventosSIF.xsd', contents: eventosSIF }],
    preload: [{ fileName: 'xmldsig-core-schema.xsd', contents: xmldsig }],
  })
  return { valida: r.valid, errores: r.errors.map((e) => e.message) }
}

/**
 * Valida un documento `RespuestaRegFactuSistemaFacturacion` (respuesta del
 * servicio, SIN el Envelope SOAP) contra RespuestaSuministro.xsd (V09).
 */
export async function validarRespuestaXsd(xml) {
  const r = await validateXML({
    xml: [{ fileName: 'respuesta.xml', contents: `<?xml version="1.0" encoding="UTF-8"?>\n${xml}` }],
    schema: [{ fileName: 'RespuestaSuministro.xsd', contents: respuestaSuministro }],
    preload: [
      { fileName: 'SuministroLR.xsd', contents: suministroLR },
      { fileName: 'SuministroInformacion.xsd', contents: suministroInformacion },
      { fileName: 'xmldsig-core-schema.xsd', contents: xmldsig },
    ],
  })
  return { valida: r.valid, errores: r.errors.map((e) => e.message) }
}

/** Valida un mensaje completo `RegFactuSistemaFacturacion` contra SuministroLR.xsd. */
export async function validarEnvioXsd(xml) {
  const r = await validateXML({
    xml: [{ fileName: 'envio.xml', contents: `<?xml version="1.0" encoding="UTF-8"?>\n${xml}` }],
    schema: [{ fileName: 'SuministroLR.xsd', contents: suministroLR }],
    preload: [
      { fileName: 'SuministroInformacion.xsd', contents: suministroInformacion },
      { fileName: 'xmldsig-core-schema.xsd', contents: xmldsig },
    ],
  })
  return { valida: r.valid, errores: r.errors.map((e) => e.message) }
}
