import { NextResponse } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { certificadoActivo } from "@/lib/verifactu/cert-store";
import { clavesDesdeEnv } from "@/lib/verifactu/cert-cifrado";

// V13 · Resumen del panel Verifactu del usuario autenticado: configuración del
// SIF (sif_config), certificado activo (solo metadatos, vía service_role como
// en /api/verifactu/certificado), estado de la cadena de huellas y contadores
// de registros/cola de remisión. Todo lo demás se lee con la sesión del
// usuario: las tablas sif_* tienen RLS "select own".

export const dynamic = "force-dynamic";

const ESTADOS_REGISTRO = [
  "generated",
  "queued",
  "sending",
  "accepted",
  "accepted_with_errors",
  "rejected",
] as const;

const ESTADOS_OUTBOX = ["pendiente", "en_envio", "error"] as const;

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [config, cadena, registros, outbox, certificado] = await Promise.all([
    supabase
      .from("sif_config")
      .select(
        "nif_obligado, nombre_razon, modalidad, entorno_aeat, activo, fecha_inicio_verifactu, fecha_fin_verifactu"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("sif_cadena")
      .select(
        "correlativo_ultimo, ultima_huella, ultimo_num_serie_factura, ultima_fecha_expedicion, updated_at"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    Promise.all(
      ESTADOS_REGISTRO.map((estado) =>
        supabase
          .from("sif_registros")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("estado_remision", estado)
          .then(({ count }) => [estado, count ?? 0] as const)
      )
    ),
    Promise.all(
      ESTADOS_OUTBOX.map((estado) =>
        supabase
          .from("sif_outbox")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("estado", estado)
          .then(({ count }) => [estado, count ?? 0] as const)
      )
    ),
    obtenerCertificado(user.id),
  ]);

  if (config.error) {
    console.error("Error consultando sif_config:", config.error);
    return NextResponse.json(
      { error: "Error consultando la configuración Verifactu" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    config: config.data ?? null,
    cadena: cadena.data ?? null,
    registros: Object.fromEntries(registros),
    outbox: Object.fromEntries(outbox),
    certificado: certificado.resumen,
    custodiaConfigurada: certificado.custodiaConfigurada,
  });
}

// La tabla sif_certificados tiene RLS deny-all: los metadatos se leen con el
// service_role tras autenticar la sesión, igual que /api/verifactu/certificado.
// Si el servicio no está configurado, el panel sigue funcionando sin ese dato.
async function obtenerCertificado(userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { resumen: null, custodiaConfigurada: clavesDesdeEnv() !== null };
  }
  try {
    const servicio = createServiceClient(url, serviceKey);
    return {
      resumen: await certificadoActivo(servicio, userId),
      custodiaConfigurada: clavesDesdeEnv() !== null,
    };
  } catch {
    return { resumen: null, custodiaConfigurada: clavesDesdeEnv() !== null };
  }
}
