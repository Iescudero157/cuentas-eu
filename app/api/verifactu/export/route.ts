import { NextResponse } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ErrorExport, exportarObligado } from "@/lib/verifactu/export";
import { limitarTasa, respuesta429 } from "@/lib/verifactu/seguridad-http";

// V16 · Exportación de los registros de facturación del usuario autenticado
// (art. 8 Orden HAC/1177/2024): ZIP con los lotes XML en formato oficial de
// remisión (SuministroLR.xsd), manifiesto con SHA-256 por fichero, LEEME y
// volcado de eventos. Los datos se leen con la sesión del usuario (RLS
// "select own"); el evento de exportación (tipos 08/09 del art. 9 Orden,
// registro interno) se anota vía service_role, best-effort.
//   GET /api/verifactu/export?desde=YYYY-MM-DD&hasta=YYYY-MM-DD

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // V24: el export pagina toda la cadena, genera el ZIP y lo re-verifica
  // entero — trabajo de CPU proporcional al histórico. Límite por usuario.
  const tasa = limitarTasa(`verifactu-export:${user.id}`, 3, 10 * 60 * 1000);
  if (!tasa.permitido) return respuesta429(tasa);

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  try {
    const resultado = await exportarObligado(supabase, user.id, { desde, hasta });

    // Evento interno de exportación (art. 9.1.h-i Orden; VERI*FACTU está
    // exento, se anota como trazabilidad interna). Nunca bloquea la descarga.
    await registrarEventosExport(user.id, {
      desde,
      hasta,
      registros: resultado.manifiesto.registros.total,
      eventos: resultado.manifiesto.eventos?.total ?? 0,
      correlativoDesde: resultado.manifiesto.alcance.correlativoDesde,
      correlativoHasta: resultado.manifiesto.alcance.correlativoHasta,
      sha256Zip: null, // el ZIP incluye el manifiesto con los SHA-256 por fichero
      fichero: resultado.nombreFichero,
      integra: resultado.verificacionZip.integra,
    });

    return new NextResponse(Buffer.from(resultado.zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${resultado.nombreFichero}"`,
        "Cache-Control": "no-store",
        // La descarga se sirve aunque haya anomalías (conservación primero);
        // el manifiesto y esta cabecera dejan constancia del resultado.
        "X-Verifactu-Integra": resultado.verificacionZip.integra ? "true" : "false",
      },
    });
  } catch (e) {
    if (e instanceof ErrorExport) {
      const status =
        e.codigo === "sin_registros" ? 404 :
        e.codigo === "sin_config" ? 409 :
        e.codigo === "fecha_invalida" ? 400 : 500;
      if (status === 500) {
        // V24: los códigos bd_* arrastran el mensaje crudo de Postgres — al
        // cliente solo el código; el detalle, al log de servidor.
        console.error("Error de export Verifactu:", e);
        return NextResponse.json(
          { error: e.codigo, message: "Error interno generando la exportación" },
          { status }
        );
      }
      return NextResponse.json({ error: e.codigo, message: e.message }, { status });
    }
    console.error("Error inesperado de export Verifactu:", e);
    return NextResponse.json(
      { error: "export_error", message: "Error inesperado generando la exportación" },
      { status: 500 }
    );
  }
}

async function registrarEventosExport(
  userId: string,
  datos: Record<string, unknown>
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  try {
    const servicio = createServiceClient(url, serviceKey);
    await servicio.rpc("sif_registrar_evento", {
      p_user_id: userId,
      p_tipo_evento: "export_registros",
      p_datos: datos,
    });
    if ((datos.eventos as number) > 0) {
      await servicio.rpc("sif_registrar_evento", {
        p_user_id: userId,
        p_tipo_evento: "export_eventos",
        p_datos: { fichero: datos.fichero, eventos: datos.eventos },
      });
    }
  } catch {
    // best-effort: la exportación no depende de poder anotar el evento
  }
}
