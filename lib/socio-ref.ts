// Programa de socios de MILBROTES (7-nov-2026): código del socio que trae la visita.
// Misma regla que socio-ref.js de las webs: ?ref=CODIGO (alias ?socio=CODIGO), en mayúsculas,
// de 4 a 12 letras o cifras. Si no es válido, se ignora. No se guarda nada en el navegador
// (sin cookies ni localStorage): el código viaja en la URL y, al registrarse, queda en los
// metadatos del usuario como ref_socio (options.data de supabase.auth.signUp).

const PATRON_CODIGO_SOCIO = /^[A-Z0-9]{4,12}$/;

/** Código de ?ref= (o ?socio=) en mayúsculas; "" si no hay o no cumple el patrón. */
export function leerCodigoSocio(params: { get(nombre: string): string | null }): string {
  const valor = String(params.get("ref") || params.get("socio") || "").trim().toUpperCase();
  return PATRON_CODIGO_SOCIO.test(valor) ? valor : "";
}

/** El mismo código, leído de la URL actual (para usarlo al enviar el formulario). */
export function codigoSocioDeLaUrl(): string {
  if (typeof window === "undefined") return "";
  return leerCodigoSocio(new URLSearchParams(window.location.search));
}

/** Ruta interna con ?ref=CODIGO si hay código; sin código, la ruta tal cual. */
export function rutaConCodigoSocio(ruta: string, codigo: string): string {
  if (!codigo) return ruta;
  return `${ruta}${ruta.includes("?") ? "&" : "?"}ref=${codigo}`;
}
