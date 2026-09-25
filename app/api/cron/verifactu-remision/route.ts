import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  certificadoDesdeEnv,
  ClienteAeat,
  type EntornoAeat,
} from "@/lib/verifactu/aeat-cliente";
import { materialRemision } from "@/lib/verifactu/cert-store";
import { clavesDesdeEnv } from "@/lib/verifactu/cert-cifrado";
import { procesarRemision, type ClienteObligado } from "@/lib/verifactu/remision";
import { autorizacionCronValida } from "@/lib/verifactu/seguridad-http";

// V10 · Cron de remisión VERI*FACTU: procesa la cola sif_outbox contra la AEAT
// (art. 16 RRSIF y art. 16 Orden HAC/1177/2024). Programado en vercel.json.
// La cadencia real por obligado la gobierna TiempoEsperaEnvio en SQL: ejecutar
// este cron más a menudo no envía más rápido de lo permitido.
//
// V11 · El cliente se construye POR OBLIGADO con su certificado custodiado
// (sif_certificados, cifrado en reposo) y el entorno de su sif_config; si no
// tiene, se usa el certificado global de plataforma de las variables de
// entorno (diseño V09) y, sin ninguno, su cola simplemente acumula.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Misma autenticación que el resto de crons (Bearer CRON_SECRET),
  // comparación en tiempo constante (V24)
  if (!autorizacionCronValida(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL no configurados" },
      { status: 500 }
    );
  }

  // Sin custodia (VERIFACTU_CERT_KEK_BASE64) NI certificado global de entorno
  // no hay forma de remitir: la cola queda acumulando (Incidencia=S al volver).
  const certGlobal = certificadoDesdeEnv();
  if (!clavesDesdeEnv() && !certGlobal) {
    return NextResponse.json({
      procesado: false,
      motivo:
        "Sin custodia de certificados (VERIFACTU_CERT_KEK_BASE64) ni certificado global: la cola queda acumulando y se remitirá con Incidencia=S",
    });
  }

  const supabase = createClient(url, serviceKey);

  const crearCliente = async (userId: string): Promise<ClienteObligado> => {
    // Entorno AEAT del obligado (pruebas salvo opt-in explícito a producción)
    const { data: config } = await supabase
      .from("sif_config")
      .select("entorno_aeat")
      .eq("user_id", userId)
      .maybeSingle();
    const entorno: EntornoAeat = config?.entorno_aeat === "produccion" ? "produccion" : "pruebas";

    // 1º el certificado custodiado del propio obligado (V11)
    const propio = await materialRemision(supabase, userId);
    if (propio.ok) {
      return new ClienteAeat({
        entorno,
        tipoCertificado: propio.tipoCertificado,
        certificado: propio.certificado,
        urlOverride: process.env.VERIFACTU_URL_OVERRIDE,
      });
    }

    // 2º respaldo: certificado global de plataforma en variables de entorno
    if (certGlobal) {
      return new ClienteAeat({
        entorno,
        tipoCertificado: process.env.VERIFACTU_CERT_TIPO === "sello" ? "sello" : "normal",
        certificado: certGlobal,
        urlOverride: process.env.VERIFACTU_URL_OVERRIDE,
      });
    }

    return { motivo: propio.motivo };
  };

  const resultado = await procesarRemision(supabase, crearCliente);
  return NextResponse.json({ procesado: true, ...resultado });
}
