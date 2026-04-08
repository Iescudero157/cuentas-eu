export interface FiscalAlertEmail {
  to: string;
  nombre: string;
  modelo: string;
  descripcion: string;
  diasRestantes: number;
  fechaLimite: string;
}

export function fiscalAlertTemplate(data: FiscalAlertEmail) {
  const urgente = data.diasRestantes <= 7;
  const color = urgente ? "#ef4444" : "#f59e0b";
  const emoji = urgente ? "URGENTE" : "Recordatorio";

  const subject = `[${emoji}] ${data.modelo} vence en ${data.diasRestantes} dias - KUENTAS.EU`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">
  <div style="background: #2A5AAE; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">KUENTAS.EU</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Alerta fiscal automatica</p>
  </div>

  <div style="background: white; border: 1px solid #e0e0e0; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px;">Hola ${data.nombre},</p>

    <div style="background: ${color}15; border-left: 4px solid ${color}; padding: 16px; border-radius: 4px; margin: 24px 0;">
      <p style="margin: 0; font-weight: bold; color: ${color}; font-size: 18px;">
        ${data.modelo}
      </p>
      <p style="margin: 8px 0 0; color: #444;">
        ${data.descripcion}
      </p>
      <p style="margin: 8px 0 0; font-size: 22px; font-weight: bold; color: #1a1a2e;">
        Vence en <span style="color: ${color};">${data.diasRestantes} dias</span>
      </p>
      <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Fecha limite: ${data.fechaLimite}</p>
    </div>

    <p style="color: #444; line-height: 1.6;">
      Entra en KUENTAS.EU para revisar tus calculos y preparar la presentacion antes del plazo.
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="https://app.cuentas.eu/dashboard"
         style="background: #2A5AAE; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
        Ver mi dashboard
      </a>
    </div>

    <p style="color: #999; font-size: 12px; border-top: 1px solid #e0e0e0; padding-top: 16px; margin-top: 32px;">
      Recibes este email porque tienes activadas las alertas fiscales en KUENTAS.EU.<br>
      Para desactivarlas, accede a Ajustes > Notificaciones.
    </p>
  </div>
</body>
</html>`;

  return { subject, html };
}
