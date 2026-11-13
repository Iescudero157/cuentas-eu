import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { aplicarPagoDePlan } from "@/lib/pago-plan";

const REDSYS_KEY    = process.env.TPV_RAIOLA_REDSYS_KEY ?? "";
const MERCHANT_CODE = process.env.TPV_MERCHANT_CODE ?? "370237745";

// 8-nov-2026: la notificación de Redsys llega de servidor a servidor, sin sesión de usuario, y la RLS de
// profiles solo deja leer y escribir la fila propia (auth.uid() = id): con el cliente de cookies la consulta no
// encontraba el perfil y el plan nunca se activaba. Se usa el service_role, como en el resto de rutas de servidor.
function clienteServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createServiceClient(url, serviceKey);
}

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
    const servicio = clienteServicio();
    if (!servicio) {
      console.error("[redsys/notify] Falta SUPABASE_SERVICE_ROLE_KEY: sin ella la RLS no deja activar el plan");
    }
    const supabase = servicio ?? (await createClient());

    // 13-nov-2026: la activación es la misma que la del aviso de Stripe (lib/pago-plan.ts): busca el perfil con este
    // pedido pendiente, exige que el importe cobrado sea el del plan pendiente (el usuario puede tocar su
    // redsys_plan_pending) y, en un solo UPDATE condicionado a que el pedido siga pendiente, activa el plan, suma un
    // mes a la caducidad y vacía el pedido. Un aviso repetido ya no encuentra el pedido y no cambia nada.
    const resultado = await aplicarPagoDePlan(supabase, {
      origen: "redsys",
      pedido: orderNumber,
      importeCentimos: parseInt(merchantParams.Ds_Amount ?? "", 10),
    });

    switch (resultado.estado) {
      case "sin_pedido":
        console.warn("[redsys/notify] No profile found for order", orderNumber);
        break;
      case "rechazado":
        console.error(`[redsys/notify] ${resultado.motivo} (order ${orderNumber}): no se activa`);
        break;
      case "error":
        console.error("[redsys/notify] No se pudo activar el plan:", resultado.motivo);
        return new NextResponse("KO", { status: 500 });
      case "aplicado":
        console.log(`[redsys/notify] Plan "${resultado.plan}" activated for user ${resultado.usuario}, order ${orderNumber}`);
        break;
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("[redsys/notify] Error:", err);
    return new NextResponse("KO", { status: 500 });
  }
}
