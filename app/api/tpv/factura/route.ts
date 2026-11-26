import { NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { emitirFactura, ErrorEmision } from "@/lib/verifactu/emision";
import { ErrorValidacionRegistro } from "@/lib/verifactu/registro-alta";
import { generateInvoicePDFBuffer } from "@/lib/pdf/invoice-pdf-server";
import { invoicePDFDataFromRow, rectificadaParaPDF } from "@/lib/pdf/invoice-pdf-data";
import { bloqueQRParaInvoice } from "@/lib/verifactu/qr-factura";
import {
  claseFactura,
  filaInvoice,
  marcaPedido,
  NIF_EMPRESA_TPV,
  usuarioFacturador,
  validarPeticion,
  type EmpresaTpv,
} from "@/lib/tpv/factura-tpv";

// Factura VERI*FACTU automática de cada cobro del TPV central (www.ivanescudero.com/tpv), 25-nov-2026.
// La llama el servidor del TPV (factura_lib.php) con el secreto TPV_FACTURAS_SECRET. Emite la factura en la
// cuenta de Kuentas de la empresa que cobró (MILBROTES o MERCADONET: TPV_FACTURAS_USUARIO_*) por el camino de
// siempre (fila en borrador + emitirFactura: numeración de servidor, registro de alta, huella encadenada y cola
// de remisión) y devuelve el PDF con el QR. Un pedido del TPV = una factura: si se repite, devuelve la misma.
// Si el obligado no tiene VERI*FACTU activo, NO emite nada (409) y el TPV lo deja en su cola de reintento.

export const runtime = "nodejs";

function secretoValido(recibido: string | null): boolean {
  const esperado = process.env.TPV_FACTURAS_SECRET ?? "";
  if (esperado.length < 32 || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Cuenta que factura: TPV_FACTURAS_USUARIO_* si está en Vercel; si no, la única cuenta con VERI*FACTU activo y
// el NIF de la empresa (así el alta no exige copiar ids a mano).
async function usuarioDe(supabase: SupabaseClient, empresa: EmpresaTpv): Promise<string | null> {
  const fijado =
    empresa === "milbrotes"
      ? process.env.TPV_FACTURAS_USUARIO_MILBROTES
      : process.env.TPV_FACTURAS_USUARIO_MERCADONET;
  if ((fijado ?? "").trim() !== "") return usuarioFacturador(fijado, []);
  const { data } = await supabase
    .from("sif_config")
    .select("user_id")
    .eq("nif_obligado", NIF_EMPRESA_TPV[empresa])
    .eq("activo", true)
    .limit(2);
  return usuarioFacturador(undefined, data ?? []);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pdfBase64(supabase: SupabaseClient, userId: string, invoice: any): Promise<string> {
  const { data: profile } = await supabase.from("profiles").select("name, nif, address, factura_marca").eq("id", userId).single();
  const verifactu = await bloqueQRParaInvoice(supabase, userId, invoice);
  const rectificada = await rectificadaParaPDF(supabase, userId, invoice);
  const buf = await generateInvoicePDFBuffer(invoicePDFDataFromRow(invoice, profile, verifactu, rectificada));
  return Buffer.from(buf).toString("base64");
}

export async function POST(request: Request) {
  if (!secretoValido(request.headers.get("x-tpv-secret"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "peticion_invalida", message: "Cuerpo JSON inválido" }, { status: 400 });
  }
  const v = validarPeticion(body);
  if (!v.ok) return NextResponse.json({ error: "peticion_invalida", message: v.error }, { status: 400 });
  const p = v.peticion;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = url && serviceKey ? createServiceClient(url, serviceKey, { auth: { persistSession: false } }) : null;
  const userId = supabase ? await usuarioDe(supabase, p.empresa) : null;
  if (!userId || !supabase) {
    return NextResponse.json(
      { error: "empresa_sin_configurar", message: `Falta la cuenta de Kuentas de ${p.empresa} o la clave de servicio` },
      { status: 503 }
    );
  }

  // Un pedido del TPV = una factura (Redsys y Stripe pueden repetir el aviso).
  const { data: previa } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", userId)
    .like("notes", `${marcaPedido(p.pedido)}%`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (previa && previa.verifactu_estado && previa.verifactu_estado !== "borrador") {
    try {
      return NextResponse.json(
        { repetida: true, numero: previa.number, total: previa.total, pdf_base64: await pdfBase64(supabase, userId, previa) },
        { status: 200 }
      );
    } catch (e) {
      console.error("TPV factura: PDF de una factura ya emitida:", e);
      return NextResponse.json({ error: "pdf_error", numero: previa.number }, { status: 500 });
    }
  }
  if (previa) {
    // Borrador huérfano de un intento anterior que no llegó a emitirse: se retira y se vuelve a intentar.
    await supabase.from("invoices").delete().eq("id", previa.id).eq("user_id", userId).eq("verifactu_estado", "borrador");
  }

  const clase = claseFactura(p);
  if ("error" in clase) {
    return NextResponse.json(
      {
        error: clase.error,
        message: "Más de 400 € sin nombre y NIF del cliente: la factura completa se hace a mano con sus datos",
      },
      { status: 422 }
    );
  }

  const { data: fila, error: errInsert } = await supabase
    .from("invoices")
    .insert(filaInvoice(p, userId, clase.clase))
    .select()
    .single();
  if (errInsert || !fila) {
    console.error("TPV factura: error creando la fila:", errInsert);
    return NextResponse.json({ error: "error_creando" }, { status: 500 });
  }

  let resultado;
  try {
    resultado = await emitirFactura(supabase, userId, fila.id);
  } catch (e) {
    await supabase.from("invoices").delete().eq("id", fila.id).eq("user_id", userId);
    if (e instanceof ErrorValidacionRegistro) {
      return NextResponse.json({ error: "verifactu_validacion", detalles: e.errores }, { status: 422 });
    }
    if (e instanceof ErrorEmision) {
      return NextResponse.json({ error: "verifactu_emision", codigo: e.codigo, message: e.message }, { status: 500 });
    }
    console.error("TPV factura: error emitiendo:", e);
    return NextResponse.json({ error: "error_emision" }, { status: 500 });
  }
  if (!resultado.sifActivo) {
    await supabase.from("invoices").delete().eq("id", fila.id).eq("user_id", userId);
    return NextResponse.json({ error: "verifactu_inactivo", message: resultado.motivo }, { status: 409 });
  }

  const { data: emitida } = await supabase.from("invoices").select("*").eq("id", fila.id).single();
  try {
    return NextResponse.json(
      {
        numero: emitida?.number ?? resultado.numeroFiscal,
        clase: clase.clase,
        total: emitida?.total,
        huella: resultado.huella,
        pdf_base64: await pdfBase64(supabase, userId, emitida ?? fila),
      },
      { status: 201 }
    );
  } catch (e) {
    // La factura YA está emitida (no se borra): el TPV volverá a pedirla y recibirá la misma con su PDF.
    console.error("TPV factura: PDF de la factura recién emitida:", e);
    return NextResponse.json({ error: "pdf_error", numero: emitida?.number ?? resultado.numeroFiscal }, { status: 500 });
  }
}
