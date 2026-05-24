import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30; // OCR can take a few seconds

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // ── Plan check: OCR requires Autónomo plan or higher ─────────────────────
  const ADMIN_EMAILS = ["iv.escudero.s@gmail.com", "iv.escudero@hotmail.com"];
  const isAdmin = ADMIN_EMAILS.includes(user.email ?? "");

  if (!isAdmin) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = (profileData?.plan as string) ?? "gratis";
    const paidPlans = ["autonomo", "creator", "business"];

    if (!paidPlans.includes(plan)) {
      return NextResponse.json({
        error: "plan_required",
        message: "El escaneo OCR con IA está disponible desde el plan Autónomo. Mejora tu plan para usar esta función.",
      }, { status: 402 });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formato de solicitud inválido" }, { status: 400 });
  }

  const imageFile = formData.get("image") as File | null;
  if (!imageFile) {
    return NextResponse.json({ error: "Se requiere una imagen (campo 'image')" }, { status: 400 });
  }

  const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
  if (imageFile.size > maxSizeBytes) {
    return NextResponse.json({ error: "La imagen no puede superar los 10 MB" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
  const mimeType = imageFile.type || "image/jpeg";
  if (!allowedTypes.includes(mimeType) && !mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "Formato de imagen no soportado. Usa JPEG, PNG o WEBP." }, { status: 400 });
  }

  // Convert to base64
  const buffer = await imageFile.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  // Create a scan job record
  const { data: scanJob, error: jobError } = await supabase
    .from("scan_jobs")
    .insert({ user_id: user.id, status: "processing" })
    .select("id")
    .single();

  if (jobError || !scanJob) {
    // scan_jobs table may not exist yet (migration not run) — proceed without DB tracking
    console.error("scan_jobs insert error:", jobError?.message);
  }

  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    if (scanJob) {
      await supabase
        .from("scan_jobs")
        .update({ status: "error", error_message: "OPENAI_API_KEY no configurada" })
        .eq("id", scanJob.id);
    }
    return NextResponse.json(
      { error: "El análisis OCR no está disponible. Configura OPENAI_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content: `Eres un asistente contable para autónomos españoles. Analiza la imagen de una factura, ticket de compra o recibo y extrae los datos en JSON.

Devuelve SOLO JSON válido con esta estructura exacta (sin texto adicional, sin código markdown):
{
  "date": "YYYY-MM-DD",
  "vendor": "nombre del proveedor o emisor",
  "description": "descripción breve del concepto o servicio",
  "subtotal": 0.00,
  "iva_rate": 21,
  "iva_amount": 0.00,
  "total": 0.00,
  "type": "gasto",
  "category": "otros",
  "deductible": true,
  "confidence": 0.95,
  "notes": ""
}

Reglas importantes:
- type: "gasto" para tickets/facturas de compra (lo más habitual), "ingreso" si es una factura emitida por el autónomo a un cliente
- iva_rate: usa 0, 4, 10 o 21 (los tipos de IVA españoles válidos)
- category: elige entre: software, hardware, coworking, transporte, comida, marketing, telefono, formacion, seguros, material, servicios, otros
- date: convierte al formato YYYY-MM-DD si está en otro formato (DD/MM/YYYY, etc.)
- Si un campo no es legible o no aparece, usa null para números y "" para texto
- confidence: entre 0.0 y 1.0, refleja la legibilidad general del documento
- deductible: true si el gasto es deducible como gasto de actividad profesional en España`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                  detail: "high",
                },
              },
              {
                type: "text",
                text: "Extrae los datos contables de este documento.",
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(
        errData?.error?.message || `OpenAI respondió con estado ${resp.status}`
      );
    }

    const aiData = await resp.json();
    const rawText: string = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON — handle optional markdown code fences
    let extracted: Record<string, unknown> = {};
    try {
      const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonMatch = fenceMatch ? fenceMatch[1] : rawText.match(/(\{[\s\S]*\})/)?.[1];
      extracted = JSON.parse(jsonMatch || rawText);
    } catch {
      throw new Error("No se pudo interpretar la respuesta de la IA. Intenta con una imagen más clara.");
    }

    // Update scan job with results
    if (scanJob) {
      await supabase
        .from("scan_jobs")
        .update({
          status: "done",
          raw_text: rawText,
          extracted_data: extracted,
        })
        .eq("id", scanJob.id);
    }

    return NextResponse.json({
      scanJobId: scanJob?.id || null,
      extracted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido en OCR";

    if (scanJob) {
      await supabase
        .from("scan_jobs")
        .update({ status: "error", error_message: message })
        .eq("id", scanJob.id);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
