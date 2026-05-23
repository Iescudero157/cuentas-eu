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

  // Only allow safe fields to be updated
  const allowedFields: Record<string, unknown> = {};
  if (body.status !== undefined) allowedFields.status = body.status;
  if (body.payment_method !== undefined) allowedFields.payment_method = body.payment_method;
  if (body.payment_date !== undefined) allowedFields.payment_date = body.payment_date;
  if (body.client_email !== undefined) allowedFields.client_email = body.client_email;
  if (body.notes !== undefined) allowedFields.notes = body.notes;
  if (body.due_date !== undefined) allowedFields.due_date = body.due_date;

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
