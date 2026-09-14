import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInvoicePDFBuffer } from "@/lib/pdf/invoice-pdf-server";
import { invoicePDFDataFromRow } from "@/lib/pdf/invoice-pdf-data";
import { bloqueQRParaInvoice } from "@/lib/verifactu/qr-factura";
import { ErrorQR } from "@/lib/verifactu/qr";

// V08 (D-08): descarga del PDF de factura generado en SERVIDOR, única fuente
// de verdad para facturas emitidas bajo Verifactu — incluye el QR tributario
// y la leyenda VERI*FACTU obligatorios (arts. 20-21 Orden HAC/1177/2024).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, nif, address")
    .eq("id", user.id)
    .single();

  try {
    const verifactu = await bloqueQRParaInvoice(supabase, user.id, invoice);
    const pdfBuffer = await generateInvoicePDFBuffer(
      invoicePDFDataFromRow(invoice, profile, verifactu)
    );
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(invoice.number)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof ErrorQR) {
      // Registro de alta con datos no conformes: anomalía de integridad que
      // no debe ocultarse generando un PDF sin QR (factura emitida SIN QR
      // incumpliría el art. 20 de la Orden).
      return NextResponse.json(
        { error: "qr_invalido", message: err.message, detalles: err.errores },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "pdf_error", message: err instanceof Error ? err.message : "Error generando el PDF" },
      { status: 500 }
    );
  }
}
