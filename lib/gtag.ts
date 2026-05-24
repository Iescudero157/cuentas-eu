/**
 * Google Ads conversion tracking helpers.
 *
 * Env vars needed in Vercel (add after creating the Google Ads account):
 *   NEXT_PUBLIC_GOOGLE_ADS_ID              → e.g. AW-1234567890
 *   NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL → e.g. AbCdEfGhIjKlMnOp
 *
 * The code is safe to deploy now — it silently does nothing if the vars are unset.
 */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void;
    dataLayer?: unknown[];
  }
}

export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";

/**
 * Fire a Google Ads conversion event (e.g. on successful registration).
 * Call this immediately after the user action that counts as a conversion.
 */
export function fireConversion(value = 5.0, currency = "EUR"): void {
  if (!GOOGLE_ADS_ID || typeof window === "undefined") return;
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
  if (!label) return;
  window.gtag?.("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
    value,
    currency,
  });
}
