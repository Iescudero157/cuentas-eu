// Aplicación de un pago confirmado de un plan de KUENTAS.EU (13-nov-2026). La comparten el aviso del TPV de BBVA
// (/api/redsys/notify) y Stripe (/api/stripe/webhook, /api/stripe/confirmar y /api/stripe/checkout), así que las
// dos pasarelas activan o renuevan el plan exactamente igual: cada pago cubre UN mes desde la mayor entre ahora y
// la caducidad vigente (nuevaCaducidad, lib/plan.ts) y vacía los avisos de caducidad ya enviados.
//
// Pedido pendiente: al iniciar el pago, el servidor guarda en profiles.redsys_order_pending la referencia del
// pedido (el número de pedido de Redsys o el id de la Checkout Session de Stripe; las columnas se llaman redsys_*
// porque nacieron con el TPV, pero valen para las dos) y en redsys_plan_pending el plan. Al confirmarse el pago,
// un único UPDATE condicionado a que esa referencia siga pendiente activa el plan, fija la caducidad y vacía el
// pedido. Si el aviso llega dos veces, o llegan a la vez el webhook y la vuelta del cliente, solo uno encuentra la
// referencia pendiente: el otro no cambia nada (estado «sin_pedido»).
//
// Sin dependencias de Next: lo importan las rutas y los tests de Node (type-stripping), así que solo sintaxis borrable.

import type { SupabaseClient } from "@supabase/supabase-js";
import { IMPORTE_CENTIMOS, esPlanDePago, nuevaCaducidad, type Plan } from "./plan.ts";

export interface PagoConfirmado {
  /** Pasarela que confirma el pago (solo para los mensajes). */
  origen: "redsys" | "stripe";
  /** Referencia del pedido pendiente: Ds_Order de Redsys o id de la Checkout Session de Stripe. */
  pedido: string;
  /** Importe cobrado, en céntimos. */
  importeCentimos: number;
  /** Stripe: usuario de la sesión (lo fija el servidor); se exige que sea el dueño del pedido pendiente. */
  usuario?: string;
  /** Stripe: plan de la sesión. Redsys: no viene y se usa el del perfil (redsys_plan_pending). */
  plan?: string;
  /** Importe que se espera cobrar; por defecto, el del plan (IMPORTE_CENTIMOS). */
  importeEsperado?: number;
  /** Solo para los tests. */
  ahora?: Date;
}

export type ResultadoPago =
  | { estado: "aplicado"; usuario: string; plan: Plan; caducidad: string | null }
  /** Ningún perfil tiene ese pedido pendiente: ya se aplicó (aviso repetido) o es desconocido. */
  | { estado: "sin_pedido" }
  /** El plan o el importe no cuadran: no se activa nada y el pedido sigue pendiente. */
  | { estado: "rechazado"; motivo: string }
  /** Fallo de la base de datos: no se ha cambiado nada y hay que reintentar. */
  | { estado: "error"; motivo: string };

interface ErrorBD {
  code?: string;
  message?: string;
}

// Antes de la migración 20261108100000_plan_caducidad_mensual.sql no existen las columnas de caducidad.
function faltaColumnaDeCaducidad(error: ErrorBD): boolean {
  const texto = `${error.code ?? ""} ${error.message ?? ""}`;
  return /PGRST204|42703/.test(texto) && /plan_expires_at|plan_avisos_enviados/.test(texto);
}

export async function aplicarPagoDePlan(supabase: SupabaseClient, pago: PagoConfirmado): Promise<ResultadoPago> {
  if (!pago.pedido) return { estado: "sin_pedido" };

  // select("*"): funciona antes y después de la migración de caducidad mensual.
  let consulta = supabase.from("profiles").select("*").eq("redsys_order_pending", pago.pedido);
  if (pago.usuario) consulta = consulta.eq("id", pago.usuario);
  const { data: perfiles, error: errorLectura } = await consulta.limit(1);
  if (errorLectura) return { estado: "error", motivo: `no se pudo leer el perfil: ${errorLectura.message}` };
  if (!perfiles || perfiles.length === 0) return { estado: "sin_pedido" };

  const perfil = perfiles[0] as Record<string, unknown>;
  const usuario = perfil.id as string;
  const plan = pago.plan ?? (perfil.redsys_plan_pending as string | null | undefined) ?? null;
  if (!esPlanDePago(plan)) return { estado: "rechazado", motivo: `plan "${plan}" no válido` };

  // El importe cobrado tiene que ser el del plan (en Redsys el plan sale de redsys_plan_pending, que el usuario
  // puede tocar desde el navegador).
  const esperado = pago.importeEsperado ?? IMPORTE_CENTIMOS[plan];
  if (esperado === undefined || pago.importeCentimos !== esperado) {
    return {
      estado: "rechazado",
      motivo: `importe ${pago.importeCentimos} no corresponde al plan "${plan}" (se esperaba ${esperado})`,
    };
  }

  const ahora = pago.ahora ?? new Date();
  const caducidad = nuevaCaducidad(perfil.plan_expires_at as string | null | undefined, ahora).toISOString();
  const activar = {
    plan,
    redsys_order_pending: null,
    redsys_plan_pending: null,
    updated_at: ahora.toISOString(),
  };
  // Solo cambia la fila si el pedido sigue pendiente: un segundo aviso del mismo pago no encuentra nada.
  const reclamar = (cambios: Record<string, unknown>) =>
    supabase
      .from("profiles")
      .update(cambios)
      .eq("id", usuario)
      .eq("redsys_order_pending", pago.pedido)
      .select("id");

  let conCaducidad = true;
  let { data, error } = await reclamar({ ...activar, plan_expires_at: caducidad, plan_avisos_enviados: [] });
  if (error && faltaColumnaDeCaducidad(error)) {
    // Sin la migración: el plan queda activo sin caducidad, como antes del 8-nov-2026.
    console.warn(`[${pago.origen}] Plan activado sin caducidad (¿migración pendiente?): ${error.message}`);
    conCaducidad = false;
    ({ data, error } = await reclamar(activar));
  }
  if (error) return { estado: "error", motivo: `no se pudo activar el plan: ${error.message}` };
  if (!data || data.length === 0) return { estado: "sin_pedido" }; // otro aviso del mismo pago se adelantó

  return { estado: "aplicado", usuario, plan, caducidad: conCaducidad ? caducidad : null };
}
