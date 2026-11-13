// Cobro de los planes de KUENTAS.EU con Stripe Checkout (13-nov-2026): pago ÚNICO que cubre un mes del plan, sin
// suscripción ni cargo automático, con los mismos importes que el TPV de BBVA (IMPORTE_CENTIMOS de lib/plan.ts).
// El importe va en la propia sesión: no se usan productos ni precios creados en Stripe (las STRIPE_PRICE_* eran de
// las suscripciones) ni clientes de Stripe. Así todo depende solo de STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET:
// pasar el cobro a otra cuenta de Stripe (la de MILBROTES) es cambiar esas dos variables en Vercel y dar de alta
// allí el webhook (/api/stripe/webhook con checkout.session.completed).
//
// La cuenta de Stripe la comparten varias webs: solo son de Kuentas las sesiones con metadata.app = "kuentas".
//
// Pago de prueba: las cuentas cuyo email esté en la variable KUENTAS_PAGO_PRUEBA_EMAILS (separados por comas)
// pagan 1,00 € en lugar del precio del plan, con el mismo recorrido (sesión, aviso, plan y caducidad de un mes).
//
// Sin dependencias de Next: lo importan las rutas y los tests de Node (type-stripping), así que solo sintaxis borrable.

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IMPORTE_CENTIMOS, NOMBRE_PLAN, esPlanDePago, type Plan } from "./plan.ts";
import { aplicarPagoDePlan, type ResultadoPago } from "./pago-plan.ts";

/** Marca de las sesiones de Kuentas en la cuenta de Stripe compartida (metadata.app). */
export const APP_STRIPE = "kuentas";

/** Importe del pago de prueba, en céntimos (1,00 €). */
export const IMPORTE_PRUEBA_CENTIMOS = 100;

/** ¿Paga esta cuenta el importe de prueba? (KUENTAS_PAGO_PRUEBA_EMAILS, emails separados por comas). */
export function esCuentaDePrueba(
  email: string | null | undefined,
  lista: string | undefined = process.env.KUENTAS_PAGO_PRUEBA_EMAILS,
): boolean {
  if (!email || !lista) return false;
  const buscado = email.trim().toLowerCase();
  return lista.split(",").some((e) => e.trim().toLowerCase() === buscado);
}

export interface DatosSesion {
  usuario: string;
  email?: string | null;
  plan: Plan;
  prueba?: boolean;
  appUrl: string;
  /** Desde dónde se paga: si se cancela el pago, se vuelve ahí. */
  origen?: "precios" | "ajustes";
}

/** Parámetros de la Checkout Session de un mes de plan. */
export function parametrosSesion(d: DatosSesion): Stripe.Checkout.SessionCreateParams {
  const importe = d.prueba ? IMPORTE_PRUEBA_CENTIMOS : IMPORTE_CENTIMOS[d.plan];
  const concepto = `KUENTAS.EU · Plan ${NOMBRE_PLAN[d.plan]} · 1 mes${d.prueba ? " (pago de prueba)" : ""}`;
  const metadata: Record<string, string> = {
    app: APP_STRIPE,
    supabase_user_id: d.usuario,
    plan: d.plan,
    tipo: "plan_un_mes",
  };
  if (d.prueba) metadata.prueba = "1";

  return {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: importe,
          product_data: {
            name: concepto,
            description: "Pago único que cubre un mes del plan. Sin cargos automáticos. IVA incluido.",
          },
        },
      },
    ],
    client_reference_id: d.usuario,
    ...(d.email ? { customer_email: d.email } : {}),
    metadata,
    payment_intent_data: { description: concepto, metadata },
    locale: "es",
    submit_type: "pay",
    custom_text: {
      submit: {
        message:
          "Cada pago cubre un mes del plan. No hay cargos automáticos: antes de que caduque te avisamos por email para renovarlo.",
      },
    },
    success_url: `${d.appUrl}/dashboard/ajustes?pago=stripe&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: d.origen === "ajustes" ? `${d.appUrl}/dashboard/ajustes?renovar=1` : `${d.appUrl}/precios`,
  };
}

export type SesionStripe = Pick<
  Stripe.Checkout.Session,
  "id" | "mode" | "status" | "payment_status" | "amount_total" | "currency" | "metadata"
>;

export type ResultadoSesion =
  | ResultadoPago
  /** Sesión de otra web de la cuenta de Stripe (o que no es un pago de plan de Kuentas): no se toca. */
  | { estado: "ajena" }
  /** Sesión aún sin pagar: abierta, caducada o con un pago diferido sin confirmar. */
  | { estado: "pendiente" };

export function esSesionDeKuentas(s: Pick<SesionStripe, "metadata" | "mode">): boolean {
  return s.metadata?.app === APP_STRIPE && s.mode === "payment";
}

/** Aplica (una sola vez) el mes de plan de una sesión pagada. La usan el webhook, la vuelta del cliente y el checkout. */
export async function aplicarSesionStripe(supabase: SupabaseClient, s: SesionStripe): Promise<ResultadoSesion> {
  if (!esSesionDeKuentas(s)) return { estado: "ajena" };
  if (s.status !== "complete" || s.payment_status !== "paid") return { estado: "pendiente" };

  const md = s.metadata ?? {};
  const plan = md.plan;
  if (!md.supabase_user_id || !esPlanDePago(plan)) {
    return { estado: "rechazado", motivo: "sesión sin usuario o con un plan no válido" };
  }
  if ((s.currency ?? "").toLowerCase() !== "eur") {
    return { estado: "rechazado", motivo: `moneda ${s.currency} en lugar de eur` };
  }
  return aplicarPagoDePlan(supabase, {
    origen: "stripe",
    pedido: s.id,
    usuario: md.supabase_user_id,
    plan,
    importeCentimos: s.amount_total ?? -1,
    importeEsperado: md.prueba === "1" ? IMPORTE_PRUEBA_CENTIMOS : IMPORTE_CENTIMOS[plan],
  });
}

/** Lo que se usa de stripe.checkout.sessions (así los tests pueden pasar un doble). */
export interface SesionesStripe {
  retrieve(id: string): Promise<SesionStripe>;
  expire(id: string): Promise<unknown>;
}

function esNoEncontrada(err: unknown): boolean {
  const e = err as { code?: string; statusCode?: number } | null;
  return e?.code === "resource_missing" || e?.statusCode === 404;
}

/**
 * Antes de abrir una sesión nueva: solo se puede pagar la última. Si la anterior sigue abierta, se cierra; si ya se
 * pagó y su aviso aún no ha llegado, se aplica aquí. Devuelve el mensaje para el usuario cuando no conviene abrir
 * otra (su pago anterior ya cuenta o está por confirmar) y null cuando se puede seguir.
 */
export async function cerrarSesionAnterior(
  sesiones: SesionesStripe,
  supabase: SupabaseClient,
  id: string,
): Promise<string | null> {
  let s: SesionStripe;
  try {
    s = await sesiones.retrieve(id);
  } catch (err) {
    if (esNoEncontrada(err)) return null; // p. ej., una sesión de la cuenta de Stripe anterior
    throw err;
  }
  if (s.status === "open") {
    try {
      await sesiones.expire(id);
      return null;
    } catch {
      s = await sesiones.retrieve(id); // se acaba de pagar (o de caducar) mientras tanto
    }
  }
  if (s.status !== "complete") return null; // caducada: no se puede pagar

  const r = await aplicarSesionStripe(supabase, s);
  switch (r.estado) {
    case "aplicado":
    case "sin_pedido":
      return "Tu pago anterior ya está confirmado. Recarga la página para ver tu plan al día.";
    case "pendiente":
      return "Tienes un pago anterior pendiente de confirmar. Cuando se confirme, tu plan se activará solo.";
    case "error":
      throw new Error(r.motivo);
    case "rechazado":
      console.error(`[stripe] Sesión ${id} pagada y NO aplicada: ${r.motivo}. Revisar a mano.`);
      return null;
    default:
      return null;
  }
}
