import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { clienteServicio } from "@/lib/supabase/servicio";
import { aplicarSesionStripe, esSesionDeKuentas } from "@/lib/pago-stripe";

// Aviso de Stripe (13-nov-2026). Con el pago único de un mes (lib/pago-stripe.ts) solo importan las sesiones de
// Checkout pagadas: activan o renuevan un mes el plan con la misma lógica que el aviso del TPV de BBVA
// (lib/pago-plan.ts), una sola vez aunque el aviso llegue repetido. Ya no hay suscripciones: los demás eventos se
// ignoran. La cuenta de Stripe es compartida con otras webs: sus sesiones (sin metadata.app = "kuentas") se
// ignoran con 200, para que Stripe no las reintente.
export async function POST(request: Request) {
  const body = await request.text();
  const firma = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, firma, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (err) {
    console.error("[stripe/webhook] Firma no válida:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ received: true });
  }
  const sesion = event.data.object as Stripe.Checkout.Session;
  if (!esSesionDeKuentas(sesion)) {
    return NextResponse.json({ received: true });
  }

  const servicio = clienteServicio();
  if (!servicio) {
    console.error("[stripe/webhook] Falta SUPABASE_SERVICE_ROLE_KEY: no se puede activar el plan");
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  try {
    const r = await aplicarSesionStripe(servicio, sesion);
    switch (r.estado) {
      case "aplicado":
        console.log(
          `[stripe/webhook] Plan "${r.plan}" activado para ${r.usuario} hasta ${r.caducidad ?? "(sin caducidad)"}, sesión ${sesion.id}`
        );
        break;
      case "sin_pedido":
        console.warn(
          `[stripe/webhook] Sesión ${sesion.id} sin pedido pendiente: ya aplicada (aviso repetido o vuelta del cliente) o sustituida`
        );
        break;
      case "pendiente":
        console.log(`[stripe/webhook] Sesión ${sesion.id} aún sin pagar (${sesion.payment_status})`);
        break;
      case "rechazado":
        console.error(`[stripe/webhook] Sesión ${sesion.id} pagada y NO aplicada: ${r.motivo}. Revisar a mano.`);
        break;
      case "error":
        console.error(`[stripe/webhook] Sesión ${sesion.id}: ${r.motivo}`);
        return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error con ${event.type} ${sesion.id}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
