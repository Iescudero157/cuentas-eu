import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ErrorEmision } from "@/lib/verifactu/emision";
import { subsanarFactura, reenviarAnulacion } from "@/lib/verifactu/subsanacion";
import { ErrorValidacionRegistro, type Destinatario } from "@/lib/verifactu/registro-alta";

// Verifactu (V12): subsana el registro de una factura tras la respuesta AEAT
// (SPEC §5.4-§5.5): alta AceptadoConErrores → Subsanacion=S; alta Incorrecto →
// Subsanacion=S + RechazoPrevio=S; anulación rechazada → RechazoPrevio=S.
// La factura NO cambia (inmutable tras emisión): se corrige el REGISTRO.
// Body opcional: { destinatario, operacion_exenta, ref_externa }.
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
    // Factura anulada → lo subsanable es su registro de anulación rechazado;
    // en el resto de estados, el registro de alta.
    const { data: invoice } = await supabase
      .from("invoices")
      .select("verifactu_estado")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!invoice) {
      return NextResponse.json({ error: "factura_no_encontrada" }, { status: 404 });
    }

    const resultado =
      invoice.verifactu_estado === "anulada"
        ? await reenviarAnulacion(supabase, user.id, id, {
            refExterna: typeof body.ref_externa === "string" ? body.ref_externa : undefined,
          })
        : await subsanarFactura(supabase, user.id, id, {
            destinatario: esDestinatario(body.destinatario) ? body.destinatario : undefined,
            operacionExenta:
              typeof body.operacion_exenta === "string" && /^E[1-8]$/.test(body.operacion_exenta)
                ? (body.operacion_exenta as "E1")
                : undefined,
          });

    if (!resultado.sifActivo) {
      return NextResponse.json(
        { error: "sif_inactivo", message: resultado.motivo },
        { status: 409 }
      );
    }
    return NextResponse.json({ verifactu: resultado });
  } catch (e) {
    if (e instanceof ErrorValidacionRegistro) {
      return NextResponse.json(
        {
          error: "verifactu_validacion",
          message: "El registro subsanador no supera las validaciones",
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
      { error: "verifactu_subsanacion", message: "Error subsanando el registro" },
      { status: 500 }
    );
  }
}

function esDestinatario(valor: unknown): valor is Destinatario {
  if (typeof valor !== "object" || valor === null) return false;
  const d = valor as Record<string, unknown>;
  return (
    typeof d.nombreRazon === "string" &&
    (typeof d.nif === "string" || (typeof d.idType === "string" && typeof d.id === "string"))
  );
}
