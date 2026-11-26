import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emitirFactura, ErrorEmision } from "@/lib/verifactu/emision";
import { ErrorValidacionRegistro } from "@/lib/verifactu/registro-alta";
import { normalizarNif, situacionNifCliente, validarExencion } from "@/lib/verifactu/factura-fiscal";
import { planEfectivo } from "@/lib/plan";
import { anioDeFecha, fechaHoyEspana, siguienteNumeroFactura, validarFechaOperacion } from "@/lib/invoices/numeracion";

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
  // El número que mande el navegador se ignora: lo asigna el servidor (R1, ver más abajo).
  const {
    client_name, client_nif, client_address,
    items, subtotal, iva, iva_rate, irpf, irpf_rate, total,
    date, due_date, status,
    client_id, client_email, payment_method, payment_date, notes,
  } = body;

  if (!client_name || !date) {
    return NextResponse.json({ error: "Campos obligatorios: client_name, date" }, { status: 400 });
  }
  const anio = anioDeFecha(date);
  if (anio === null) {
    return NextResponse.json({ error: "La fecha de la factura no es válida (aaaa-mm-dd)" }, { status: 400 });
  }
  // Fecha de la operación (art. 6.1.k RD 1619/2012): solo si es distinta de la de la factura.
  const fechaOperacion = validarFechaOperacion(date, body.fecha_operacion, fechaHoyEspana());
  if (!fechaOperacion.ok) {
    return NextResponse.json({ error: "fecha_operacion_invalida", message: fechaOperacion.error }, { status: 422 });
  }
  if (items !== undefined && (!Array.isArray(items) || items.length > 500)) {
    return NextResponse.json(
      { error: "items debe ser una lista de como máximo 500 líneas" },
      { status: 400 }
    );
  }

  // Operación exenta: con IVA al 0 % la causa de exención es obligatoria y se
  // guarda con la factura (mención del art. 6.1.j RD 1619/2012 en el PDF y
  // OperacionExenta en el registro VERI*FACTU). El 0 % sin causa se rechaza.
  const exencion = validarExencion(Number(iva_rate ?? 21), body.operacion_exenta, body.exencion_detalle);
  if (!exencion.ok) {
    return NextResponse.json(
      { error: "exencion_invalida", message: exencion.error },
      { status: 422 }
    );
  }
  // El NIF español válido se guarda en su forma canónica (sin espacios ni guiones).
  const nifCliente =
    situacionNifCliente(client_nif) === "valido" ? normalizarNif(client_nif) : client_nif;

  // ── Plan limit: gratis users can create max 5 invoices/month ──────────────
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Plan efectivo: Gratis si el plan de pago caducó hace más de 7 días (caducidad mensual, lib/plan.ts).
  const userPlan = planEfectivo(profileData);

  if (userPlan === "gratis") {
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    // Las rectificativas no consumen cupo: corregir una factura emitida es una
    // obligación legal (art. 15 RD 1619/2012), no una venta nueva.
    const { count } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("rectifica_invoice_id", null)
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

  // R1 (26-nov-2026): número correlativo por usuario en la serie FACT-<año de la factura>, siguiente al mayor
  // usado ese año. Antes lo ponía el navegador con el año 2026 fijo y se repetía entre dispositivos. Con
  // VERI*FACTU activo, la emisión de abajo lo sustituye por el número fiscal de su serie.
  const { data: usados, error: errorUsados } = await supabase
    .from("invoices")
    .select("number")
    .eq("user_id", user.id)
    .like("number", `FACT-${anio}-%`);
  if (errorUsados) {
    console.error("Error leyendo la numeración:", errorUsados);
    return NextResponse.json({ error: "No se pudo asignar el número de la factura" }, { status: 500 });
  }
  const number = siguienteNumeroFactura(anio, (usados ?? []).map((r: { number: string | null }) => r.number));

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      number,
      client_name,
      client_nif: nifCliente,
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
      // Solo viajan si la factura es exenta: así la creación de facturas con
      // IVA no depende de que la migración 20261120100000 esté ya aplicada.
      ...(exencion.operacion_exenta
        ? { operacion_exenta: exencion.operacion_exenta, exencion_detalle: exencion.exencion_detalle }
        : {}),
      // Solo viaja si la hay: crear facturas no depende de que la migración 20261126100000 esté aplicada.
      ...(fechaOperacion.valor ? { fecha_operacion: fechaOperacion.valor } : {}),
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
      return NextResponse.json(
        { error: e instanceof ErrorEmision ? e.codigo : "verifactu_emision", message },
        { status: 422 }
      );
    }
  }

  return NextResponse.json({ invoice: data }, { status: 201 });
}
