import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// V10 · Endpoint INTERNO de estado de la cola de remisión VERI*FACTU:
// contadores del outbox y de sif_registros, pendiente más antiguo y situación
// por obligado (control de flujo, fallos consecutivos, circuit breaker).
// Protegido con CRON_SECRET: es una herramienta de operación, no de usuario
// (el panel de usuario llega en V13).

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL no configurados" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase.rpc("sif_remision_estado");
  if (error) {
    return NextResponse.json({ error: `sif_remision_estado: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ generado_at: new Date().toISOString(), ...data });
}
