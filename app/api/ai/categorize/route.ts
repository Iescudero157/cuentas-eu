import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  software: ["adobe", "figma", "github", "vercel", "notion", "slack", "zoom", "google workspace", "microsoft 365", "canva", "dropbox", "aws", "hosting"],
  hardware: ["ordenador", "portatil", "monitor", "teclado", "raton", "impresora", "camara", "microfono", "auriculares", "disco duro", "pendrive"],
  coworking: ["coworking", "espacio de trabajo", "oficina", "alquiler despacho", "impacthub", "aticco", "utopicus"],
  transporte: ["taxi", "uber", "cabify", "renfe", "ave", "avion", "metro", "bus", "gasolina", "parking", "tren", "vuelo", "bono transporte"],
  comida: ["restaurante", "comida", "almuerzo", "cena", "desayuno", "cafeteria", "catering", "bar", "reunion comida"],
  marketing: ["google ads", "facebook ads", "meta ads", "linkedin ads", "publicidad", "seo", "marketing", "newsletter", "mailchimp"],
  telefono: ["movistar", "vodafone", "orange", "telefonica", "movil", "linea", "internet", "fibra", "dato"],
  formacion: ["udemy", "coursera", "curso", "formacion", "libro", "seminario", "taller", "master", "certificacion"],
  seguros: ["seguro", "rc profesional", "responsabilidad civil", "mutua", "mapfre", "adeslas"],
  material: ["material", "papeleria", "impresion", "toner", "papel", "material oficina"],
  servicios: ["gestor", "abogado", "contable", "freelance", "subcontrata", "consultoria", "servicio"],
};

function ruleBasedCategory(description: string): { category: string; confidence: number } {
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return { category, confidence: 0.85 };
      }
    }
  }
  return { category: "otros", confidence: 0.5 };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { description, amount } = await request.json();

  if (!description) {
    return NextResponse.json({ error: "description requerida" }, { status: 400 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;

  if (openaiKey) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          messages: [
            {
              role: "system",
              content: `Eres un asistente contable para autonomos espanoles.
Clasifica el gasto en una de estas categorias: software, hardware, coworking, transporte, comida, marketing, telefono, formacion, seguros, material, servicios, otros.
Responde SOLO con JSON valido: {"category": "...", "confidence": 0.95, "deductible": true, "reason": "..."}
El campo deductible indica si es deducible como gasto de empresa en Espana.`
            },
            {
              role: "user",
              content: `Descripcion: "${description}". Importe: ${amount ?? "?"} EUR.`
            }
          ],
          max_tokens: 150,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const result = JSON.parse(content);
          return NextResponse.json(result);
        }
      }
    } catch {
      // Fall through to rule-based
    }
  }

  // Fallback: rule-based categorization
  const { category, confidence } = ruleBasedCategory(description);
  const deductible = category !== "comida" || true; // most are deductible

  return NextResponse.json({
    category,
    confidence,
    deductible: category !== "otros",
    reason: `Categoria asignada por reglas basadas en palabras clave. ${openaiKey ? "" : "Configura OPENAI_API_KEY para IA real."}`,
  });
}
