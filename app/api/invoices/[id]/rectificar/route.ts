import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ErrorEmision } from "@/lib/verifactu/emision";
import { emitirRectificativa } from "@/lib/verifactu/rectificacion";
import { ErrorValidacionRegistro } from "@/lib/verifactu/registro-alta";

// Emite la factura rectificativa de una factura EMITIDA (art. 15 RD 1619/2012):
// factura nueva en la serie de rectificativas (R, o RS si rectifica a una
// simplificada), con la referencia a la factura rectificada y su registro de
// alta R1-R5 por diferencias, encadenado y encolado para la AEAT. La factura
// original no se modifica: pasa a «rectificada».
// Body: { modo: "total" | "importe", base_correcta?, motivo, tipo_factura? (R1-R4) }.
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
    const resultado = await emitirRectificativa(supabase, user.id, id, {
      modo: body.modo === "importe" ? "importe" : body.modo === "total" ? "total" : (body.modo as "total"),
      baseCorrecta: body.base_correcta === undefined || body.base_correcta === null || body.base_correcta === ""
        ? undefined
        : Number(body.base_correcta),
      motivo: typeof body.motivo === "string" ? body.motivo : "",
      tipo: typeof body.tipo_factura === "string" ? body.tipo_factura : null,
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
      .eq("id", resultado.invoiceId)
      .single();
    return NextResponse.json({ invoice, verifactu: resultado.emision }, { status: 201 });
  } catch (e) {
    if (e instanceof ErrorValidacionRegistro) {
      return NextResponse.json(
        {
          error: "verifactu_validacion",
          message: "La factura rectificativa no supera las validaciones Verifactu",
          detalles: e.errores,
        },
        { status: 422 }
      );
    }
    if (e instanceof ErrorEmision) {
      const status = e.codigo === "factura_no_encontrada" ? 404 : 422;
      return NextResponse.json({ error: e.codigo, message: e.message }, { status });
    }
    console.error("Error emitiendo rectificativa:", e);
    return NextResponse.json(
      { error: "verifactu_rectificativa", message: "Error emitiendo la factura rectificativa" },
      { status: 500 }
    );
  }
}
