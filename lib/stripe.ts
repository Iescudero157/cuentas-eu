import Stripe from "stripe";

// Cliente de Stripe. Solo depende de STRIPE_SECRET_KEY (y el webhook, de STRIPE_WEBHOOK_SECRET): desde el
// 13-nov-2026 cada pago lleva su importe en la sesión (lib/pago-stripe.ts), así que las STRIPE_PRICE_* de las
// antiguas suscripciones ya no se usan.
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-03-25.dahlia",
  });
}

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kuentas.eu";
