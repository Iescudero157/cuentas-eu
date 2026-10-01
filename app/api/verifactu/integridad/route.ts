import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  verificarIntegridadObligado,
  verificarTodosLosObligados,
} from "@/lib/verifactu/integridad";
import { autorizacionCronValida } from "@/lib/verifactu/seguridad-http";

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
  if (!autorizacionCronValida(request)) {
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
  // V24: validar el UUID antes de llegar a Postgres (un valor arbitrario
  // producía un error de BD que se devolvía en la respuesta).
  if (userId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: "user debe ser un UUID" }, { status: 400 });
  }
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
    console.error("Error verificando integridad Verifactu:", e);
    return NextResponse.json(
      { error: "verifactu_integridad", message: "Error verificando la integridad" },
      { status: 500 }
    );
  }
}
