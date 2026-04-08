import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const type = searchParams.get("type");

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (year) query = query.gte("date", `${year}-01-01`).lte("date", `${year}-12-31`);
  if (month && year) {
    const m = month.padStart(2, "0");
    query = query.gte("date", `${year}-${m}-01`).lte("date", `${year}-${m}-31`);
  }
  if (type) query = query.eq("type", type);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transactions: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { type, description, amount, iva, date, source, category, ai_categorized, client } = body;

  if (!type || !description || !amount || !date) {
    return NextResponse.json({ error: "Campos obligatorios: type, description, amount, date" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type,
      description,
      amount,
      iva: iva ?? 0,
      date,
      source: source ?? "banco",
      category,
      ai_categorized: ai_categorized ?? false,
      client,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transaction: data }, { status: 201 });
}
