// V19 · Declaración responsable del SIF Kuentas (art. 13 RD 1007/2023 +
// art. 15 Orden HAC/1177/2024). Fuente ÚNICA del texto que se muestra en la
// app (/verifactu), se descarga en PDF y se publicará en kuentas.eu: los datos
// identificativos salen de sistemaInformaticoKuentas() (registro-alta.ts) para
// garantizar la coincidencia 1:1 con el bloque SistemaInformatico que viaja en
// cada registro de facturación (art. 10.1.l RRSIF).
//
// ⚠️ ESTADO: BORRADOR pendiente de [REVISIÓN IVAN/ASESOR]. Mientras
// `DECLARACION_ES_BORRADOR` sea true, toda salida (página, PDF, texto) lleva
// de forma destacada la marca de borrador y NO debe entregarse a clientes.
// Server-only (la cadena de imports llega a node:crypto vía registro-alta).

import { sistemaInformaticoKuentas } from './registro-alta.ts'

/** true mientras el texto no haya sido ratificado por Iván y el asesor. */
export const DECLARACION_ES_BORRADOR = true

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
    /** Datos del aviso legal de kuentas.eu — confirmar antes de publicar. */
    domicilio: string
    registroMercantil: string
  }
  apartados: ApartadoDeclaracion[]
  /** Placeholders que Iván/asesor deben resolver antes de publicar. */
  pendientes: string[]
}

const PLACEHOLDER_FECHA_LUGAR =
  '[LUGAR Y FECHA DE SUSCRIPCIÓN — se fijarán al firmar la versión definitiva · REVISIÓN IVAN/ASESOR]'
const PLACEHOLDER_FIRMANTE =
  '[NOMBRE Y CARGO DEL FIRMANTE en representación de Mercadonet Global S.L. — REVISIÓN IVAN/ASESOR]'

/**
 * Construye la declaración responsable de la versión actual del SIF. Los datos
 * identificativos (nombre, id, versión, indicadores VERI*FACTU/multi-OT y
 * productor) se toman de la misma función que los estampa en cada registro de
 * facturación, de modo que un cambio allí se refleja aquí automáticamente
 * (art. 15.1 Orden: los datos deben coincidir con los remitidos a la AEAT).
 */
export function declaracionResponsableKuentas(): DeclaracionResponsable {
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

  const productor = {
    razonSocial: si.nombreRazon,
    nif: si.nif,
    domicilio: 'Ptda. Cortixelles 98, 46900 Torrent (Valencia), España',
    registroMercantil:
      'Registro Mercantil de Valencia, Tomo 9.414, Folio 76, Hoja V-149644',
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
          'que identifica a este sistema en los registros de facturación remitidos a la AEAT. ' +
          '[REVISIÓN IVAN: confirmar el código antes de publicar; debe mantenerse estable entre versiones.]',
      ],
      pendienteRevision: true,
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
        `Razón social: ${productor.razonSocial}.`,
        `NIF: ${productor.nif}.`,
        `Dirección postal completa de contacto: ${productor.domicilio}. ` +
          '[REVISIÓN IVAN: confirmar que este es el domicilio de contacto que debe figurar.]',
        `Inscripción registral: ${productor.registroMercantil}.`,
      ],
      pendienteRevision: true,
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
    {
      letra: 'l',
      titulo: 'Fecha y lugar de suscripción',
      parrafos: [PLACEHOLDER_FECHA_LUGAR, PLACEHOLDER_FIRMANTE],
      pendienteRevision: true,
    },
  ]

  return {
    titulo: 'DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN',
    esBorrador: DECLARACION_ES_BORRADOR,
    sistema,
    productor,
    apartados,
    pendientes: [
      'Código identificador del sistema (IdSistemaInformatico «01»): confirmación de Iván.',
      'Dirección postal de contacto del productor: confirmación de Iván.',
      'Texto completo: revisión jurídica del asesor (es un borrador técnico, no asesoría).',
      'Fecha, lugar y firmante de la suscripción: se fijan al firmar la versión definitiva.',
      'Ámbito de conformidad: territorio común (TicketBAI/forales fuera de alcance); valorar mención expresa con el asesor.',
    ],
  }
}

const AVISO_BORRADOR =
  '*** BORRADOR PENDIENTE DE REVISIÓN (IVAN/ASESOR) — DOCUMENTO NO SUSCRITO. ' +
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
