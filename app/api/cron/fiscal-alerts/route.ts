import { NextResponse } from "next/server";
import { fiscalAlertTemplate } from "@/lib/email/templates";
import { getFiscalAlerts } from "@/lib/tax-calculator";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY no configurado" }, { status: 500 });
  }

  const alerts = getFiscalAlerts().filter((a) => a.daysLeft <= 30);

  if (alerts.length === 0) {
    return NextResponse.json({ message: "No hay alertas pendientes" });
  }

  // In production: query Supabase for users with notif_fiscales=true
  // and send personalized emails via Resend
  // For now: log and return what would be sent

  const results = [];
  for (const alert of alerts) {
    const recipientEmail = "ejemplo@email.com"; // would come from Supabase query
    const template = fiscalAlertTemplate({
      to: recipientEmail,
      nombre: "Autonomo",
      modelo: alert.modelo,
      descripcion: alert.description,
      diasRestantes: alert.daysLeft,
      fechaLimite: alert.dueDate,
    });

    // Send via Resend
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "alertas@kuentas.eu",
          to: recipientEmail,
          subject: template.subject,
          html: template.html,
        }),
      });

      const data = await resp.json();
      results.push({ alert: alert.modelo, status: resp.ok ? "sent" : "failed", data });
    } catch (err) {
      results.push({ alert: alert.modelo, status: "error", error: String(err) });
    }
  }

  return NextResponse.json({ sent: results.length, results });
}
