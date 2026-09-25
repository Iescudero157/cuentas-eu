import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cargarConfig } from "@/lib/verifactu/emision";
import {
  construirExportClassicConta,
  zipExportClassicConta,
  ErrorExportCC,
  type FacturaContable,
} from "@/lib/export-contable/classicconta";
import { limitarTasa, respuesta429 } from "@/lib/verifactu/seguridad-http";

// V22 · «Exportar a ClassicConta (AIG)» — plan Business (D3 del plan maestro).
// Genera un ZIP con CC_subcuentas.txt (444 c/registro) y CC_diario.txt
// (869 c/registro) según el Protocolo de Comunicación Conta6 de AIG, más un
// LEEME con las instrucciones de importación en ClassicConta 6/7.
//   GET /api/invoices/export-classicconta?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
//       [&asiento=1][&digitos=9]
//
// Alcance: facturas de venta del usuario en el período (fecha de expedición).
//   · Con Verifactu activo se exportan las emitidas y rectificadas (las
//     anuladas y los borradores no entran en contabilidad).
//   · Sin Verifactu (flujo legacy) se exportan todas las del período, que en
//     ese flujo son las facturas reales del usuario.

export const dynamic = "force-dynamic";

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // V24: genera un ZIP sobre todas las facturas del período — límite por usuario
  const tasa = limitarTasa(`export-cc:${user.id}`, 6, 60 * 60 * 1000);
  if (!tasa.permitido) return respuesta429(tasa);

  // ── Gating de plan: el export contable AIG es una función del plan Business
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  if (profileError) {
    console.error("Error consultando perfil:", profileError);
    return NextResponse.json(
      { error: "perfil_error", message: "Error consultando el perfil" },
      { status: 500 }
    );
  }
  if ((profileData?.plan as string) !== "business") {
    return NextResponse.json(
      {
        error: "plan_requerido",
        message:
          "La exportación a ClassicConta (AIG) está disponible en el plan Business. Mejora tu plan para activarla.",
      },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if ((desde && !RE_FECHA.test(desde)) || (hasta && !RE_FECHA.test(hasta))) {
    return NextResponse.json(
      { error: "fecha_invalida", message: "Las fechas deben tener formato YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (desde && hasta && desde > hasta) {
    return NextResponse.json(
      { error: "fecha_invalida", message: "La fecha inicial es posterior a la final" },
      { status: 400 }
    );
  }
  const asientoInicial = leerEntero(searchParams.get("asiento"), 1);
  const digitos = leerEntero(searchParams.get("digitos"), 9);
  if (asientoInicial === null || digitos === null) {
    return NextResponse.json(
      { error: "parametro_invalido", message: "asiento y digitos deben ser enteros positivos" },
      { status: 400 }
    );
  }

  try {
    // Con el módulo Verifactu activo, solo las facturas con efectos fiscales
    const config = await cargarConfig(supabase, user.id);
    const sifActivo = config?.activo === true;

    let query = supabase
      .from("invoices")
      .select(
        "number, numero_fiscal, date, client_id, client_name, client_nif, client_address, client_email, subtotal, iva, iva_rate, irpf, total, tipo_factura, verifactu_estado"
      )
      .eq("user_id", user.id)
      .neq("verifactu_estado", "anulada")
      .order("date", { ascending: true })
      .order("number", { ascending: true });
    if (sifActivo) query = query.in("verifactu_estado", ["emitida", "rectificada"]);
    if (desde) query = query.gte("date", desde);
    if (hasta) query = query.lte("date", hasta);

    const { data, error } = await query;
    if (error) {
      console.error("Error consultando facturas para export CC:", error);
      return NextResponse.json(
        { error: "facturas_error", message: "Error consultando las facturas" },
        { status: 500 }
      );
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "sin_facturas", message: "No hay facturas exportables en el período seleccionado" },
        { status: 404 }
      );
    }

    const facturas: FacturaContable[] = data.map((f) => ({
      numero: (f.numero_fiscal as string | null) ?? (f.number as string),
      fecha: String(f.date).slice(0, 10),
      clienteNombre: (f.client_name as string) ?? "",
      clienteNif: f.client_nif as string | null,
      clienteDireccion: f.client_address as string | null,
      clienteEmail: f.client_email as string | null,
      clienteId: f.client_id as string | null,
      base: Number(f.subtotal ?? 0),
      cuotaIva: Number(f.iva ?? 0),
      tipoIva: Number(f.iva_rate ?? 0),
      retencionIrpf: Number(f.irpf ?? 0),
      totalFactura: Number(f.total ?? 0),
      rectificativa: typeof f.tipo_factura === "string" && f.tipo_factura.startsWith("R"),
    }));

    const resultado = construirExportClassicConta(facturas, { asientoInicial, digitos });
    const zip = await zipExportClassicConta(resultado);

    const sufijo = [desde?.replace(/-/g, ""), hasta?.replace(/-/g, "")].filter(Boolean).join("-") || "todo";
    return new NextResponse(Buffer.from(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="kuentas-classicconta-${sufijo}.zip"`,
        "Cache-Control": "no-store",
        "X-Asientos": String(resultado.asientos),
        "X-Avisos": String(resultado.avisos.length),
      },
    });
  } catch (e) {
    if (e instanceof ErrorExportCC) {
      const status = e.codigo === "sin_facturas" ? 404 : 422;
      return NextResponse.json({ error: e.codigo, message: e.message }, { status });
    }
    console.error("Error inesperado en export CC:", e);
    return NextResponse.json(
      { error: "export_error", message: "Error inesperado generando la exportación" },
      { status: 500 }
    );
  }
}

function leerEntero(valor: string | null, porDefecto: number): number | null {
  if (valor === null || valor === "") return porDefecto;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}
