import { NextResponse } from "next/server";
import { getFiscalAlerts } from "@/lib/tax-calculator";
import { autorizacionCronValida } from "@/lib/verifactu/seguridad-http";

export async function GET(request: Request) {
  // Verify cron secret. V24: fail-closed si CRON_SECRET no está definido
  // (antes `Bearer undefined` pasaba el control) y comparación timing-safe.
  if (!autorizacionCronValida(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const alerts = getFiscalAlerts().filter((a) => a.daysLeft <= 30);

  // Los avisos por email a cada usuario no están implementados (las preferencias
  // de notificación de Ajustes solo se guardan en el navegador). Hasta entonces el
  // cron no envía nada: antes mandaba cada aviso a «ejemplo@email.com», una
  // dirección de un tercero. Devuelve los plazos próximos para el registro del cron.
  return NextResponse.json({
    enviados: 0,
    alertas: alerts.map((a) => ({ modelo: a.modelo, descripcion: a.description, fecha: a.dueDate, dias: a.daysLeft })),
  });
}
