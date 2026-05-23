import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// ── Redsys BBVA TPV Virtual Integration ───────────────────────────────────────
// Merchant credentials (set in Vercel environment variables)
const REDSYS_KEY      = process.env.TPV_RAIOLA_REDSYS_KEY ?? "";
const MERCHANT_CODE   = process.env.TPV_MERCHANT_CODE ?? "370237745";
const TERMINAL        = process.env.TPV_TERMINAL ?? "001";
const REDSYS_URL      = "https://sis.redsys.es/sis/realizarPago";
const APP_URL         = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kuentas.eu";

// Plan amounts in cents (EUR × 100)
const PLAN_AMOUNTS: Record<string, number> = {
  autonomo: 999,   // 9,99 EUR
  creator: 1999,   // 19,99 EUR
  business: 2999,  // 29,99 EUR
};

/**
 * Generate a unique 12-char order number (alphanum, Redsys requirement).
 * Must start with 4 digits.
 */
function generateOrderNumber(): string {
  const ts  = Date.now().toString().slice(-8);
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return ts + rnd; // 12 chars
}

/**
 * Create the Redsys SHA-256 signature.
 * 1. Base64-decode the merchant key
 * 2. 3DES-ECB encrypt the order number (padded to 8 bytes) → derived key
 * 3. HMAC-SHA256 of the Base64-encoded merchant params using the derived key
 * 4. Return URL-safe Base64
 */
function createRedsysSignature(merchantParamsB64: string, orderNumber: string): string {
  const rawKey = Buffer.from(REDSYS_KEY, "base64");

  // Pad / truncate order to 8 bytes for 3DES-ECB
  const orderBuf = Buffer.alloc(8, 0);
  Buffer.from(orderNumber, "utf8").copy(orderBuf, 0, 0, 8);

  const cipher3des = crypto.createCipheriv("des-ede3-ecb", rawKey, null);
  cipher3des.setAutoPadding(false);
  const derivedKey = Buffer.concat([cipher3des.update(orderBuf), cipher3des.final()]);

  const hmac = crypto.createHmac("sha256", derivedKey);
  hmac.update(merchantParamsB64, "ascii");

  return hmac
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { plan } = await request.json();
    const amount = PLAN_AMOUNTS[plan];

    if (!amount) {
      return NextResponse.json({ error: `Plan "${plan}" no válido` }, { status: 400 });
    }

    if (!REDSYS_KEY) {
      return NextResponse.json(
        { error: "TPV no configurado. Contacta con soporte." },
        { status: 503 }
      );
    }

    const orderNumber = generateOrderNumber();

    // Store order number in session for verification on callback
    await supabase
      .from("profiles")
      .update({ redsys_order_pending: orderNumber, redsys_plan_pending: plan })
      .eq("id", user.id);

    const merchantParams = {
      DS_MERCHANT_AMOUNT:          String(amount),
      DS_MERCHANT_ORDER:           orderNumber,
      DS_MERCHANT_MERCHANTCODE:    MERCHANT_CODE,
      DS_MERCHANT_TERMINAL:        TERMINAL,
      DS_MERCHANT_TRANSACTIONTYPE: "0",          // 0 = payment
      DS_MERCHANT_CURRENCY:        "978",         // 978 = EUR
      DS_MERCHANT_URLOK:           `${APP_URL}/dashboard/ajustes?tpv_ok=1&order=${orderNumber}`,
      DS_MERCHANT_URLKO:           `${APP_URL}/precios?tpv_ko=1`,
      DS_MERCHANT_MERCHANTURL:     `${APP_URL}/api/redsys/notify`,
      DS_MERCHANT_MERCHANTNAME:    "KUENTAS.EU",
      DS_MERCHANT_PRODUCTDESCRIPTION: `Plan ${plan} KUENTAS.EU`,
    };

    const paramsJson   = JSON.stringify(merchantParams);
    const paramsB64    = Buffer.from(paramsJson, "utf8").toString("base64");
    const signature    = createRedsysSignature(paramsB64, orderNumber);

    return NextResponse.json({
      redsysUrl:        REDSYS_URL,
      Ds_SignatureVersion:   "HMAC_SHA256_V1",
      Ds_MerchantParameters: paramsB64,
      Ds_Signature:          signature,
    });
  } catch (err) {
    console.error("[redsys/checkout]", err);
    return NextResponse.json({ error: "Error generando pago TPV" }, { status: 500 });
  }
}
