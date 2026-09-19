import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  verificarIntegridadObligado,
  verificarTodosLosObligados,
} from "@/lib/verifactu/integridad";

// V12 · Verificador de integridad de las cadenas de registros (arts. 8.2 y 12
// RD 1007/2023): recorre la cadena de cada obligado, recalcula huellas con la
// librería V04 y contrasta con el detector SQL. Endpoint interno de operación
// (mismo Bearer CRON_SECRET que el resto de crons).
//   GET /api/verifactu/integridad            → todos los obligados
//   GET /api/verifactu/integridad?user=<uuid> → un obligado
//   &eventos=1 → anota eventos de incidencia (03/04) en sif_eventos
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const params = new URL(request.url).searchParams;
  const userId = params.get("user");
  const opciones = {
    contrastarSql: true,
    registrarEventos: params.get("eventos") === "1",
  };

  try {
    const informes = userId
      ? [await verificarIntegridadObligado(supabase, userId, opciones)]
      : await verificarTodosLosObligados(supabase, opciones);
    return NextResponse.json({
      integra: informes.every((i) => i.integra),
      obligados: informes,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "verifactu_integridad", message: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
