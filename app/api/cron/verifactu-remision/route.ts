import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { certificadoDesdeEnv, clienteDesdeEnv } from "@/lib/verifactu/aeat-cliente";
import { procesarRemision } from "@/lib/verifactu/remision";

// V10 · Cron de remisión VERI*FACTU: procesa la cola sif_outbox contra la AEAT
// (art. 16 RRSIF y art. 16 Orden HAC/1177/2024). Programado en vercel.json.
// La cadencia real por obligado la gobierna TiempoEsperaEnvio en SQL: ejecutar
// este cron más a menudo no envía más rápido de lo permitido.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Misma autenticación que el resto de crons (Bearer CRON_SECRET)
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

  // Sin certificado (custodia en V11) la cola simplemente acumula: los
  // reintentos con Incidencia=S del art. 16 Orden cubren este escenario.
  if (!certificadoDesdeEnv()) {
    return NextResponse.json({
      procesado: false,
      motivo:
        "Certificado VERI*FACTU no configurado (V11): la cola queda acumulando y se remitirá con Incidencia=S",
    });
  }

  const supabase = createClient(url, serviceKey);
  let cliente;
  try {
    cliente = clienteDesdeEnv();
  } catch (e) {
    return NextResponse.json(
      { error: `Configuración del cliente AEAT inválida: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  const resultado = await procesarRemision(supabase, () => cliente);
  return NextResponse.json({ procesado: true, ...resultado });
}
