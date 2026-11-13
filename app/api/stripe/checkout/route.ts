import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clienteServicio } from "@/lib/supabase/servicio";
import { getStripe, APP_URL } from "@/lib/stripe";
import { esPlanDePago } from "@/lib/plan";
import { cerrarSesionAnterior, esCuentaDePrueba, parametrosSesion } from "@/lib/pago-stripe";

// Pago de un mes de plan con Stripe Checkout (13-nov-2026): pago único, sin suscripción ni cargo automático, con los
// mismos importes que el TPV de BBVA. Lo llaman Precios y Ajustes cuando lib/pasarela.ts dice "stripe". El plan lo
// activa lib/pago-plan.ts al confirmarse el pago (webhook o vuelta del cliente), una sola vez por sesión.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { plan?: unknown; origen?: unknown } | null;
    const plan = body?.plan;
    if (typeof plan !== "string" || !esPlanDePago(plan)) {
      return NextResponse.json({ error: `Plan "${String(plan)}" no válido` }, { status: 400 });
    }

    const servicio = clienteServicio();
    if (!servicio || !process.env.STRIPE_SECRET_KEY) {
      console.error("[stripe/checkout] Faltan STRIPE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json({ error: "Pago no configurado. Contacta con soporte." }, { status: 503 });
    }
    const stripe = getStripe();

    const { data: perfil, error: errorPerfil } = await servicio
      .from("profiles")
      .select("id, redsys_order_pending")
      .eq("id", user.id)
      .maybeSingle();
    if (errorPerfil) throw new Error(`no se pudo leer el perfil: ${errorPerfil.message}`);
    if (!perfil) {
      return NextResponse.json(
        { error: "No encontramos tu perfil. Escríbenos a kuentas@mercadonet.es." },
        { status: 409 }
      );
    }

    // Solo se puede pagar la última sesión: la anterior se cierra o, si ya se pagó, se aplica antes de seguir.
    const anterior = (perfil.redsys_order_pending as string | null) ?? null;
    if (anterior?.startsWith("cs_")) {
      const aviso = await cerrarSesionAnterior(stripe.checkout.sessions, servicio, anterior);
      if (aviso) return NextResponse.json({ error: aviso }, { status: 409 });
    }

    const sesion = await stripe.checkout.sessions.create(
      parametrosSesion({
        usuario: user.id,
        email: user.email,
        plan,
        prueba: esCuentaDePrueba(user.email),
        appUrl: APP_URL,
        origen: body?.origen === "ajustes" ? "ajustes" : "precios",
      })
    );

    // Pedido pendiente, con el que lib/pago-plan.ts aplica el pago una sola vez. Solo si nadie lo ha cambiado
    // mientras tanto (otra pestaña iniciando otro pago a la vez); si no, esta sesión se cierra.
    let guardar = servicio
      .from("profiles")
      .update({ redsys_order_pending: sesion.id, redsys_plan_pending: plan })
      .eq("id", user.id);
    guardar = anterior === null
      ? guardar.is("redsys_order_pending", null)
      : guardar.eq("redsys_order_pending", anterior);
    const { data: guardado, error: errorGuardar } = await guardar.select("id");

    if (errorGuardar || !guardado || guardado.length === 0 || !sesion.url) {
      await stripe.checkout.sessions.expire(sesion.id).catch(() => undefined);
      if (!errorGuardar && sesion.url) {
        return NextResponse.json(
          { error: "Ya hay otro pago en marcha. Recarga la página e inténtalo de nuevo." },
          { status: 409 }
        );
      }
      throw new Error(`no se pudo preparar el pago: ${errorGuardar?.message ?? "Stripe no devolvió la URL"}`);
    }

    return NextResponse.json({ url: sesion.url });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: "No se pudo iniciar el pago. Inténtalo de nuevo." }, { status: 500 });
  }
}
