import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// V13 · Listado de eventos del SIF del usuario autenticado (art. 9 Orden
// HAC/1177/2024; en modalidad VERI*FACTU el registro de eventos está exento
// por art. 3, pero el detector de anomalías de V12 sí anota incidencias aquí).
// Solo lectura vía RLS "select own"; sif_eventos es append-only.
//   GET /api/verifactu/eventos?limit=50&offset=0

export const dynamic = "force-dynamic";

const LIMITE_MAX = 100;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1),
    LIMITE_MAX
  );
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  const { data, count, error } = await supabase
    .from("sif_eventos")
    .select(
      "id, correlativo, tipo_evento, datos, huella, fecha_hora_huso_gen, generado_at",
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("correlativo", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    return NextResponse.json(
      { error: `sif_eventos: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    eventos: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}
