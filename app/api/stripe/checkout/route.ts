import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, STRIPE_PRICE_IDS, APP_URL } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { plan } = await req.json();

    const priceId = STRIPE_PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: `Plan "${plan}" no válido o no configurado en Stripe` },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Check if user already has a Stripe customer ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, name, email")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | undefined;

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? profile?.email,
        name: profile?.name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Store customer ID in profile
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${APP_URL}/dashboard/ajustes?plan_success=1`,
      cancel_url: `${APP_URL}/precios`,
      locale: "es",
      metadata: {
        supabase_user_id: user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json(
      { error: "Error creando sesión de pago" },
      { status: 500 }
    );
  }
}
