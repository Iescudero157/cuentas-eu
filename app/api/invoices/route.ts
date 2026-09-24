import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emitirFactura, ErrorEmision } from "@/lib/verifactu/emision";
import { ErrorValidacionRegistro } from "@/lib/verifactu/registro-alta";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  // V24: enum cerrado para el filtro y cota superior de filas (sin `limit`
  // la consulta crecía sin límite con el histórico del usuario).
  const ESTADOS = new Set(["cobrada", "pendiente", "vencida"]);
  if (status && !ESTADOS.has(status)) {
    return NextResponse.json({ error: "Filtro status no válido" }, { status: 400 });
  }
  const LIMITE_MAX = 1000;

  let query = supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(LIMITE_MAX);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    console.error("Error listando facturas:", error);
    return NextResponse.json({ error: "Error consultando las facturas" }, { status: 500 });
  }

  return NextResponse.json({ invoices: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // V24: JSON malformado devolvía un 500 genérico de Next; y sin tope de
  // items el JSONB podía crecer sin límite.
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }
  const {
    number, client_name, client_nif, client_address,
    items, subtotal, iva, iva_rate, irpf, irpf_rate, total,
    date, due_date, status,
    client_id, client_email, payment_method, payment_date, notes,
  } = body;

  if (!number || !client_name || !date) {
    return NextResponse.json({ error: "Campos obligatorios: number, client_name, date" }, { status: 400 });
  }
  if (items !== undefined && (!Array.isArray(items) || items.length > 500)) {
    return NextResponse.json(
      { error: "items debe ser una lista de como máximo 500 líneas" },
      { status: 400 }
    );
  }

  // ── Plan limit: gratis users can create max 5 invoices/month ──────────────
  const { data: profileData } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const userPlan = (profileData?.plan as string) ?? "gratis";

  if (userPlan === "gratis") {
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const { count } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("date", firstDay)
      .lte("date", lastDay);

    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        {
          error: "limit_reached",
          message:
            "Has alcanzado el límite de 5 facturas/mes del plan Gratis. Mejora tu plan para crear facturas ilimitadas.",
          limit: 5,
          count: count ?? 5,
        },
        { status: 402 }
      );
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

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
      client_id,
      client_email,
      payment_method,
      payment_date,
      notes,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creando factura:", error);
    return NextResponse.json({ error: "Error creando la factura" }, { status: 500 });
  }

  // ── Verifactu (V07): si el módulo está activo para el obligado, la creación
  // ES la emisión (salvo borrador:true): numeración de servidor + registro de
  // alta + huella encadenada + outbox, todo atómico (RPC sif_emitir_factura).
  // Con sif_config ausente o activo=false la app se comporta como hasta ahora.
  if (body.borrador !== true) {
    try {
      const resultado = await emitirFactura(supabase, user.id, data.id);
      if (resultado.sifActivo) {
        const { data: emitida } = await supabase
          .from("invoices")
          .select("*")
          .eq("id", data.id)
          .single();
        return NextResponse.json(
          { invoice: emitida ?? data, verifactu: resultado },
          { status: 201 }
        );
      }
    } catch (e) {
      // Emisión fallida: la RPC es atómica (no consumió número ni cadena) y la
      // factura sigue en borrador. La app actual no gestiona borradores, así
      // que lo retiramos para no dejar restos y devolvemos el motivo.
      await supabase.from("invoices").delete().eq("id", data.id).eq("user_id", user.id);
      if (e instanceof ErrorValidacionRegistro) {
        return NextResponse.json(
          {
            error: "verifactu_validacion",
            message: "La factura no supera las validaciones Verifactu",
            detalles: e.errores,
          },
          { status: 422 }
        );
      }
      const message = e instanceof ErrorEmision ? e.message : "Error emitiendo la factura";
      return NextResponse.json({ error: "verifactu_emision", message }, { status: 422 });
    }
  }

  return NextResponse.json({ invoice: data }, { status: 201 });
}
