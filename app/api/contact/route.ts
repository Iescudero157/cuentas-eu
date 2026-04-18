import { NextRequest, NextResponse } from "next/server";

// CORS – allow kuentas.eu static site AND the Vercel app itself
const ALLOWED_ORIGINS = [
  "https://kuentas.eu",
  "https://www.kuentas.eu",
  "https://cuentas-eu.vercel.app",
  "https://app.kuentas.eu",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  try {
    const body = await req.json();
    const {
      name, email, perfil, message,
      tipo,       // "profesional" | "empresa" | "lista" (waitlist)
      empresa, cif, telefono, sector,
    } = body;

    if (!name || !email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Nombre y email son obligatorios." },
        { status: 400, headers: cors }
      );
    }

    const tipoLabel: Record<string, string> = {
      profesional: "Registro Profesional",
      empresa: "Registro Empresa",
      lista: "Lista de espera",
    };

    const perfilLabel: Record<string, string> = {
      autonomo: "Autónomo",
      creador: "Creador de contenido",
      freelancer: "Freelancer digital",
      otro: "Otro",
    };

    const tipoText  = tipoLabel[tipo] ?? "Lista de espera";
    const perfilText = perfilLabel[perfil] || sector || perfil || "No indicado";
    const fecha = new Date().toISOString().slice(0, 19).replace("T", " ");

    // ── Get Gmail access token once, reuse for both emails ──────────────
    const accessToken = await getGmailAccessToken();

    // ── 1. Store in Google Sheets (non-fatal) ────────────────────────────
    try {
      await storeInGoogleSheets({
        fecha, name, email,
        tipo: tipoText,
        perfil: perfilText,
        empresa: empresa || "",
        cif: cif || "",
        telefono: telefono || "",
        message: message || "",
      });
    } catch (sheetsErr) {
      console.warn("[contact] Sheets storage failed (non-fatal):", sheetsErr);
    }

    // ── 2. Welcome email to user ─────────────────────────────────────────
    await sendWelcomeEmail({ name, email, tipo: tipo ?? "lista", perfilText, empresa, accessToken });

    // ── 3. Notification to Ivan ──────────────────────────────────────────
    await sendNotificationEmail({ name, email, tipoText, perfilText, empresa, cif, telefono, message: message || "", fecha, accessToken });

    return NextResponse.json({ success: true }, { headers: cors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[contact] Error:", err);
    return NextResponse.json(
      { success: false, error: "Error interno. Inténtalo de nuevo.", _debug: msg },
      { status: 500, headers: cors }
    );
  }
}

// ── Gmail OAuth2 access token ─────────────────────────────────────────────────
async function getGmailAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`OAuth2 token error: ${JSON.stringify(json)}`);
  }
  return json.access_token as string;
}

// ── Send email via Gmail REST API ─────────────────────────────────────────────
async function sendGmailMessage({
  accessToken, from, to, subject, html,
}: {
  accessToken: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  // Build RFC 2822 message
  const boundary = "kuentas_boundary_" + Math.random().toString(36).slice(2);
  const subjectEncoded = "=?UTF-8?B?" + Buffer.from(subject).toString("base64") + "?=";
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(html, "utf-8").toString("base64"),
    `--${boundary}--`,
  ].join("\r\n");

  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail API error ${res.status}: ${err}`);
  }
}

// ── Google Sheets storage ─────────────────────────────────────────────────────
async function storeInGoogleSheets(row: {
  fecha: string; name: string; email: string; tipo: string;
  perfil: string; empresa: string; cif: string; telefono: string; message: string;
}) {
  const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
  const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

  if (!SHEETS_ID || !REFRESH_TOKEN) {
    console.warn("[contact] Google Sheets not configured");
    return;
  }

  // Get access token via refresh
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
    }),
  });
  const { access_token } = await tokenRes.json();

  // Append row to the sheet
  const values = [
    row.fecha, row.name, row.email, row.tipo,
    row.perfil, row.empresa, row.cif, row.telefono,
    row.message, "kuentas.eu",
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/Contactos!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [values] }),
    }
  );
}

// ── Welcome email ─────────────────────────────────────────────────────────────
async function sendWelcomeEmail({
  name, email, tipo, perfilText, empresa, accessToken,
}: {
  name: string; email: string; tipo: string; perfilText: string; empresa?: string; accessToken: string;
}) {
  const firstName = name.split(" ")[0];
  const GMAIL_USER = process.env.GMAIL_USER!;

  const isProfesional = tipo === "profesional";
  const isEmpresa = tipo === "empresa";

  const subject = isEmpresa
    ? `¡Bienvenido a KUENTAS.EU, ${empresa || firstName}! Cuenta empresa creada`
    : `¡${firstName}, bienvenido a KUENTAS.EU! 🎉`;

  const intro = isEmpresa
    ? `Hemos registrado la solicitud de cuenta empresa para <strong>${empresa || name}</strong>. En breve nos ponemos en contacto para configurar vuestro acceso.`
    : isProfesional
    ? `Tu cuenta profesional está en proceso. En breve recibirás los datos de acceso para empezar a gestionar tus finanzas.`
    : `Gracias por unirte a la lista de espera. Serás de los primeros en acceder — y con el <strong>50% de descuento el primer año</strong>.`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#2A5AAE 0%,#1a3d7e 100%);padding:36px 40px;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;">KUENTAS<span style="color:#4ECB71;">.EU</span></div>
    <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:4px;">Tu gestoría con IA para autónomos</div>
  </td></tr>
  <tr><td style="padding:36px 40px 28px;">
    <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a2e;font-weight:700;">¡Hola, ${firstName}! 👋</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">${intro}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-radius:12px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:14px;font-weight:700;color:#2A5AAE;margin-bottom:12px;">Lo que te espera en KUENTAS.EU:</div>
        ${["🏦 Conexión bancaria automática","🤖 IA que categoriza tus gastos","📊 IRPF e IVA en tiempo real","🧾 Facturas legales en 1 clic","⚠️ Alertas antes de cada vencimiento"]
          .map(t => `<div style="font-size:13px;color:#333;padding:3px 0;">${t}</div>`).join("")}
      </td></tr>
    </table>
    <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.7;">
      Si tienes alguna pregunta, responde directamente a este email. Te atendemos en breve.
    </p>
    <div style="text-align:center;">
      <a href="https://kuentas.eu" style="display:inline-block;background:#2A5AAE;color:#fff;text-decoration:none;padding:13px 32px;border-radius:50px;font-size:14px;font-weight:700;">Ver KUENTAS.EU →</a>
    </div>
  </td></tr>
  <tr><td style="background:#f8f9fb;padding:20px 40px;border-top:1px solid #eee;text-align:center;">
    <p style="margin:0;font-size:12px;color:#bbb;">KUENTAS.EU · La gestoría con IA para autónomos españoles<br>
    Has recibido este email porque te registraste en <a href="https://kuentas.eu" style="color:#2A5AAE;">kuentas.eu</a>.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  await sendGmailMessage({
    accessToken,
    from: `"KUENTAS.EU" <${GMAIL_USER}>`,
    to: email,
    subject,
    html,
  });
}

// ── Notification to Ivan ──────────────────────────────────────────────────────
async function sendNotificationEmail(data: {
  name: string; email: string; tipoText: string; perfilText: string;
  empresa?: string; cif?: string; telefono?: string; message?: string; fecha: string;
  accessToken: string;
}) {
  const GMAIL_USER = process.env.GMAIL_USER!;
  const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;

  const rows = [
    ["Fecha", data.fecha], ["Tipo", data.tipoText], ["Nombre", data.name],
    ["Email", data.email], ["Perfil/Sector", data.perfilText],
    ...(data.empresa ? [["Empresa", data.empresa]] : []),
    ...(data.cif ? [["CIF", data.cif]] : []),
    ...(data.telefono ? [["Teléfono", data.telefono]] : []),
    ...(data.message ? [["Mensaje", data.message]] : []),
  ];

  const html = `
<div style="font-family:Arial,sans-serif;max-width:520px;">
  <h2 style="color:#2A5AAE;">Nuevo registro: ${data.tipoText}</h2>
  <table style="border-collapse:collapse;width:100%;">
    ${rows.map(([k,v]) => `<tr><td style="padding:7px 10px;background:#f5f5f5;font-weight:bold;font-size:13px;width:120px;">${k}</td>
      <td style="padding:7px 10px;font-size:13px;">${k==="Email" ? `<a href="mailto:${v}">${v}</a>` : v}</td></tr>`).join("")}
  </table>
  ${SHEETS_ID ? `<p style="margin-top:16px;font-size:12px;color:#666;">
    Ver todos los registros: <a href="https://docs.google.com/spreadsheets/d/${SHEETS_ID}">Google Sheets (Drive Kuentas)</a>
  </p>` : ""}
</div>`;

  await sendGmailMessage({
    accessToken: data.accessToken,
    from: `"KUENTAS.EU Leads" <${GMAIL_USER}>`,
    to: "iv.escudero@hotmail.com",
    subject: `[KUENTAS] ${data.tipoText}: ${data.name}${data.empresa ? ` (${data.empresa})` : ""}`,
    html,
  });
}
