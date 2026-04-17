import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// CORS headers for cross-origin requests from kuentas.eu static site
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://kuentas.eu",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, perfil, message } = body;

    // Basic validation
    if (!name || !email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Nombre y email son obligatorios." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const perfilLabel: Record<string, string> = {
      autonomo: "Autónomo",
      creador: "Creador de contenido",
      freelancer: "Freelancer digital",
      otro: "Otro",
    };

    const perfilText = perfilLabel[perfil] || perfil || "No indicado";
    const fecha = new Date().toISOString().slice(0, 19).replace("T", " ");

    // ── 1. Store contact in GitLab repo (contacts.csv) ──────────────────
    await storeContactInGitLab({ fecha, name, email, perfil: perfilText, message: message || "" });

    // ── 2. Send welcome email to the user ───────────────────────────────
    await sendWelcomeEmail({ name, email, perfilText });

    // ── 3. Send notification to Ivan ─────────────────────────────────────
    await sendNotificationEmail({ name, email, perfilText, message: message || "", fecha });

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[contact] Error:", err);
    return NextResponse.json(
      { success: false, error: "Error interno. Inténtalo de nuevo." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// ── Gmail OAuth2 transporter ──────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.GMAIL_USER!,
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN!,
    },
  } as Parameters<typeof nodemailer.createTransport>[0]);
}

// ── Send personalized welcome email to the person who signed up ───────────────
async function sendWelcomeEmail({
  name,
  email,
  perfilText,
}: {
  name: string;
  email: string;
  perfilText: string;
}) {
  const firstName = name.split(" ")[0];

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bienvenido a KUENTAS.EU</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#2A5AAE 0%,#1a3d7e 100%);padding:40px 40px 32px;text-align:center;">
      <div style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">KUENTAS<span style="color:#4ECB71;">.EU</span></div>
      <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Tu gestoría con IA para autónomos</div>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:40px 40px 32px;">
      <h1 style="margin:0 0 16px;font-size:24px;color:#1a1a2e;font-weight:700;">¡Hola, ${firstName}! 👋</h1>
      <p style="margin:0 0 16px;font-size:16px;color:#444;line-height:1.7;">
        Gracias por unirte a la lista de espera de KUENTAS.EU. Ya formas parte de los primeros en conocer la plataforma que va a cambiar cómo los autónomos españoles gestionan su fiscalidad.
      </p>
      <p style="margin:0 0 24px;font-size:16px;color:#444;line-height:1.7;">
        Hemos registrado tu solicitud como <strong>${perfilText}</strong>. En cuanto lancemos la plataforma serás de los primeros en saberlo — y con el <strong>50% de descuento el primer año</strong> que prometemos a quienes están en lista de espera.
      </p>

      <!-- Benefits box -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:24px 28px;">
          <div style="font-size:15px;font-weight:700;color:#2A5AAE;margin-bottom:14px;">Lo que te espera en KUENTAS.EU:</div>
          <table cellpadding="0" cellspacing="0">
            ${[
              ["🏦", "Conexión bancaria automática (Open Banking)"],
              ["🤖", "Categorización de gastos con IA en segundos"],
              ["📊", "Estimación de IRPF e IVA en tiempo real"],
              ["🧾", "Facturas legales con un clic"],
              ["⚠️", "Alertas antes de cada vencimiento fiscal"],
              ["📈", "Dashboard de ingresos y gastos por plataforma"],
            ]
              .map(
                ([icon, text]) =>
                  `<tr><td style="padding:5px 0;font-size:14px;color:#333;"><span style="margin-right:10px;">${icon}</span>${text}</td></tr>`
              )
              .join("")}
          </table>
        </td></tr>
      </table>

      <p style="margin:0 0 28px;font-size:15px;color:#666;line-height:1.7;">
        Mientras tanto, si tienes alguna pregunta o quieres contarnos más sobre tu situación como autónomo, responde directamente a este email. Nos ponemos en contacto contigo en breve.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin-bottom:8px;">
        <a href="https://kuentas.eu" style="display:inline-block;background:#2A5AAE;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:15px;font-weight:700;letter-spacing:0.3px;">Ver más sobre KUENTAS.EU →</a>
      </div>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8f9fb;padding:24px 40px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;color:#999;">KUENTAS.EU · La gestoría con IA para autónomos españoles</p>
      <p style="margin:0;font-size:12px;color:#bbb;">
        Has recibido este email porque te registraste en <a href="https://kuentas.eu" style="color:#2A5AAE;text-decoration:none;">kuentas.eu</a>.
        Si no fuiste tú, puedes ignorar este mensaje.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"KUENTAS.EU" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `¡${firstName}, bienvenido a la lista de espera de KUENTAS.EU! 🎉`,
    html,
  });
}

// ── Send internal notification to Ivan ───────────────────────────────────────
async function sendNotificationEmail({
  name,
  email,
  perfilText,
  message,
  fecha,
}: {
  name: string;
  email: string;
  perfilText: string;
  message: string;
  fecha: string;
}) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"KUENTAS.EU Leads" <${process.env.GMAIL_USER}>`,
    to: "iv.escudero@hotmail.com",
    subject: `[KUENTAS] Nuevo lead: ${name} (${perfilText})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;">
        <h2 style="color:#2A5AAE;">Nuevo registro en lista de espera</h2>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Fecha</td><td style="padding:8px;">${fecha}</td></tr>
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Nombre</td><td style="padding:8px;">${name}</td></tr>
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Email</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Perfil</td><td style="padding:8px;">${perfilText}</td></tr>
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Mensaje</td><td style="padding:8px;">${message || "(ninguno)"}</td></tr>
        </table>
        <p style="margin-top:16px;font-size:13px;color:#666;">
          Ver todos los contactos: <a href="https://gitlab.com/iescudero/kuentas/-/raw/main/data/contacts.csv">contacts.csv en GitLab</a>
        </p>
      </div>
    `,
  });
}

// ── Store contact in GitLab repo as CSV ───────────────────────────────────────
async function storeContactInGitLab({
  fecha,
  name,
  email,
  perfil,
  message,
}: {
  fecha: string;
  name: string;
  email: string;
  perfil: string;
  message: string;
}) {
  const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
  const PROJECT_ID = process.env.GITLAB_PROJECT_ID || "80483754";

  if (!GITLAB_TOKEN) {
    console.warn("[contact] GITLAB_TOKEN not set, skipping CSV storage");
    return;
  }

  // Escape CSV values
  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const newRow = [fecha, name, email, perfil, message, "landing_kuentas.eu"]
    .map(csvEscape)
    .join(",");

  // Get current file content
  const apiBase = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/repository/files`;
  const filePath = encodeURIComponent("data/contacts.csv");

  let currentContent = "Fecha,Nombre,Email,Perfil,Mensaje,Fuente\n";
  let fileExists = false;

  try {
    const getRes = await fetch(`${apiBase}/${filePath}?ref=main`, {
      headers: { "PRIVATE-TOKEN": GITLAB_TOKEN },
    });
    if (getRes.ok) {
      const data = await getRes.json();
      currentContent = Buffer.from(data.content, "base64").toString("utf-8");
      fileExists = true;
    }
  } catch {
    // File doesn't exist yet
  }

  const updatedContent = currentContent.trimEnd() + "\n" + newRow + "\n";
  const base64Content = Buffer.from(updatedContent).toString("base64");

  await fetch(`${apiBase}/${filePath}`, {
    method: fileExists ? "PUT" : "POST",
    headers: {
      "PRIVATE-TOKEN": GITLAB_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      branch: "main",
      content: base64Content,
      encoding: "base64",
      commit_message: `feat: new contact - ${name} (${perfil})`,
    }),
  });
}
