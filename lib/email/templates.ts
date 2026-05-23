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

// ─────────────────────────────────────────
// INVOICE EMAIL TEMPLATE
// ─────────────────────────────────────────
export interface InvoiceEmailData {
  to: string;
  clientName: string;
  issuerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  iva: number;
  ivaRate: number;
  irpf: number;
  irpfRate: number;
  notes?: string;
}

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

export function invoiceEmailTemplate(data: InvoiceEmailData) {
  const subject = `Factura ${data.invoiceNumber} de ${data.issuerName}`;

  const itemsRows = data.items.map(item => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:8px 0;font-size:14px;color:#444;">${item.description}</td>
      <td style="padding:8px 0;font-size:14px;color:#444;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 0;font-size:14px;color:#444;text-align:right;">${formatEur(item.unitPrice)}</td>
      <td style="padding:8px 0;font-size:14px;color:#444;text-align:right;font-weight:600;">${formatEur(item.total)}</td>
    </tr>`).join("");

  const html = `
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#2A5AAE 0%,#1a3d7e 100%);padding:36px 40px;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;">KUENTAS<span style="color:rgba(255,255,255,.8);">.EU</span></div>
    <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:4px;">Factura adjunta para tu revisión</div>
  </td></tr>
  <tr><td style="padding:36px 40px 28px;">
    <p style="margin:0 0 8px;font-size:15px;color:#444;">Hola <strong>${data.clientName}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.7;">
      Te enviamos la factura <strong>${data.invoiceNumber}</strong> con fecha ${data.invoiceDate}.<br>
      El vencimiento para el pago es el <strong>${data.dueDate}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #2A5AAE;margin-bottom:16px;">
      <thead>
        <tr style="background:#f8f9fb;">
          <th style="padding:10px 0;font-size:12px;color:#888;text-align:left;font-weight:600;text-transform:uppercase;">Concepto</th>
          <th style="padding:10px 0;font-size:12px;color:#888;text-align:center;font-weight:600;text-transform:uppercase;width:50px;">Uds</th>
          <th style="padding:10px 0;font-size:12px;color:#888;text-align:right;font-weight:600;text-transform:uppercase;width:90px;">Precio</th>
          <th style="padding:10px 0;font-size:12px;color:#888;text-align:right;font-weight:600;text-transform:uppercase;width:90px;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      <tr><td style="padding:4px 0;font-size:14px;color:#666;">Subtotal</td><td style="padding:4px 0;font-size:14px;color:#666;text-align:right;">${formatEur(data.subtotal)}</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#666;">IVA (${data.ivaRate}%)</td><td style="padding:4px 0;font-size:14px;color:#666;text-align:right;">${formatEur(data.iva)}</td></tr>
      ${data.irpf > 0 ? `<tr><td style="padding:4px 0;font-size:14px;color:#666;">IRPF (-${data.irpfRate}%)</td><td style="padding:4px 0;font-size:14px;color:#e53e3e;text-align:right;">-${formatEur(data.irpf)}</td></tr>` : ""}
      <tr><td style="padding:12px 0 4px;font-size:18px;color:#1a1a2e;font-weight:700;border-top:2px solid #e0e0e0;">TOTAL</td>
          <td style="padding:12px 0 4px;font-size:18px;color:#2A5AAE;font-weight:700;text-align:right;border-top:2px solid #e0e0e0;">${formatEur(data.total)}</td></tr>
    </table>
    ${data.notes ? `<div style="margin-top:20px;padding:12px 16px;background:#f8f9fb;border-radius:8px;font-size:13px;color:#666;">${data.notes}</div>` : ""}
    <p style="margin-top:24px;font-size:13px;color:#888;line-height:1.6;">
      Para cualquier consulta sobre esta factura, responde a este email o contacta con ${data.issuerName}.
    </p>
  </td></tr>
  <tr><td style="background:#f8f9fb;padding:20px 40px;border-top:1px solid #eee;text-align:center;">
    <p style="margin:0;font-size:12px;color:#bbb;">Factura emitida a través de KUENTAS.EU — La gestoría con IA para autónomos españoles.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { subject, html };
}
