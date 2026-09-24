import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// V13 · Listado paginado de registros de facturación (altas y anulaciones) del
// usuario autenticado, con su estado de remisión VERI*FACTU, CSV de la AEAT y
// detalle del error si lo hay. Solo lectura: sif_registros es append-only y
// tiene RLS "select own", así que basta la sesión del usuario.
//   GET /api/verifactu/registros?estado=<estado_remision>&limit=25&offset=0

export const dynamic = "force-dynamic";

const ESTADOS_VALIDOS = new Set([
  "generated",
  "queued",
  "sending",
  "accepted",
  "accepted_with_errors",
  "rejected",
]);

const LIMITE_MAX = 100;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  if (estado && !ESTADOS_VALIDOS.has(estado)) {
    return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
  }
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 1),
    LIMITE_MAX
  );
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  let query = supabase
    .from("sif_registros")
    .select(
      "id, correlativo, tipo_registro, invoice_id, num_serie_factura, fecha_expedicion, tipo_factura, importe_total, estado_remision, incidencia, subsanacion, rechazo_previo, csv_aeat, codigo_error_registro, descripcion_error, remitido_at, huella, generado_at",
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("correlativo", { ascending: false })
    .range(offset, offset + limit - 1);
  if (estado) query = query.eq("estado_remision", estado);

  const { data, count, error } = await query;
  if (error) {
    console.error("Error consultando sif_registros:", error);
    return NextResponse.json(
      { error: "Error consultando los registros de facturación" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    registros: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}
