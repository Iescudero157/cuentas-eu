import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase con la service_role, solo para rutas de servidor: los avisos de pago llegan sin la sesión del
// usuario (y la RLS de profiles solo deja tocar la fila propia) y el plan, su caducidad y los datos de Stripe solo los
// puede cambiar el servidor (trigger profiles_proteger_plan). Nunca en el navegador. null si faltan las variables.
export function clienteServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}
