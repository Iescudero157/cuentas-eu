import Stripe from "stripe";

// Map plan names to Stripe Price IDs (set these in Vercel env vars after creating products in Stripe dashboard)
export const STRIPE_PRICE_IDS: Record<string, string> = {
  autonomo: process.env.STRIPE_PRICE_AUTONOMO ?? "",   // 9,99 EUR/mes
  creator:  process.env.STRIPE_PRICE_CREATOR ?? "",    // 19,99 EUR/mes
  business: process.env.STRIPE_PRICE_BUSINESS ?? "",   // 29,99 EUR/mes
};

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
  });
}

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kuentas.eu";
