// Generador del XML del registro de facturación de ANULACIÓN
// (RegistroAnulacion) de Verifactu.
//
// Fuente de la estructura: XSD oficial de la AEAT descargado en
// docs/verifactu/xsd/SuministroInformacion.xsd (elemento global
// `sf:RegistroAnulacion`, tipo `RegistroFacturacionAnulacionType`).
// Base legal: art. 11 RD 1007/2023 (RRSIF) y art. 11 de la Orden
// HAC/1177/2024. Diseño y citas: docs/verifactu/SPEC.md §3.
//
// Una factura erróneamente emitida NUNCA se borra: se anula con este registro,
// que se encadena en la MISMA cadena del obligado que las altas (art. 7 Orden,
// D-12 de SPEC.md). Si lo que procede es corregir, se usa una rectificativa
// (registro de alta R1-R5), no una anulación.
//
// Server-only (usa node:crypto vía huella.ts). NO importar desde cliente.

import {
  type DatosHuellaAnulacion,
  type HuellaAnterior,
  TIPO_HUELLA_SHA256,
  esHuellaValida,
  fechaHoraHusoGenRegistro,
  huellaAnulacion,
  cadenaEntradaAnulacion,
} from './huella.ts'
import {
  type Destinatario,
  type Encadenamiento,
  type Nodo,
  type SistemaInformatico,
  CODIGOS_PAIS,
  ErrorValidacionRegistro,
  ID_VERSION,
  NS_SF,
  esDestinatarioNIF,
  esNifValido,
  fechaOficial,
  serializar,
  validarTexto,
} from './registro-alta.ts'

// ---------------------------------------------------------------------------
// Tipos de entrada
// ---------------------------------------------------------------------------

/** Lista GeneradoPorType del XSD: quién genera el registro de anulación. */
export type GeneradoPor = 'E' | 'D' | 'T'

/** Entrada del generador: identificación de la factura que se anula. */
export interface EntradaRegistroAnulacion {
  /** NIF del obligado emisor de la factura anulada (IDEmisorFacturaAnulada). */
  emisor: { nif: string }
  /** Serie+número de la factura anulada (≤60 ASCII visible, sin espacios en extremos). */
  numSerieFacturaAnulada: string
  /** `aaaa-mm-dd`, `dd-mm-aaaa` o Date. */
  fechaExpedicionFacturaAnulada: string | Date
  /** Referencia interna opcional (RefExterna, ≤60). */
  refExterna?: string
  /** `S` si se anula una factura de la que no consta registro de alta previo. */
  sinRegistroPrevio?: 'S' | 'N'
  /** `S` = reenvío tras rechazo AEAT de un registro de anulación previo (SPEC §5.4). */
  rechazoPrevio?: 'S' | 'N'
  /** `E` emisor · `D` destinatario · `T` tercero. Si D/T, `generador` es obligatorio. */
  generadoPor?: GeneradoPor
  /** Identificación de quien genera el registro (obligatoria si generadoPor es D/T). */
  generador?: Destinatario
}

export interface OpcionesRegistroAnulacion {
  encadenamiento: Encadenamiento
  sistemaInformatico: SistemaInformatico
  /** Momento de generación del registro; por defecto `new Date()` (huso Europe/Madrid). */
  fechaGeneracion?: Date
}

/** Resultado: XML + huella + los datos que persisten en sif_registros/sif_cadena. */
export interface RegistroAnulacionGenerado {
  /** Fragmento `<sf:RegistroAnulacion>` autónomo, listo para envolver en RegFactuSistemaFacturacion. */
  xml: string
  huella: string
  huellaAnterior: HuellaAnterior
  /** Cadena de entrada de la huella (auditoría/depuración). */
  cadenaHuella: string
  datosHuella: DatosHuellaAnulacion
  idEmisorFacturaAnulada: string
  numSerieFacturaAnulada: string
  /** `dd-mm-aaaa` tal como va en el XML. */
  fechaExpedicionFacturaAnulada: string
  fechaHoraHusoGenRegistro: string
  tipoHuella: string
  primerRegistro: boolean
}

// ---------------------------------------------------------------------------
// Generador principal
// ---------------------------------------------------------------------------

/**
 * Construye el registro de anulación completo: valida la identificación de la
 * factura anulada, serializa el XML oficial (`sf:RegistroAnulacion`) y calcula
 * la huella encadenada (misma cadena que las altas, art. 7 Orden). Lanza
 * `ErrorValidacionRegistro` con TODOS los problemas si no es conforme.
 */
export function construirRegistroAnulacion(
  entrada: EntradaRegistroAnulacion,
  opciones: OpcionesRegistroAnulacion
): RegistroAnulacionGenerado {
  const errores: string[] = []
  const e = entrada

  // --- Identificación de la factura anulada ---------------------------------
  const nifEmisor = (e.emisor?.nif ?? '').trim().toUpperCase()
  if (!esNifValido(nifEmisor)) {
    errores.push(`emisor.nif: NIF español inválido «${e.emisor?.nif ?? ''}» (formato o dígito de control)`)
  }
  const numSerie = e.numSerieFacturaAnulada ?? ''
  if (numSerie !== numSerie.trim()) {
    // El algoritmo de huella hace trim de los valores: espacios en los extremos
    // provocarían discrepancia entre XML y huella en la validación AEAT.
    errores.push('numSerieFacturaAnulada: no puede empezar ni terminar en espacios')
  }
  if (!/^[\x20-\x7E]{1,60}$/.test(numSerie)) {
    errores.push(`numSerieFacturaAnulada: debe ser ASCII visible de 1 a 60 caracteres («${numSerie}»)`)
  }
  const fechaExp = fechaOficial(e.fechaExpedicionFacturaAnulada, 'fechaExpedicionFacturaAnulada', errores)

  // --- Marcadores opcionales -------------------------------------------------
  if (e.refExterna !== undefined) validarTexto(e.refExterna, 'refExterna', 60, errores)
  if (e.sinRegistroPrevio && !['S', 'N'].includes(e.sinRegistroPrevio)) {
    errores.push(`sinRegistroPrevio: valor «${e.sinRegistroPrevio}» inválido (S/N)`)
  }
  if (e.rechazoPrevio && !['S', 'N'].includes(e.rechazoPrevio)) {
    errores.push(`rechazoPrevio: valor «${e.rechazoPrevio}» inválido (S/N)`)
  }

  // --- GeneradoPor / Generador ------------------------------------------------
  if (e.generadoPor && !['E', 'D', 'T'].includes(e.generadoPor)) {
    errores.push(`generadoPor: valor «${e.generadoPor}» inválido (E/D/T)`)
  }
  if ((e.generadoPor === 'D' || e.generadoPor === 'T') && !e.generador) {
    errores.push('generador: obligatorio cuando generadoPor es D (destinatario) o T (tercero)')
  }
  if (e.generador && !e.generadoPor) {
    errores.push('generador: solo admisible acompañado de generadoPor')
  }
  let nodoGenerador: Nodo = null
  if (e.generador) {
    const g = e.generador
    validarTexto(g.nombreRazon ?? '', 'generador.nombreRazon', 120, errores)
    if (esDestinatarioNIF(g)) {
      const nif = g.nif.trim().toUpperCase()
      if (!esNifValido(nif)) {
        errores.push(`generador.nif: NIF español inválido «${g.nif}» (para extranjeros use IDOtro)`)
      }
      nodoGenerador = ['Generador', [['NombreRazon', g.nombreRazon], ['NIF', nif]]]
    } else {
      const pais = g.codigoPais?.trim().toUpperCase()
      if (pais && !CODIGOS_PAIS.has(pais)) {
        errores.push(`generador.codigoPais: código «${g.codigoPais}» fuera de la lista CountryType2 del XSD`)
      }
      if (pais === 'ES' && g.idType !== '07') {
        errores.push('generador: para España use el campo NIF (IDOtro con ES solo se admite idType=07 «no censado»)')
      }
      validarTexto(g.id ?? '', 'generador.id', 20, errores)
      nodoGenerador = [
        'Generador',
        [
          ['NombreRazon', g.nombreRazon],
          ['IDOtro', [
            pais ? ['CodigoPais', pais] : null,
            ['IDType', g.idType],
            ['ID', (g.id ?? '').trim()],
          ]],
        ],
      ]
    }
  }

  // --- Encadenamiento (misma mecánica que el alta) ------------------------------
  const enc = opciones.encadenamiento
  const esPrimero = 'primerRegistro' in enc
  let huellaAnterior: HuellaAnterior = null
  let nodoEncadenamiento: Nodo
  if (esPrimero) {
    nodoEncadenamiento = ['Encadenamiento', [['PrimerRegistro', 'S']]]
  } else {
    const ra = enc.registroAnterior
    if (!esHuellaValida(ra.huella ?? '')) {
      errores.push('encadenamiento.registroAnterior.huella: debe ser 64 hexadecimales en mayúsculas')
    }
    const nifAnt = (ra.idEmisorFactura ?? '').trim().toUpperCase()
    if (!/^[A-Z0-9]{9}$/.test(nifAnt)) {
      errores.push('encadenamiento.registroAnterior.idEmisorFactura: NIF de 9 caracteres obligatorio')
    }
    huellaAnterior = ra.huella
    nodoEncadenamiento = [
      'Encadenamiento',
      [
        [
          'RegistroAnterior',
          [
            ['IDEmisorFactura', nifAnt],
            ['NumSerieFactura', ra.numSerieFactura],
            ['FechaExpedicionFactura', fechaOficial(ra.fechaExpedicion, 'encadenamiento.registroAnterior.fechaExpedicion', errores)],
            ['Huella', ra.huella],
          ],
        ],
      ],
    ]
  }

  // --- SistemaInformatico -------------------------------------------------------
  const si = opciones.sistemaInformatico
  validarTexto(si.nombreRazon, 'sistemaInformatico.nombreRazon', 120, errores)
  if (!esNifValido(si.nif)) errores.push(`sistemaInformatico.nif: NIF inválido «${si.nif}»`)
  validarTexto(si.nombreSistemaInformatico, 'sistemaInformatico.nombreSistemaInformatico', 30, errores)
  validarTexto(si.idSistemaInformatico, 'sistemaInformatico.idSistemaInformatico', 2, errores)
  validarTexto(si.version, 'sistemaInformatico.version', 50, errores)
  validarTexto(si.numeroInstalacion, 'sistemaInformatico.numeroInstalacion', 100, errores)

  // --- Fecha-hora de generación --------------------------------------------------
  const fechaHoraGen = fechaHoraHusoGenRegistro(opciones.fechaGeneracion ?? new Date())

  if (errores.length > 0) throw new ErrorValidacionRegistro(errores)

  // --- Huella (V04): mismos valores que van al XML --------------------------------
  const datosHuella: DatosHuellaAnulacion = {
    IDEmisorFacturaAnulada: nifEmisor,
    NumSerieFacturaAnulada: numSerie,
    FechaExpedicionFacturaAnulada: fechaExp,
    FechaHoraHusoGenRegistro: fechaHoraGen,
  }
  const cadenaHuella = cadenaEntradaAnulacion(datosHuella, huellaAnterior)
  const huella = huellaAnulacion(datosHuella, huellaAnterior)

  // --- Árbol del XML en el ORDEN EXACTO de la secuencia del XSD --------------------
  const arbol: Nodo[] = [
    ['IDVersion', ID_VERSION],
    [
      'IDFactura',
      [
        ['IDEmisorFacturaAnulada', nifEmisor],
        ['NumSerieFacturaAnulada', numSerie],
        ['FechaExpedicionFacturaAnulada', fechaExp],
      ],
    ],
    e.refExterna ? ['RefExterna', e.refExterna] : null,
    e.sinRegistroPrevio ? ['SinRegistroPrevio', e.sinRegistroPrevio] : null,
    e.rechazoPrevio ? ['RechazoPrevio', e.rechazoPrevio] : null,
    e.generadoPor ? ['GeneradoPor', e.generadoPor] : null,
    nodoGenerador,
    nodoEncadenamiento,
    [
      'SistemaInformatico',
      [
        ['NombreRazon', si.nombreRazon],
        ['NIF', si.nif.trim().toUpperCase()],
        ['NombreSistemaInformatico', si.nombreSistemaInformatico],
        ['IdSistemaInformatico', si.idSistemaInformatico],
        ['Version', si.version],
        ['NumeroInstalacion', si.numeroInstalacion],
        ['TipoUsoPosibleSoloVerifactu', si.tipoUsoPosibleSoloVerifactu],
        ['TipoUsoPosibleMultiOT', si.tipoUsoPosibleMultiOT],
        ['IndicadorMultiplesOT', si.indicadorMultiplesOT],
      ],
    ],
    ['FechaHoraHusoGenRegistro', fechaHoraGen],
    ['TipoHuella', TIPO_HUELLA_SHA256],
    ['Huella', huella],
  ]

  const xml = `<sf:RegistroAnulacion xmlns:sf="${NS_SF}">\n${serializar(arbol, 'sf', 1)}\n</sf:RegistroAnulacion>`

  return {
    xml,
    huella,
    huellaAnterior,
    cadenaHuella,
    datosHuella,
    idEmisorFacturaAnulada: nifEmisor,
    numSerieFacturaAnulada: numSerie,
    fechaExpedicionFacturaAnulada: fechaExp,
    fechaHoraHusoGenRegistro: fechaHoraGen,
    tipoHuella: TIPO_HUELLA_SHA256,
    primerRegistro: esPrimero,
  }
}
