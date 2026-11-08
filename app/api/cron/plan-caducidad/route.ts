import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { autorizacionCronValida } from "@/lib/verifactu/seguridad-http";
import { avisoQueToca, claveAviso, estadoPlan, type TipoAviso } from "@/lib/plan";
import { avisoCaducidadEmail } from "@/lib/email/plan-caducidad";

// Caducidad mensual de los planes (8-nov-2026). Cron diario de vercel.json: avisa por email 7 días antes, el día
// antes y el día de la caducidad (o durante la gracia si ese día no salió), con el enlace para renovar el mismo
// plan. Cada aviso sale una vez por caducidad (profiles.plan_avisos_enviados; se vacía en cada pago).
// Interruptor: KUENTAS_AVISOS_CADUCIDAD=0 en Vercel deja el cron calculando sin enviar («simulado»). Con
// ?simular=1 también simula (para comprobarlo a mano con el CRON_SECRET). Antes de aplicar la migración
// 20261108100000_plan_caducidad_mensual.sql no hay columna de caducidad y no hace nada.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kuentas.eu";
const REMITENTE = "KUENTAS.EU <hola@kuentas.eu>";
const RESPONDER_A = "kuentas@mercadonet.es"; // kuentas.eu no tiene MX: las respuestas van al contacto publicado

function avisosActivos(): boolean {
  return process.env.KUENTAS_AVISOS_CADUCIDAD !== "0";
}

type EstadoAviso = "enviado" | "simulado" | "sin_email" | "error_envio";

export async function GET(request: Request) {
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

  const activos = avisosActivos();
  const simular = !activos || new URL(request.url).searchParams.get("simular") === "1";
  const supabase = createClient(url, serviceKey);

  // select("*"): funciona antes y después de la migración (las columnas nuevas simplemente no vienen).
  const { data, error } = await supabase.from("profiles").select("*").neq("plan", "gratis");
  if (error) {
    console.error("[cron/plan-caducidad] Error leyendo perfiles:", error.message);
    return NextResponse.json({ error: "Error leyendo perfiles" }, { status: 500 });
  }

  const perfiles = (data ?? []) as Record<string, unknown>[];
  const ahora = new Date();
  const avisos: { tipo: TipoAviso; dias: number; estado: EstadoAviso }[] = [];
  let sinCaducidad = 0;
  let resend: Resend | null = null;
  // Sin cuentas de pago no se puede saber si la columna existe: null («sin comprobar»).
  const migracionAplicada = perfiles.length === 0 ? null : perfiles.some((p) => "plan_expires_at" in p);

  for (const p of perfiles) {
    const e = estadoPlan(
      { plan: p.plan as string | null, plan_expires_at: (p.plan_expires_at as string | null | undefined) ?? null },
      ahora
    );
    if (e.situacion === "sin_caducidad") {
      sinCaducidad++;
      continue;
    }
    if ((e.situacion !== "vigente" && e.situacion !== "gracia") || !e.caducaEl || !e.finGracia) continue;
    const dias = e.diasParaCaducar ?? 0;
    const tipo = avisoQueToca(e.diasParaCaducar);
    if (!tipo) continue;

    const clave = claveAviso(tipo, e.caducaEl);
    const yaEnviados = Array.isArray(p.plan_avisos_enviados) ? (p.plan_avisos_enviados as string[]) : [];
    if (yaEnviados.includes(clave)) continue;

    const id = p.id as string;
    let email = (p.email as string | null) ?? null;
    if (!email) {
      const { data: usuario } = await supabase.auth.admin.getUserById(id);
      email = usuario?.user?.email ?? null;
    }
    if (!email) {
      avisos.push({ tipo, dias, estado: "sin_email" });
      continue;
    }

    const correo = avisoCaducidadEmail({
      nombre: (p.name as string | null) ?? null,
      plan: e.contratado,
      caducaEl: e.caducaEl,
      finGracia: e.finGracia,
      dias,
      enlace: `${APP_URL}/dashboard/ajustes?renovar=1`,
    });

    if (simular) {
      avisos.push({ tipo, dias, estado: "simulado" });
      continue;
    }

    resend ??= new Resend(process.env.RESEND_API_KEY ?? "re_missing");
    const { error: errorEnvio } = await resend.emails.send({
      from: REMITENTE,
      to: email,
      replyTo: RESPONDER_A,
      subject: correo.subject,
      html: correo.html,
      text: correo.text,
    });
    if (errorEnvio) {
      console.error(`[cron/plan-caducidad] Resend no envió el aviso ${tipo} de ${id}:`, errorEnvio.message);
      avisos.push({ tipo, dias, estado: "error_envio" });
      continue;
    }

    const { error: errorAnotar } = await supabase
      .from("profiles")
      .update({ plan_avisos_enviados: [...yaEnviados, clave] })
      .eq("id", id);
    if (errorAnotar) {
      console.error(`[cron/plan-caducidad] Aviso ${tipo} de ${id} enviado pero sin anotar:`, errorAnotar.message);
    }
    avisos.push({ tipo, dias, estado: "enviado" });
  }

  return NextResponse.json({
    activos,
    simulado: simular,
    migracion_aplicada: migracionAplicada,
    cuentas_de_pago: perfiles.length,
    sin_caducidad: sinCaducidad,
    enviados: avisos.filter((a) => a.estado === "enviado").length,
    avisos,
  });
}
