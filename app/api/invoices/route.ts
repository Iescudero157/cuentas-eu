import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoices: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    number, client_name, client_nif, client_address,
    items, subtotal, iva, iva_rate, irpf, irpf_rate, total,
    date, due_date, status,
  } = body;

  if (!number || !client_name || !date) {
    return NextResponse.json({ error: "Campos obligatorios: number, client_name, date" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      number,
      client_name,
      client_nif,
      client_address,
      items: items ?? [],
      subtotal: subtotal ?? 0,
      iva: iva ?? 0,
      iva_rate: iva_rate ?? 21,
      irpf: irpf ?? 0,
      irpf_rate: irpf_rate ?? 15,
      total: total ?? 0,
      date,
      due_date,
      status: status ?? "pendiente",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoice: data }, { status: 201 });
}
