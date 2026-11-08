import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { IMPORTE_CENTIMOS, nuevaCaducidad } from "@/lib/plan";

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

    // select("*"): funciona antes y después de la migración de caducidad mensual.
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .eq("redsys_order_pending", orderNumber)
      .limit(1);

    if (!profiles || profiles.length === 0) {
      console.warn("[redsys/notify] No profile found for order", orderNumber);
      return new NextResponse("OK", { status: 200 });
    }

    const perfil = profiles[0] as Record<string, unknown>;
    const userId = perfil.id as string | undefined;
    const plan = perfil.redsys_plan_pending as string | null | undefined;

    if (userId && plan) {
      // El importe cobrado tiene que ser el del plan pendiente (el usuario puede tocar su redsys_plan_pending).
      const importe = parseInt(merchantParams.Ds_Amount ?? "", 10);
      const esperado = IMPORTE_CENTIMOS[plan];
      if (esperado === undefined || importe !== esperado) {
        console.error(`[redsys/notify] Importe ${importe} no corresponde al plan "${plan}" (order ${orderNumber}): no se activa`);
        return new NextResponse("OK", { status: 200 });
      }

      // Activate the plan
      const { error: errorPlan } = await supabase
        .from("profiles")
        .update({
          plan,
          redsys_order_pending: null,
          redsys_plan_pending: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (errorPlan) {
        console.error("[redsys/notify] No se pudo activar el plan:", errorPlan.message);
        return new NextResponse("KO", { status: 500 });
      }

      // Caducidad mensual: cada pago cubre un mes desde la mayor entre ahora y la caducidad vigente. Va aparte
      // porque, hasta aplicar la migración 20261108100000_plan_caducidad_mensual.sql, la columna no existe: en ese
      // caso el plan queda activo sin caducidad, como antes, y solo se deja aviso en el log.
      const caducidad = nuevaCaducidad(perfil.plan_expires_at as string | null | undefined);
      const { error: errorCaducidad } = await supabase
        .from("profiles")
        .update({ plan_expires_at: caducidad.toISOString(), plan_avisos_enviados: [] })
        .eq("id", userId);
      if (errorCaducidad) {
        console.warn("[redsys/notify] Plan activado sin caducidad (¿migración pendiente?):", errorCaducidad.message);
      }

      console.log(`[redsys/notify] Plan "${plan}" activated for user ${userId}, order ${orderNumber}`);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("[redsys/notify] Error:", err);
    return new NextResponse("KO", { status: 500 });
  }
}
