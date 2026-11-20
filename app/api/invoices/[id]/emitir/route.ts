import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emitirFactura, ErrorEmision, type OpcionesEmision } from "@/lib/verifactu/emision";
import { ErrorValidacionRegistro } from "@/lib/verifactu/registro-alta";
import { validarExencion } from "@/lib/verifactu/factura-fiscal";

// Verifactu (V07): emite una factura en BORRADOR (D-02: solo «emitir» genera
// número correlativo + registro de alta + huella + outbox, atómicamente).
// Body opcional: { serie, tipo_factura, operacion_exenta, exencion_detalle }.
// La causa de exención no viaja como opción suelta: se guarda en el borrador
// antes de emitir, para que la factura impresa y su registro lleven la misma
// (la base de datos rechaza la emisión si no coinciden).
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

  if (typeof body.operacion_exenta === "string" && body.operacion_exenta !== "") {
    const { data: borrador } = await supabase
      .from("invoices")
      .select("iva_rate, verifactu_estado")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!borrador) {
      return NextResponse.json({ error: "factura_no_encontrada", message: "Factura no encontrada" }, { status: 404 });
    }
    if (borrador.verifactu_estado === "borrador") {
      const exencion = validarExencion(Number(borrador.iva_rate), body.operacion_exenta, body.exencion_detalle);
      if (!exencion.ok) {
        return NextResponse.json({ error: "exencion_invalida", message: exencion.error }, { status: 422 });
      }
      const { error: errGuardar } = await supabase
        .from("invoices")
        .update({
          operacion_exenta: exencion.operacion_exenta,
          exencion_detalle: exencion.exencion_detalle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id);
      if (errGuardar) {
        console.error("Error guardando la causa de exención:", errGuardar);
        return NextResponse.json(
          { error: "exencion_error", message: "No se pudo guardar la causa de exención" },
          { status: 500 }
        );
      }
    }
  }

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
