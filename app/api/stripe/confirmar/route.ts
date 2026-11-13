import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clienteServicio } from "@/lib/supabase/servicio";
import { getStripe } from "@/lib/stripe";
import { aplicarSesionStripe, esSesionDeKuentas } from "@/lib/pago-stripe";

// Vuelta del cliente desde Stripe Checkout (13-nov-2026): Ajustes llama aquí con el id de la sesión para activar el
// plan sin esperar al webhook. Es la misma aplicación que la del webhook (lib/pago-stripe.ts), así que si el webhook
// ya lo hizo no cambia nada; y si el webhook no llegara (p. ej., tras cambiar de cuenta de Stripe), el plan se
// activa igual. Solo para sesiones del propio usuario.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { session_id?: unknown } | null;
    const id = body?.session_id;
    if (typeof id !== "string" || !/^cs_[A-Za-z0-9_]{10,}$/.test(id)) {
      return NextResponse.json({ error: "Sesión de pago no válida" }, { status: 400 });
    }

    const servicio = clienteServicio();
    if (!servicio || !process.env.STRIPE_SECRET_KEY) {
      console.error("[stripe/confirmar] Faltan STRIPE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json({ error: "Pago no configurado. Contacta con soporte." }, { status: 503 });
    }

    let sesion;
    try {
      sesion = await getStripe().checkout.sessions.retrieve(id);
    } catch (err) {
      const e = err as { code?: string; statusCode?: number };
      if (e?.code === "resource_missing" || e?.statusCode === 404) {
        return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
      }
      throw err;
    }
    if (!esSesionDeKuentas(sesion) || sesion.metadata?.supabase_user_id !== user.id) {
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    }

    const r = await aplicarSesionStripe(servicio, sesion);
    switch (r.estado) {
      case "aplicado":
        console.log(`[stripe/confirmar] Plan "${r.plan}" activado para ${r.usuario} hasta ${r.caducidad}, sesión ${id}`);
        return NextResponse.json({ estado: "aplicado", plan: r.plan, caducidad: r.caducidad });
      case "sin_pedido":
        return NextResponse.json({ estado: "ya_aplicado" });
      case "pendiente":
        return NextResponse.json({ estado: "pendiente" });
      case "rechazado":
        console.error(`[stripe/confirmar] Sesión ${id} pagada y NO aplicada: ${r.motivo}. Revisar a mano.`);
        return NextResponse.json({ estado: "rechazado" }, { status: 409 });
      case "error":
        throw new Error(r.motivo);
      default:
        return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    }
  } catch (err) {
    console.error("[stripe/confirmar]", err);
    return NextResponse.json({ error: "No se pudo confirmar el pago" }, { status: 500 });
  }
}
