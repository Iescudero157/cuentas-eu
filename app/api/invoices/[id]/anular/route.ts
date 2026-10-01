import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anularFactura, ErrorEmision } from "@/lib/verifactu/emision";
import { ErrorValidacionRegistro } from "@/lib/verifactu/registro-alta";

// Verifactu (V07, D-12): anula una factura EMITIDA generando el registro de
// anulación encadenado (art. 11 RD 1007/2023). Sustituye al DELETE para
// facturas emitidas. Body opcional: { ref_externa }.
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
  const body = await request.json().catch(() => ({}));

  try {
    const resultado = await anularFactura(supabase, user.id, id, {
      refExterna: typeof body.ref_externa === "string" ? body.ref_externa : undefined,
    });
    if (!resultado.sifActivo) {
      return NextResponse.json(
        { error: "sif_inactivo", message: resultado.motivo },
        { status: 409 }
      );
    }
    const { data: invoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .single();
    return NextResponse.json({ invoice, verifactu: resultado });
  } catch (e) {
    if (e instanceof ErrorValidacionRegistro) {
      return NextResponse.json(
        {
          error: "verifactu_validacion",
          message: "El registro de anulación no supera las validaciones",
          detalles: e.errores,
        },
        { status: 422 }
      );
    }
    if (e instanceof ErrorEmision) {
      const status = e.codigo === "factura_no_encontrada" ? 404 : 422;
      return NextResponse.json({ error: e.codigo, message: e.message }, { status });
    }
    return NextResponse.json(
      { error: "verifactu_anulacion", message: "Error anulando la factura" },
      { status: 500 }
    );
  }
}
