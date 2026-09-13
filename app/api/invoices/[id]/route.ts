import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const { data: actual, error: fetchError } = await supabase
    .from("invoices")
    .select("verifactu_estado")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!actual) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  const emitida = actual.verifactu_estado && actual.verifactu_estado !== "borrador";

  // Only allow safe fields to be updated
  const allowedFields: Record<string, unknown> = {};
  if (body.status !== undefined) allowedFields.status = body.status;
  if (body.payment_method !== undefined) allowedFields.payment_method = body.payment_method;
  if (body.payment_date !== undefined) allowedFields.payment_date = body.payment_date;
  if (body.notes !== undefined) allowedFields.notes = body.notes;
  if (body.due_date !== undefined) allowedFields.due_date = body.due_date;
  if (body.client_email !== undefined) {
    // Verifactu (V07): en facturas emitidas el contenido fiscal es inmutable
    // (art. 8.2 RD 1007/2023); el email del cliente forma parte del snapshot.
    if (emitida) {
      return NextResponse.json(
        {
          error: "factura_inmutable",
          message:
            "La factura está emitida bajo Verifactu: su contenido no puede modificarse. Para corregirla, emite una rectificativa o anúlala.",
        },
        { status: 409 }
      );
    }
    allowedFields.client_email = body.client_email;
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({ ...allowedFields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoice: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // Verifactu (V07, D-12): el borrado físico solo existe para borradores; una
  // factura emitida se ANULA (registro de anulación, art. 11 RD 1007/2023).
  const { data: actual, error: fetchError } = await supabase
    .from("invoices")
    .select("verifactu_estado")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!actual) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }
  if (actual.verifactu_estado && actual.verifactu_estado !== "borrador") {
    return NextResponse.json(
      {
        error: "factura_emitida",
        message:
          "Las facturas emitidas bajo Verifactu no pueden borrarse (art. 11 RD 1007/2023). Usa la anulación (POST /api/invoices/{id}/anular) o emite una rectificativa.",
      },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
