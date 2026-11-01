// Productor del SIF Kuentas (art. 13 RD 1007/2023; bloque SistemaInformatico,
// art. 10.1.l RRSIF). FUENTE ÚNICA de los datos del productor: de aquí salen
// el bloque SistemaInformatico de cada registro de facturación/evento y la
// declaración responsable (V19), de modo que ambos coinciden siempre (art. 15.1
// Orden HAC/1177/2024).
//
// Traspaso Mercadonet → Milbrotes (oct-2026): el productor pasa a ser
// MILBROTES, S.L. (NIF B05772710; escritura 6.470 de 16-oct-2026, inscrita el
// 26-oct-2026 en el Registro Mercantil de Madrid, hoja M-899621). Mercadonet
// Global S.L. (B98407901) sigue siendo CLIENTE/obligado tributario, no productor.
//
// 30-oct-2026: `nif` y `registroMercantil` rellenados con la comunicación del
// NIF de la AEAT y la inscripción. Si `nif` quedara vacío o con un marcador,
// cualquier emisión de registros y cualquier envío real a la AEAT ABORTA con
// ErrorProductorSif (nunca se remite un SistemaInformatico con NIF vacío).
//
// 1-nov-2026: razón social y domicilio tal como constan en la comunicación del
// NIF de la AEAT (expediente 2026C3677270307Y: «MILBROTES, SOCIEDAD LIMITADA»,
// «CL. BELALCAZAR, 14 - 28006 Madrid») y en el art. 3 de los estatutos
// (centro de negocios SBC Villa El Viso).

export interface ProductorSif {
  /** Razón social del productor (bloque SistemaInformatico.NombreRazon). */
  nombreRazon: string
  /** NIF del productor (bloque SistemaInformatico.NIF). */
  nif: string
  /** Dirección postal de contacto (declaración responsable, art. 15.1 Orden). */
  domicilio: string
  /** Datos de inscripción en el Registro Mercantil (declaración responsable). */
  registroMercantil: string
}

export const MARCADOR_CIF_PRODUCTOR = '{{MILBROTES_CIF}}'
export const MARCADOR_REGISTRO_PRODUCTOR = '{{MILBROTES_REGISTRO}}'

export const PRODUCTOR_SIF: Readonly<ProductorSif> = Object.freeze({
  nombreRazon: 'MILBROTES, S.L.',
  nif: 'B05772710',
  domicilio: 'Calle Belalcázar, 14 (centro de negocios SBC Villa El Viso), 28006 Madrid, España',
  registroMercantil: 'Registro Mercantil de Madrid, hoja M-899621, inscripción 1.ª (26-10-2026)',
})

/** Error de configuración: el productor del SIF no tiene NIF válido. */
export class ErrorProductorSif extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorProductorSif'
  }
}

/**
 * Motivo por el que el productor NO está listo para estampar registros ni
 * remitir a la AEAT, o `null` si lo está. Comprobación de forma (9 caracteres
 * alfanuméricos, sin marcadores); el dígito de control lo valida además
 * `esNifValido` al construir cada registro.
 */
export function motivoProductorSifNoConfigurado(p: Readonly<ProductorSif> = PRODUCTOR_SIF): string | null {
  const nif = (p.nif ?? '').trim()
  if (!nif) return 'el NIF del productor está vacío'
  if (nif.includes('{{') || nif.includes('}}')) return `el NIF del productor es un marcador sin rellenar («${nif}»)`
  if (!/^[A-Z0-9]{9}$/i.test(nif)) return `el NIF del productor no tiene formato válido («${nif}»)`
  if (!(p.nombreRazon ?? '').trim()) return 'la razón social del productor está vacía'
  return null
}

export function productorSifConfigurado(p: Readonly<ProductorSif> = PRODUCTOR_SIF): boolean {
  return motivoProductorSifNoConfigurado(p) === null
}

/**
 * Aborta si el productor no está configurado. Se llama antes de generar
 * registros que se van a persistir (emisión, anulación, subsanación) y antes
 * de cualquier envío real a la AEAT.
 */
export function exigirProductorSifConfigurado(p: Readonly<ProductorSif> = PRODUCTOR_SIF): void {
  const motivo = motivoProductorSifNoConfigurado(p)
  if (motivo) {
    throw new ErrorProductorSif(
      `Productor del SIF sin configurar: ${motivo}. Rellena PRODUCTOR_SIF.nif en ` +
        'lib/verifactu/productor-sif.ts con el NIF de Milbrotes S.L. antes de emitir registros ' +
        'o remitir a la AEAT (art. 10.1.l RRSIF). No se ha enviado nada.'
    )
  }
}
