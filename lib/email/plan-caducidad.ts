// Aviso por email de caducidad del plan (8-nov-2026): 7 días antes, el día antes y el día de la caducidad (o
// durante la gracia si ese día no salió). Lo envía /api/cron/plan-caducidad. No hay cargo automático: el
// correo lleva el enlace para renovar el mismo plan desde Ajustes (pago con tarjeta en la pasarela de
// lib/pasarela.ts: Stripe desde el 13-nov-2026; antes, el TPV de BBVA).
import { IMPORTE_CENTIMOS, NOMBRE_PLAN, type Plan } from "@/lib/plan";
import { PASARELA_COBRO } from "@/lib/pasarela";

export interface DatosAvisoCaducidad {
  nombre: string | null;
  plan: Plan;
  caducaEl: Date;
  finGracia: Date;
  /** Días naturales hasta la caducidad (0 = hoy; negativo = ya caducó y está en la gracia). */
  dias: number;
  /** Enlace a Ajustes con el botón de renovar. */
  enlace: string;
}

function fechaLarga(fecha: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

function euros(centimos: number): string {
  return (centimos / 100).toFixed(2).replace(".", ",");
}

function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function avisoCaducidadEmail(d: DatosAvisoCaducidad): { subject: string; html: string; text: string } {
  const plan = NOMBRE_PLAN[d.plan];
  const precio = euros(IMPORTE_CENTIMOS[d.plan] ?? 0);
  const caduca = fechaLarga(d.caducaEl);
  const finGracia = fechaLarga(d.finGracia);

  const subject =
    d.dias > 1
      ? `Tu plan ${plan} de KUENTAS.EU caduca en ${d.dias} días`
      : d.dias === 1
        ? `Tu plan ${plan} de KUENTAS.EU caduca mañana`
        : d.dias === 0
          ? `Tu plan ${plan} de KUENTAS.EU caduca hoy`
          : `Tu plan ${plan} de KUENTAS.EU ha caducado`;

  const cuando =
    d.dias > 1
      ? `caduca dentro de ${d.dias} días, el ${caduca}`
      : d.dias === 1
        ? `caduca mañana, ${caduca}`
        : d.dias === 0
          ? `caduca hoy, ${caduca}`
          : `caducó el ${caduca}`;

  const parrafos = [
    `Hola${d.nombre ? ` ${d.nombre.trim()}` : ""}:`,
    `Tu plan ${plan} de KUENTAS.EU ${cuando}.`,
    `Para seguir con él otro mes, renuévalo pagando ${precio} € (IVA incluido) con tarjeta ${PASARELA_COBRO === "stripe" ? "a través de Stripe" : "en el TPV de BBVA"}. Cada pago cubre un mes y no hay cargos automáticos.`,
    d.dias > 0
      ? `Si no lo renuevas, mantendrás las funciones de pago hasta el ${finGracia} y después tu cuenta pasará al plan Gratis. Tus datos no se borran.`
      : `Si no lo renuevas antes del ${finGracia}, tu cuenta pasará al plan Gratis. Tus datos no se borran.`,
    `Si no quieres renovar, no tienes que hacer nada. Para cualquier duda, escribe a kuentas@mercadonet.es.`,
  ];

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${esc(subject)}</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">
  <div style="background: #2A5AAE; padding: 20px 24px; border-radius: 12px 12px 0 0;">
    <p style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold;">KUENTAS.EU</p>
  </div>
  <div style="background: #ffffff; border: 1px solid #e0e0e0; border-top: none; padding: 28px 24px; border-radius: 0 0 12px 12px;">
    ${parrafos
      .slice(0, 3)
      .map((p) => `<p style="font-size: 15px; line-height: 1.6; margin: 0 0 14px;">${esc(p)}</p>`)
      .join("\n    ")}
    <p style="margin: 22px 0;">
      <a href="${esc(d.enlace)}" style="background: #2A5AAE; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: bold; display: inline-block;">Renovar mi plan ${esc(plan)}</a>
    </p>
    ${parrafos
      .slice(3)
      .map((p) => `<p style="font-size: 14px; line-height: 1.6; margin: 0 0 12px; color: #444;">${esc(p)}</p>`)
      .join("\n    ")}
    <p style="font-size: 12px; color: #888; margin: 22px 0 0;">KUENTAS.EU · MILBROTES, S.L. · Calle Belalcázar, 14, 28006 Madrid</p>
  </div>
</body>
</html>`;

  const text = [
    ...parrafos.slice(0, 3),
    `Renovar mi plan ${plan}: ${d.enlace}`,
    ...parrafos.slice(3),
    "KUENTAS.EU · MILBROTES, S.L.",
  ].join("\n\n");

  return { subject, html, text };
}
