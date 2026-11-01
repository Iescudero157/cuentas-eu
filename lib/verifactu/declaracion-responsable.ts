// V19 · Declaración responsable del SIF Kuentas (art. 13 RD 1007/2023 +
// art. 15 Orden HAC/1177/2024). Fuente ÚNICA del texto que se muestra en la
// app (/verifactu), se descarga en PDF y se publicará en kuentas.eu: los datos
// identificativos salen de sistemaInformaticoKuentas() (registro-alta.ts) para
// garantizar la coincidencia 1:1 con el bloque SistemaInformatico que viaja en
// cada registro de facturación (art. 10.1.l RRSIF).
//
// ESTADO (1-nov-2026): SUSCRITA. Texto revisado por el asesor (OK comunicado
// por Iván el 23-oct-2026), productor con NIF e inscripción y suscripción en
// SUSCRIPCION_DECLARACION. Si un cambio la devolviera a borrador (suscripción
// incompleta o DECLARACION_ES_BORRADOR = true), toda salida (página, PDF,
// texto) llevaría de forma destacada la marca de borrador. Cada nueva versión
// del componente de facturación exige una declaración nueva. Server-only (la
// cadena de imports llega a node:crypto vía registro-alta).

import { sistemaInformaticoKuentas } from './registro-alta.ts'
import {
  MARCADOR_CIF_PRODUCTOR,
  MARCADOR_REGISTRO_PRODUCTOR,
  PRODUCTOR_SIF,
  productorSifConfigurado,
} from './productor-sif.ts'

/** true hasta que Iván suscriba la versión definitiva (suscrita el 1-nov-2026). */
export const DECLARACION_ES_BORRADOR = false

/** Suscripción de la declaración (art. 15.1.l Orden): se rellena al firmar. */
export interface SuscripcionDeclaracion {
  lugar: string
  /** Fecha de suscripción, `aaaa-mm-dd`. */
  fecha: string
  /** Nombre y apellidos de quien firma en representación del productor. */
  firmante: string
  /** Cargo del firmante en el productor (p. ej. «administrador solidario»). */
  cargo: string
}

// Firmante y fecha confirmados por Iván en el chat el 1-nov-2026.
export const SUSCRIPCION_DECLARACION: Readonly<SuscripcionDeclaracion> = Object.freeze({
  lugar: 'Madrid',
  fecha: '2026-11-01',
  firmante: 'Iván Escudero Salas',
  cargo: 'administrador solidario',
})

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** `aaaa-mm-dd` → «1 de noviembre de 2026»; null si no es una fecha válida. */
function fechaLarga(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const f = new Date(Date.UTC(anio, mes - 1, dia))
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null
  return `${dia} de ${MESES[mes - 1]} de ${anio}`
}

/** true si la suscripción tiene lugar, fecha válida, firmante y cargo. */
export function suscripcionCompleta(s: Readonly<SuscripcionDeclaracion> = SUSCRIPCION_DECLARACION): boolean {
  return Boolean(s.lugar.trim() && fechaLarga(s.fecha) && s.firmante.trim() && s.cargo.trim())
}

/** Un apartado del contenido mínimo del art. 15.1 de la Orden HAC/1177/2024. */
export interface ApartadoDeclaracion {
  /** Letra del art. 15.1 Orden a la que responde (a–l). */
  letra: string
  titulo: string
  /** Párrafos del apartado (texto plano, sin marcado). */
  parrafos: string[]
  /** true si el apartado contiene placeholders pendientes de revisión. */
  pendienteRevision?: boolean
}

export interface DeclaracionResponsable {
  /** Título exigido por el art. 15.1 de la Orden (encabezado literal). */
  titulo: string
  esBorrador: boolean
  /** Identificación del SIF, idéntica al bloque SistemaInformatico (§2.4 SPEC). */
  sistema: {
    nombre: string
    idSistemaInformatico: string
    version: string
    soloVerifactu: boolean
    multiplesObligados: boolean
  }
  productor: {
    razonSocial: string
    nif: string
    /** Domicilio de la comunicación del NIF (AEAT) y del art. 3 de los estatutos. */
    domicilio: string
    registroMercantil: string
  }
  apartados: ApartadoDeclaracion[]
  /** Lo que falta resolver antes de publicar (vacío en la versión definitiva). */
  pendientes: string[]
}

const PLACEHOLDER_FECHA_LUGAR =
  '[LUGAR Y FECHA DE SUSCRIPCIÓN — se fijarán al firmar la versión definitiva · REVISIÓN IVAN]'
const PLACEHOLDER_FIRMANTE =
  '[NOMBRE Y CARGO DEL FIRMANTE en representación de MILBROTES, S.L. — REVISIÓN IVAN]'

/**
 * Construye la declaración responsable de la versión actual del SIF. Los datos
 * identificativos (nombre, id, versión, indicadores VERI*FACTU/multi-OT y
 * productor) se toman de la misma función que los estampa en cada registro de
 * facturación, de modo que un cambio allí se refleja aquí automáticamente
 * (art. 15.1 Orden: los datos deben coincidir con los remitidos a la AEAT).
 *
 * `opciones` solo existe para los tests: en producción se usan siempre
 * DECLARACION_ES_BORRADOR y SUSCRIPCION_DECLARACION.
 */
export function declaracionResponsableKuentas(
  opciones: { borrador?: boolean; suscripcion?: Readonly<SuscripcionDeclaracion> } = {}
): DeclaracionResponsable {
  const suscripcion = opciones.suscripcion ?? SUSCRIPCION_DECLARACION
  const firmada = suscripcionCompleta(suscripcion)
  // Nunca sale como definitiva sin lugar, fecha y firmante, aunque el
  // indicador se haya puesto a false por error.
  const esBorrador = (opciones.borrador ?? DECLARACION_ES_BORRADOR) || !firmada || !productorSifConfigurado()
  // El NumeroInstalacion es por obligado (tenant) y NO forma parte de la
  // declaración (art. 15.1 identifica sistema y versión, no instalaciones).
  const si = sistemaInformaticoKuentas('N/A')

  const sistema = {
    nombre: si.nombreSistemaInformatico,
    idSistemaInformatico: si.idSistemaInformatico,
    version: si.version,
    soloVerifactu: si.tipoUsoPosibleSoloVerifactu === 'S',
    multiplesObligados: si.tipoUsoPosibleMultiOT === 'S',
  }

  // Productor: MILBROTES, S.L. (lib/verifactu/productor-sif.ts). Si faltaran
  // NIF o inscripción, el borrador mostraría los marcadores.
  const productorListo = productorSifConfigurado()
  const productor = {
    razonSocial: si.nombreRazon,
    nif: si.nif.trim() || MARCADOR_CIF_PRODUCTOR,
    domicilio: PRODUCTOR_SIF.domicilio,
    registroMercantil: PRODUCTOR_SIF.registroMercantil.trim() || MARCADOR_REGISTRO_PRODUCTOR,
  }

  const apartados: ApartadoDeclaracion[] = [
    {
      letra: 'a',
      titulo: 'Nombre del sistema informático de facturación',
      parrafos: [
        `${sistema.nombre} (nombre dado al sistema para su distribución y comercialización).`,
      ],
    },
    {
      letra: 'b',
      titulo: 'Código identificador del sistema informático',
      parrafos: [
        `«${sistema.idSistemaInformatico}» (IdSistemaInformatico), código asignado por el productor ` +
          'que identifica a este sistema en los registros de facturación remitidos a la AEAT y que ' +
          'se mantiene en todas sus versiones.',
      ],
    },
    {
      letra: 'c',
      titulo: 'Identificador de la versión',
      parrafos: [
        `Versión ${sistema.version} del componente de facturación de ${sistema.nombre}. ` +
          'Cada nueva versión del componente de facturación dará lugar a una nueva declaración responsable.',
      ],
    },
    {
      letra: 'd',
      titulo: 'Componentes del sistema y funcionalidades',
      parrafos: [
        `${sistema.nombre} es un servicio en la nube (SaaS) accesible desde navegador web en ` +
          'app.kuentas.eu, sin instalación de software ni hardware específico en los equipos del usuario. ' +
          'Sus componentes de facturación son: (i) aplicación web de gestión y emisión de facturas; ' +
          '(ii) base de datos PostgreSQL donde los registros de facturación se conservan de forma ' +
          'inalterable, con huella encadenada; (iii) servicio de generación de registros de alta y ' +
          'anulación conforme a los diseños oficiales; y (iv) servicio de remisión continua de dichos ' +
          'registros a la sede electrónica de la AEAT.',
        'Funcionalidades de facturación: emisión de facturas completas y simplificadas y de facturas ' +
          'rectificativas; generación, en el momento de la expedición, del registro de facturación de ' +
          'alta y, en su caso, de anulación, con huella («hash») encadenada SHA-256; inclusión en la ' +
          'factura de la representación gráfica QR de cotejo y de la leyenda «VERI*FACTU»; remisión ' +
          'inmediata y automática de todos los registros a la AEAT; conservación, exportación y ' +
          'verificación de integridad de los registros; y registro de eventos internos del sistema.',
        'El sistema no dispone de modos de funcionamiento ocultos ni de mecanismos que permitan ' +
          'llevar contabilidades o registros de facturación paralelos, alterar registros ya generados ' +
          'u ocultar su existencia (art. 8 del Real Decreto 1007/2023).',
      ],
    },
    {
      letra: 'e',
      titulo: 'Funcionamiento exclusivo como «VERI*FACTU»',
      parrafos: [
        sistema.soloVerifactu
          ? `${sistema.nombre} únicamente puede funcionar como sistema de emisión de facturas ` +
            'verificables («VERI*FACTU»): todos los registros de facturación que genera se remiten ' +
            'de forma continua, segura y automática a la Agencia Estatal de Administración Tributaria.'
          : 'El sistema admite funcionamiento como «VERI*FACTU» y como sistema no «VERI*FACTU».',
      ],
    },
    {
      letra: 'f',
      titulo: 'Soporte a varios obligados tributarios',
      parrafos: [
        sistema.multiplesObligados
          ? 'El sistema permite ser usado por varios obligados tributarios: cada obligado dispone de ' +
            'sus propias series de facturación, su propia cadena de registros de facturación con ' +
            'huella encadenada independiente y su propio identificador de instalación, con aislamiento ' +
            'completo de sus datos.'
          : 'El sistema da soporte a un único obligado tributario por instalación.',
      ],
    },
    {
      letra: 'g',
      titulo: 'Tipos de firma utilizados para firmar los registros de facturación y de evento',
      parrafos: [
        'No se utiliza firma electrónica de los registros de facturación ni de evento: al funcionar ' +
          'el sistema exclusivamente en la modalidad «VERI*FACTU», la integridad e inalterabilidad de ' +
          'los registros se garantiza mediante su huella («hash») encadenada SHA-256 y su remisión ' +
          'inmediata a la Administración tributaria, sin que resulte exigible su firma electrónica ' +
          '(art. 16.3 del Real Decreto 1007/2023 y arts. 13 y 14 de la Orden HAC/1177/2024).',
      ],
    },
    {
      letra: 'h-j',
      titulo: 'Productor del sistema informático',
      parrafos: [
        `Razón social: ${productor.razonSocial}`,
        `NIF: ${productor.nif}.`,
        `Dirección postal completa de contacto: ${productor.domicilio}.`,
        `Inscripción registral: ${productor.registroMercantil}.`,
      ],
    },
    {
      letra: 'k',
      titulo: 'Declaración de conformidad',
      parrafos: [
        `${productor.razonSocial}, como productor del sistema informático de facturación ` +
          `${sistema.nombre}, versión ${sistema.version}, DECLARA BAJO SU RESPONSABILIDAD que dicho ` +
          'sistema, en la versión indicada, cumple con lo dispuesto en el artículo 29.2.j) de la Ley ' +
          '58/2003, de 17 de diciembre, General Tributaria, en el Reglamento que establece los ' +
          'requisitos que deben adoptar los sistemas y programas informáticos o electrónicos que ' +
          'soporten los procesos de facturación de empresarios y profesionales, y la estandarización ' +
          'de formatos de los registros de facturación, aprobado por el Real Decreto 1007/2023, de 5 ' +
          'de diciembre, y en la Orden HAC/1177/2024, de 17 de octubre, que lo desarrolla.',
      ],
    },
    firmada
      ? {
          letra: 'l',
          titulo: 'Fecha y lugar de suscripción',
          parrafos: [
            `Suscrita en ${suscripcion.lugar.trim()}, a ${fechaLarga(suscripcion.fecha)}.`,
            `Por ${productor.razonSocial}: ${suscripcion.firmante.trim()}, ${suscripcion.cargo.trim()}.`,
          ],
        }
      : {
          letra: 'l',
          titulo: 'Fecha y lugar de suscripción',
          parrafos: [PLACEHOLDER_FECHA_LUGAR, PLACEHOLDER_FIRMANTE],
          pendienteRevision: true,
        },
  ]

  return {
    titulo: 'DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN',
    esBorrador,
    sistema,
    productor,
    apartados,
    pendientes: [
      ...(productorListo && !productor.registroMercantil.includes('{{')
        ? []
        : ['NIF e inscripción registral de MILBROTES, S.L. (productor): rellenar PRODUCTOR_SIF en lib/verifactu/productor-sif.ts.']),
      ...(firmada
        ? []
        : ['Fecha, lugar y firmante de la suscripción: rellenar SUSCRIPCION_DECLARACION al firmar la versión definitiva.']),
      ...(esBorrador && firmada && productorListo
        ? ['Suscripción rellenada: falta poner DECLARACION_ES_BORRADOR = false.']
        : []),
    ],
  }
}

const AVISO_BORRADOR =
  '*** BORRADOR PENDIENTE DE SUSCRIPCIÓN (IVAN) — DOCUMENTO NO SUSCRITO. ' +
  'NO ENTREGAR A CLIENTES NI PUBLICAR ***'

/**
 * Render en texto plano de la declaración (para el PDF, tests y la página
 * estática de kuentas.eu). Determinista: sin fechas generadas ni datos de
 * entorno.
 */
export function textoDeclaracionResponsable(
  d: DeclaracionResponsable = declaracionResponsableKuentas()
): string {
  const lineas: string[] = []
  if (d.esBorrador) {
    lineas.push(AVISO_BORRADOR, '')
  }
  lineas.push(d.titulo, '')
  for (const ap of d.apartados) {
    lineas.push(`${ap.letra}) ${ap.titulo}`)
    for (const p of ap.parrafos) lineas.push(p)
    lineas.push('')
  }
  lineas.push(
    'Declaración formulada conforme al artículo 13 del Real Decreto 1007/2023, de 5 de ' +
      'diciembre, y al artículo 15 de la Orden HAC/1177/2024, de 17 de octubre.'
  )
  if (d.esBorrador) {
    lineas.push('', AVISO_BORRADOR)
  }
  return lineas.join('\n')
}
