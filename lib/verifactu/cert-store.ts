// ---------------------------------------------------------------------------
// V11 · Custodia del certificado de remisión (tabla sif_certificados).
//
// SOLO se usa desde el servidor con el cliente service_role: la tabla tiene
// RLS deny-all para anon/authenticated (migración 20260918110000) y es la API
// quien autentica al usuario y decide qué devolver (metadatos sí, material
// jamás). El material viaja cifrado con cert-cifrado.ts (AAD ligado a fila y
// tenant) y el análisis/validación del PKCS#12 lo hace certificados.ts.
//
// PROHIBIDO volcar a logs o respuestas el PKCS#12, claves, passphrases o el
// sobre cifrado. Los errores de este módulo solo llevan mensajes operativos.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { CertificadoCliente, TipoCertificado } from './aeat-cliente.ts'
import { cifrar, clavesDesdeEnv, descifrar, ErrorCifrado } from './cert-cifrado.ts'
import {
  analizarPkcs12,
  deserializarMaterial,
  estadoCaducidad,
  materialParaCliente,
  serializarMaterial,
  type EstadoCaducidad,
} from './certificados.ts'

// ---------------------------------------------------------------------------
// Errores y tipos
// ---------------------------------------------------------------------------

export type CodigoErrorCustodia =
  | 'KEK_NO_CONFIGURADA'
  | 'CONFIG_FALTA'
  | 'NIF_NO_COINCIDE'
  | 'CADUCADO'
  | 'AUN_NO_VALIDO'
  | 'BD'

export class ErrorCustodia extends Error {
  readonly codigo: CodigoErrorCustodia
  constructor(codigo: CodigoErrorCustodia, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorCustodia'
    this.codigo = codigo
  }
}

export type TipoTitularidad = 'obligado' | 'representante' | 'sello'

/** Metadatos del certificado custodiado que SÍ pueden viajar al cliente. */
export interface CertificadoResumen {
  id: string
  tipo: TipoTitularidad
  formato: 'pem' | 'pfx'
  subjectCn: string
  nifCertificado: string | null
  nifRepresentado: string | null
  emisorCn: string | null
  numeroSerie: string
  huellaSha256: string
  /** ISO 8601. */
  validoDesde: string
  validoHasta: string
  caducidad: { estado: EstadoCaducidad; diasRestantes: number }
}

export type ResultadoMaterial =
  | { ok: true; certificado: CertificadoCliente; tipoCertificado: TipoCertificado }
  | { ok: false; motivo: string }

interface FilaCertificado {
  id: string
  tipo: TipoTitularidad
  formato: 'pem' | 'pfx'
  material_cifrado: string | null
  subject_cn: string
  nif_certificado: string | null
  nif_representado: string | null
  emisor_cn: string | null
  numero_serie: string
  huella_sha256: string
  valido_desde: string
  valido_hasta: string
}

const COLUMNAS_METADATOS =
  'id, tipo, formato, subject_cn, nif_certificado, nif_representado, emisor_cn, numero_serie, huella_sha256, valido_desde, valido_hasta'

function aadDe(id: string, userId: string): string {
  return `sif_certificados:${id}:${userId}`
}

function resumenDeFila(fila: Omit<FilaCertificado, 'material_cifrado'>, ahora: Date): CertificadoResumen {
  return {
    id: fila.id,
    tipo: fila.tipo,
    formato: fila.formato,
    subjectCn: fila.subject_cn,
    nifCertificado: fila.nif_certificado,
    nifRepresentado: fila.nif_representado,
    emisorCn: fila.emisor_cn,
    numeroSerie: fila.numero_serie,
    huellaSha256: fila.huella_sha256,
    validoDesde: new Date(fila.valido_desde).toISOString(),
    validoHasta: new Date(fila.valido_hasta).toISOString(),
    caducidad: estadoCaducidad(new Date(fila.valido_hasta), ahora),
  }
}

// ---------------------------------------------------------------------------
// Alta (subida desde la UI)
// ---------------------------------------------------------------------------

/**
 * Valida, clasifica, cifra y custodia el PKCS#12 subido por el usuario;
 * retira el certificado activo anterior (si lo había) y apunta
 * `sif_config.certificado_ref` al nuevo. Lanza ErrorCertificado (fichero o
 * contraseña inválidos) o ErrorCustodia (política/entorno/BD).
 */
export async function guardarCertificado(
  supabase: SupabaseClient,
  userId: string,
  pfx: Buffer,
  passphrase: string,
  ahora: Date = new Date()
): Promise<CertificadoResumen> {
  const claves = clavesDesdeEnv()
  if (!claves) {
    throw new ErrorCustodia(
      'KEK_NO_CONFIGURADA',
      'La custodia de certificados no está configurada en el servidor (falta VERIFACTU_CERT_KEK_BASE64)'
    )
  }

  const { metadatos, material } = analizarPkcs12(pfx, passphrase)

  if (metadatos.validoHasta.getTime() <= ahora.getTime()) {
    throw new ErrorCustodia(
      'CADUCADO',
      `El certificado caducó el ${metadatos.validoHasta.toISOString().slice(0, 10)}: renuévelo antes de subirlo`
    )
  }
  if (metadatos.validoDesde.getTime() > ahora.getTime()) {
    throw new ErrorCustodia(
      'AUN_NO_VALIDO',
      `El certificado aún no es válido (lo será desde ${metadatos.validoDesde.toISOString().slice(0, 10)})`
    )
  }

  // El certificado debe corresponder al obligado configurado (o representarlo)
  const { data: config, error: errConfig } = await supabase
    .from('sif_config')
    .select('nif_obligado')
    .eq('user_id', userId)
    .maybeSingle()
  if (errConfig) throw new ErrorCustodia('BD', `No se pudo leer sif_config: ${errConfig.message}`)
  if (!config) {
    throw new ErrorCustodia(
      'CONFIG_FALTA',
      'Antes de subir el certificado debe existir la configuración VERI*FACTU del emisor (sif_config con su NIF)'
    )
  }

  const nifObligado = String(config.nif_obligado).toUpperCase()
  let tipo: TipoTitularidad
  if (metadatos.nifCertificado === nifObligado) {
    tipo = 'obligado'
  } else if (metadatos.nifRepresentado === nifObligado) {
    tipo = metadatos.nifCertificado ? 'representante' : 'sello'
  } else {
    throw new ErrorCustodia(
      'NIF_NO_COINCIDE',
      `El certificado no corresponde al NIF configurado (${nifObligado}): es de ` +
        `${metadatos.nifCertificado ?? metadatos.nifRepresentado ?? 'un titular sin NIF identificable'}`
    )
  }

  const id = randomUUID()
  const sobre = cifrar(serializarMaterial(material), aadDe(id, userId), claves.actual)

  // Retirar el activo anterior (el guard SQL purga su material y sella retirado_at)
  const { error: errRetiro } = await supabase
    .from('sif_certificados')
    .update({ estado: 'retirado' })
    .eq('user_id', userId)
    .eq('estado', 'activo')
  if (errRetiro) throw new ErrorCustodia('BD', `No se pudo retirar el certificado anterior: ${errRetiro.message}`)

  const { data: insertado, error: errInsert } = await supabase
    .from('sif_certificados')
    .insert({
      id,
      user_id: userId,
      tipo,
      formato: material.formato,
      material_cifrado: sobre,
      subject_cn: metadatos.subjectCn,
      nif_certificado: metadatos.nifCertificado,
      nif_representado: metadatos.nifRepresentado,
      emisor_cn: metadatos.emisorCn,
      numero_serie: metadatos.numeroSerie,
      huella_sha256: metadatos.huellaSha256,
      valido_desde: metadatos.validoDesde.toISOString(),
      valido_hasta: metadatos.validoHasta.toISOString(),
      estado: 'activo',
    })
    .select(COLUMNAS_METADATOS)
    .single()
  if (errInsert || !insertado) {
    throw new ErrorCustodia('BD', `No se pudo guardar el certificado: ${errInsert?.message ?? 'sin datos'}`)
  }

  // Referencia opaca en la configuración (diseñada así en V03)
  const { error: errRef } = await supabase
    .from('sif_config')
    .update({ certificado_ref: id })
    .eq('user_id', userId)
  if (errRef) throw new ErrorCustodia('BD', `Certificado guardado pero no se pudo referenciar en sif_config: ${errRef.message}`)

  return resumenDeFila(insertado as FilaCertificado, ahora)
}

// ---------------------------------------------------------------------------
// Consulta y retirada
// ---------------------------------------------------------------------------

/** Metadatos del certificado activo del usuario (o null). Nunca material. */
export async function certificadoActivo(
  supabase: SupabaseClient,
  userId: string,
  ahora: Date = new Date()
): Promise<CertificadoResumen | null> {
  const { data, error } = await supabase
    .from('sif_certificados')
    .select(COLUMNAS_METADATOS)
    .eq('user_id', userId)
    .eq('estado', 'activo')
    .maybeSingle()
  if (error) throw new ErrorCustodia('BD', `No se pudo consultar el certificado: ${error.message}`)
  return data ? resumenDeFila(data as FilaCertificado, ahora) : null
}

/** Retira el certificado activo (purga su material) y limpia certificado_ref. */
export async function retirarCertificado(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sif_certificados')
    .update({ estado: 'retirado' })
    .eq('user_id', userId)
    .eq('estado', 'activo')
    .select('id')
  if (error) throw new ErrorCustodia('BD', `No se pudo retirar el certificado: ${error.message}`)
  const retirado = Boolean(data && data.length > 0)
  if (retirado) {
    const { error: errRef } = await supabase
      .from('sif_config')
      .update({ certificado_ref: null })
      .eq('user_id', userId)
    if (errRef) throw new ErrorCustodia('BD', `Certificado retirado pero certificado_ref no se pudo limpiar: ${errRef.message}`)
  }
  return retirado
}

// ---------------------------------------------------------------------------
// Material para la remisión (worker V10)
// ---------------------------------------------------------------------------

/**
 * Descifra el material del certificado activo del obligado y lo devuelve listo
 * para ClienteAeat. No lanza por ausencia/caducidad/custodia sin configurar:
 * devuelve `{ok:false, motivo}` para que el worker lo anote y la cola siga
 * acumulando (la emisión nunca se detiene, art. 16 Orden HAC/1177/2024).
 */
export async function materialRemision(
  supabase: SupabaseClient,
  userId: string,
  ahora: Date = new Date()
): Promise<ResultadoMaterial> {
  const { data, error } = await supabase
    .from('sif_certificados')
    .select(`${COLUMNAS_METADATOS}, material_cifrado`)
    .eq('user_id', userId)
    .eq('estado', 'activo')
    .maybeSingle()
  if (error) return { ok: false, motivo: `error de BD al leer el certificado: ${error.message}` }
  if (!data) return { ok: false, motivo: 'el obligado no tiene certificado activo (súbalo en Ajustes)' }

  const fila = data as FilaCertificado
  if (new Date(fila.valido_hasta).getTime() <= ahora.getTime()) {
    return { ok: false, motivo: `certificado caducado el ${fila.valido_hasta.slice(0, 10)}: renuévelo` }
  }
  if (!fila.material_cifrado) {
    return { ok: false, motivo: 'el certificado activo no tiene material custodiado (estado inconsistente)' }
  }

  const claves = clavesDesdeEnv()
  if (!claves) return { ok: false, motivo: 'custodia no configurada (falta VERIFACTU_CERT_KEK_BASE64)' }

  try {
    const material = deserializarMaterial(descifrar(fila.material_cifrado, aadDe(fila.id, userId), claves.todas))
    return {
      ok: true,
      certificado: materialParaCliente(material),
      tipoCertificado: fila.tipo === 'sello' ? 'sello' : 'normal',
    }
  } catch (e) {
    const motivo = e instanceof ErrorCifrado ? e.message : 'material custodiado ilegible'
    return { ok: false, motivo }
  }
}
