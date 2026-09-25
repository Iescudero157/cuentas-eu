import { NextResponse } from "next/server";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ErrorCertificado } from "@/lib/verifactu/certificados";
import {
  certificadoActivo,
  ErrorCustodia,
  guardarCertificado,
  retirarCertificado,
} from "@/lib/verifactu/cert-store";
import { clavesDesdeEnv } from "@/lib/verifactu/cert-cifrado";
import { cuerpoExcedeLimite, limitarTasa, respuesta429 } from "@/lib/verifactu/seguridad-http";

// V11 · Gestión del certificado de remisión VERI*FACTU del emisor.
//   GET    → metadatos del certificado activo (nunca material)
//   POST   → subida del PKCS#12 (.p12/.pfx) + contraseña; se valida, se
//            clasifica (obligado/representante/sello), se cifra y se custodia
//   DELETE → retirada (purga el material cifrado; la cola queda acumulando)
//
// La tabla sif_certificados tiene RLS deny-all: TODO acceso pasa por aquí con
// el service_role tras autenticar la sesión del usuario. El material del
// certificado (fichero, claves, contraseña) NUNCA se registra en logs ni se
// devuelve en respuestas.

export const dynamic = "force-dynamic";

// Un PKCS#12 personal ronda 3-10 KB; 256 KB de base64 es un tope holgado que
// corta payloads anómalos antes de tocar el parser.
const MAX_PFX_BASE64 = 256 * 1024;

async function usuarioAutenticado() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

function clienteServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createServiceClient(url, serviceKey);
}

function respuestaError(e: unknown) {
  if (e instanceof ErrorCertificado) {
    return NextResponse.json({ error: e.message, codigo: e.codigo }, { status: 400 });
  }
  if (e instanceof ErrorCustodia) {
    const status = e.codigo === "KEK_NO_CONFIGURADA" ? 503 : e.codigo === "BD" ? 500 : 400;
    if (e.codigo === "BD") {
      // V24: los errores de BD arrastran el mensaje de Postgres sobre la
      // tabla más sensible del sistema — al cliente solo el código.
      console.error("Error de BD en custodia de certificados:", e);
      return NextResponse.json(
        { error: "Error interno gestionando el certificado", codigo: e.codigo },
        { status }
      );
    }
    return NextResponse.json({ error: e.message, codigo: e.codigo }, { status });
  }
  // Nunca volcar el error crudo: podría arrastrar contenido del payload
  return NextResponse.json({ error: "Error interno gestionando el certificado" }, { status: 500 });
}

export async function GET() {
  const user = await usuarioAutenticado();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const servicio = clienteServicio();
  if (!servicio) return NextResponse.json({ error: "Servicio no configurado" }, { status: 500 });

  try {
    const certificado = await certificadoActivo(servicio, user.id);
    return NextResponse.json({
      certificado,
      custodiaConfigurada: clavesDesdeEnv() !== null,
    });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function POST(request: Request) {
  const user = await usuarioAutenticado();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const servicio = clienteServicio();
  if (!servicio) return NextResponse.json({ error: "Servicio no configurado" }, { status: 500 });

  // V24 · El parseo PKCS#12 (node-forge, KDF) es caro y valida contraseñas:
  // sin límite sería un oráculo de fuerza bruta y un vector de agotamiento.
  const tasa = limitarTasa(`certificado:POST:${user.id}`, 5, 15 * 60 * 1000);
  if (!tasa.permitido) return respuesta429(tasa);

  // Rechazo temprano por Content-Length: el tope de MAX_PFX_BASE64 de más
  // abajo se comprueba tras bufferizar el JSON; esto corta antes los cuerpos
  // desproporcionados (margen 2x por el envoltorio JSON).
  if (cuerpoExcedeLimite(request, MAX_PFX_BASE64 * 2)) {
    return NextResponse.json(
      { error: "El fichero es demasiado grande para ser un certificado .p12/.pfx" },
      { status: 413 }
    );
  }

  let body: { pfx_base64?: unknown; passphrase?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const pfxBase64 = typeof body.pfx_base64 === "string" ? body.pfx_base64 : "";
  const passphrase = typeof body.passphrase === "string" ? body.passphrase : "";
  if (!pfxBase64) {
    return NextResponse.json(
      { error: "Falta el fichero del certificado (pfx_base64)" },
      { status: 400 }
    );
  }
  if (pfxBase64.length > MAX_PFX_BASE64) {
    return NextResponse.json(
      { error: "El fichero es demasiado grande para ser un certificado .p12/.pfx" },
      { status: 400 }
    );
  }

  let pfx: Buffer;
  try {
    pfx = Buffer.from(pfxBase64, "base64");
    if (pfx.length === 0) throw new Error("vacío");
  } catch {
    return NextResponse.json({ error: "El fichero no llegó en base64 válido" }, { status: 400 });
  }

  try {
    const certificado = await guardarCertificado(servicio, user.id, pfx, passphrase);
    return NextResponse.json({ certificado }, { status: 201 });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE() {
  const user = await usuarioAutenticado();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const servicio = clienteServicio();
  if (!servicio) return NextResponse.json({ error: "Servicio no configurado" }, { status: 500 });

  try {
    const retirado = await retirarCertificado(servicio, user.id);
    if (!retirado) {
      return NextResponse.json({ error: "No hay certificado activo que retirar" }, { status: 404 });
    }
    return NextResponse.json({ retirado: true });
  } catch (e) {
    return respuestaError(e);
  }
}
