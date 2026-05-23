import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

const REDSYS_KEY    = process.env.TPV_RAIOLA_REDSYS_KEY ?? "";
const MERCHANT_CODE = process.env.TPV_MERCHANT_CODE ?? "370237745";

function verifyRedsysSignature(
  merchantParamsB64: string,
  orderNumber: string,
  signatureReceived: string
): boolean {
  try {
    const rawKey = Buffer.from(REDSYS_KEY, "base64");

    const orderBuf = Buffer.alloc(8, 0);
    Buffer.from(orderNumber, "utf8").copy(orderBuf, 0, 0, 8);

    const cipher3des = crypto.createCipheriv("des-ede3-ecb", rawKey, null);
    cipher3des.setAutoPadding(false);
    const derivedKey = Buffer.concat([cipher3des.update(orderBuf), cipher3des.final()]);

    const hmac = crypto.createHmac("sha256", derivedKey);
    hmac.update(merchantParamsB64, "ascii");

    const expected = hmac
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    return expected === signatureReceived;
  } catch {
    return false;
  }
}

// Redsys sends a POST form-encoded notification
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);

    const merchantParamsB64  = params.get("Ds_MerchantParameters") ?? "";
    const signatureReceived  = params.get("Ds_Signature") ?? "";

    if (!merchantParamsB64 || !signatureReceived) {
      return new NextResponse("KO", { status: 400 });
    }

    // Decode parameters
    const merchantParamsJson = Buffer.from(merchantParamsB64, "base64").toString("utf8");
    const merchantParams     = JSON.parse(merchantParamsJson) as Record<string, string>;

    const orderNumber     = merchantParams.Ds_Order ?? "";
    const responseCode    = parseInt(merchantParams.Ds_Response ?? "9999", 10);
    const merchantCodeIn  = merchantParams.Ds_MerchantCode ?? "";

    // Security: verify merchant code
    if (merchantCodeIn !== MERCHANT_CODE) {
      console.error("[redsys/notify] Merchant code mismatch");
      return new NextResponse("KO", { status: 403 });
    }

    // Verify signature
    if (!verifyRedsysSignature(merchantParamsB64, orderNumber, signatureReceived)) {
      console.error("[redsys/notify] Invalid signature for order", orderNumber);
      return new NextResponse("KO", { status: 403 });
    }

    // Payment approved: response codes 0000-0099
    const isApproved = responseCode >= 0 && responseCode <= 99;

    if (!isApproved) {
      console.warn("[redsys/notify] Payment denied, code:", responseCode, "order:", orderNumber);
      return new NextResponse("KO", { status: 200 }); // Redsys expects 200 even on KO
    }

    // Find the user who initiated this payment
    const supabase = await createClient();

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, redsys_plan_pending")
      .eq("redsys_order_pending", orderNumber)
      .limit(1);

    if (!profiles || profiles.length === 0) {
      console.warn("[redsys/notify] No profile found for order", orderNumber);
      return new NextResponse("OK", { status: 200 });
    }

    const { id: userId, redsys_plan_pending: plan } = profiles[0];

    if (userId && plan) {
      // Activate the plan
      await supabase
        .from("profiles")
        .update({
          plan,
          redsys_order_pending: null,
          redsys_plan_pending: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      console.log(`[redsys/notify] Plan "${plan}" activated for user ${userId}, order ${orderNumber}`);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("[redsys/notify] Error:", err);
    return new NextResponse("KO", { status: 500 });
  }
}
