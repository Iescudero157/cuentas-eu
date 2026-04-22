import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import Stripe from "stripe";

// Use service role client for webhook (bypasses RLS)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Map Stripe status to app plan name
function planFromSubscription(sub: Stripe.Subscription): string {
  if (sub.status !== "active" && sub.status !== "trialing") return "gratis";
  const priceId = sub.items.data[0]?.price?.id ?? "";
  const { STRIPE_PRICE_AUTONOMO, STRIPE_PRICE_CREATOR, STRIPE_PRICE_BUSINESS } = process.env;
  if (priceId === STRIPE_PRICE_BUSINESS) return "business";
  if (priceId === STRIPE_PRICE_CREATOR) return "creator";
  if (priceId === STRIPE_PRICE_AUTONOMO) return "autonomo";
  return "gratis";
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    switch (event.type) {
      // Checkout completed → link customer and activate plan
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan ?? "autonomo";
        if (userId) {
          await supabase
            .from("profiles")
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              plan,
            })
            .eq("id", userId);
        }
        break;
      }

      // Subscription updated (plan change, renewal, etc.)
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        const plan = planFromSubscription(sub);
        if (userId) {
          await supabase
            .from("profiles")
            .update({ plan, stripe_subscription_id: sub.id })
            .eq("id", userId);
        } else {
          // Fallback: look up user by customer ID
          const { data } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", sub.customer as string)
            .single();
          if (data?.id) {
            await supabase
              .from("profiles")
              .update({ plan, stripe_subscription_id: sub.id })
              .eq("id", data.id);
          }
        }
        break;
      }

      // Subscription cancelled → downgrade to free
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (userId) {
          await supabase
            .from("profiles")
            .update({ plan: "gratis", stripe_subscription_id: null })
            .eq("id", userId);
        } else {
          const { data } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", sub.customer as string)
            .single();
          if (data?.id) {
            await supabase
              .from("profiles")
              .update({ plan: "gratis", stripe_subscription_id: null })
              .eq("id", data.id);
          }
        }
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }
  } catch (err) {
    console.error(`[stripe/webhook] error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
