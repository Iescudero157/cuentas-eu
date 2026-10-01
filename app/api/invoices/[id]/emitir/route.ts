import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emitirFactura, ErrorEmision, type OpcionesEmision } from "@/lib/verifactu/emision";
import { ErrorValidacionRegistro } from "@/lib/verifactu/registro-alta";

// Verifactu (V07): emite una factura en BORRADOR (D-02: solo «emitir» genera
// número correlativo + registro de alta + huella + outbox, atómicamente).
// Body opcional: { serie, tipo_factura, operacion_exenta }.
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
  const opciones: OpcionesEmision = {};
  if (typeof body.serie === "string") opciones.serie = body.serie;
  if (typeof body.tipo_factura === "string") opciones.tipoFactura = body.tipo_factura as OpcionesEmision["tipoFactura"];
  if (typeof body.operacion_exenta === "string") opciones.operacionExenta = body.operacion_exenta as OpcionesEmision["operacionExenta"];

  try {
    const resultado = await emitirFactura(supabase, user.id, id, opciones);
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
          message: "La factura no supera las validaciones Verifactu",
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
      { error: "verifactu_emision", message: "Error emitiendo la factura" },
      { status: 500 }
    );
  }
}
