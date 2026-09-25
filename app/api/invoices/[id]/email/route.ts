import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { invoiceEmailTemplate } from "@/lib/email/templates";
import { generateInvoicePDFBuffer } from "@/lib/pdf/invoice-pdf-server";
import { invoicePDFDataFromRow } from "@/lib/pdf/invoice-pdf-data";
import { bloqueQRParaInvoice } from "@/lib/verifactu/qr-factura";
import { limitarTasa, respuesta429 } from "@/lib/verifactu/seguridad-http";

// Lazy-initialize so build doesn't fail when RESEND_API_KEY is absent
function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "re_missing");
}

// V24 · Este endpoint envía correo desde el dominio propio (hola@kuentas.eu,
// SPF/DKIM válidos): sin restricciones sería un relay de phishing autenticado.
// Por eso: destinatario SOLO el email del cliente de la factura o el del
// propio emisor, mensaje personalizado acotado y escapado en la plantilla,
// y límite de envíos por usuario.
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_MENSAJE = 1000;
const ENVIOS_MAX = 20; // por usuario y hora (por instancia; ver SEGURIDAD.md)
const ENVIOS_VENTANA_MS = 60 * 60 * 1000;

function nombreRemitenteSeguro(nombre: string): string {
  // El display name va dentro de la cabecera From: fuera saltos de línea,
  // comillas y <> para que nadie inyecte cabeceras o direcciones extra.
  return nombre.replace(/[\r\n<>"]/g, "").trim().slice(0, 80) || "KUENTAS.EU";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tasa = limitarTasa(`invoice-email:${user.id}`, ENVIOS_MAX, ENVIOS_VENTANA_MS);
  if (!tasa.permitido) return respuesta429(tasa);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  const customMessage =
    typeof body?.customMessage === "string" ? body.customMessage.slice(0, MAX_MENSAJE) : undefined;

  // Get invoice
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  // Get issuer profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, nif, email, address")
    .eq("id", user.id)
    .single();

  // Destinatarios legítimos: el cliente de ESTA factura o el propio emisor
  // (copia para sí). Nada de destinatarios arbitrarios.
  const permitidos = new Set(
    [invoice.client_email, profile?.email, user.email]
      .filter((e): e is string => typeof e === "string" && e !== "")
      .map((e) => e.toLowerCase())
  );
  const recipientEmail = to || invoice.client_email;
  if (!recipientEmail || !RE_EMAIL.test(recipientEmail)) {
    return NextResponse.json({ error: "No hay email del cliente válido" }, { status: 400 });
  }
  if (!permitidos.has(recipientEmail.toLowerCase())) {
    return NextResponse.json(
      { error: "El destinatario debe ser el email del cliente de la factura o el del emisor" },
      { status: 400 }
    );
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const emailData = {
    to: recipientEmail,
    clientName: invoice.client_name,
    issuerName: profile?.name || "KUENTAS.EU",
    invoiceNumber: invoice.number,
    invoiceDate: formatDate(invoice.date),
    dueDate: formatDate(invoice.due_date || invoice.date),
    total: Number(invoice.total),
    items: invoice.items || [],
    subtotal: Number(invoice.subtotal),
    iva: Number(invoice.iva),
    ivaRate: Number(invoice.iva_rate),
    irpf: Number(invoice.irpf),
    irpfRate: Number(invoice.irpf_rate),
    notes: customMessage,
  };

  const { subject, html } = invoiceEmailTemplate(emailData);

  // Generate PDF attachment (con QR tributario + leyenda si la factura está
  // emitida bajo Verifactu — V08, arts. 20-21 Orden HAC/1177/2024)
  let pdfBuffer: Buffer | null = null;
  try {
    const verifactu = await bloqueQRParaInvoice(supabase, user.id, invoice);
    pdfBuffer = await generateInvoicePDFBuffer(
      invoicePDFDataFromRow(invoice, profile, verifactu)
    );
  } catch (pdfErr) {
    console.error("Error generando PDF:", pdfErr);
    if (invoice.verifactu_estado && invoice.verifactu_estado !== "borrador") {
      // Una factura emitida NO puede enviarse sin su QR (art. 20 Orden):
      // mejor fallar el envío que entregar un duplicado no conforme.
      return NextResponse.json(
        { error: "No se pudo generar el PDF con el QR tributario de la factura emitida" },
        { status: 500 }
      );
    }
    // Facturas legacy/borrador: continue sending email without attachment
  }

  try {
    const resend = getResend();
    const { error: emailError } = await resend.emails.send({
      from: `${nombreRemitenteSeguro(profile?.name || "KUENTAS.EU")} <hola@kuentas.eu>`,
      to: [recipientEmail],
      subject,
      html,
      ...(pdfBuffer
        ? {
            attachments: [
              {
                filename: `${invoice.number}.pdf`,
                content: pdfBuffer,
              },
            ],
          }
        : {}),
    });

    if (emailError) {
      console.error("Error de Resend enviando factura:", emailError);
      return NextResponse.json({ error: "No se pudo enviar el email" }, { status: 500 });
    }

    // Mark invoice as sent (update timestamp)
    await supabase
      .from("invoices")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, sentTo: recipientEmail });
  } catch (err) {
    console.error("Error enviando email de factura:", err);
    return NextResponse.json({ error: "Error enviando email" }, { status: 500 });
  }
}
