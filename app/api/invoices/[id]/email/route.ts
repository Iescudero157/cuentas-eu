import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { invoiceEmailTemplate } from "@/lib/email/templates";

// Lazy-initialize so build doesn't fail when RESEND_API_KEY is absent
function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "re_missing");
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

  const { id } = await params;
  const body = await request.json();
  const { to, customMessage } = body;

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

  const recipientEmail = to || invoice.client_email;
  if (!recipientEmail) {
    return NextResponse.json({ error: "No hay email del cliente" }, { status: 400 });
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

  try {
    const resend = getResend();
    const { error: emailError } = await resend.emails.send({
      from: `${profile?.name || "KUENTAS.EU"} <hola@kuentas.eu>`,
      to: [recipientEmail],
      subject,
      html,
    });

    if (emailError) {
      return NextResponse.json({ error: emailError.message }, { status: 500 });
    }

    // Mark invoice as sent (update notes)
    await supabase
      .from("invoices")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, sentTo: recipientEmail });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error enviando email" },
      { status: 500 }
    );
  }
}
