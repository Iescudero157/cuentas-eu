"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, ArrowLeft } from "lucide-react";

const plans = [
  {
    id: "gratis",
    name: "Gratis",
    price: "0",
    desc: "Para empezar",
    features: ["Dashboard básico", "5 facturas/mes", "Categorización manual", "Resumen mensual"],
    cta: "Empezar gratis",
    highlighted: false,
    href: "/registro",
  },
  {
    id: "autonomo",
    name: "Autónomo",
    price: "9,99",
    desc: "Todo lo que necesitas",
    features: [
      "Conexión bancaria",
      "IA categorización",
      "Estimación impuestos",
      "Facturas ilimitadas",
      "Alertas fiscales",
      "Soporte prioritario",
    ],
    cta: "Empezar prueba gratis",
    highlighted: true,
    href: null,
  },
  {
    id: "creator",
    name: "Creator",
    price: "19,99",
    desc: "Para creadores de contenido",
    features: [
      "Todo de Autónomo",
      "YouTube, Twitch, Etsy...",
      "Multi-moneda",
      "Cash flow forecast",
      "Tax savings finder",
      "Dashboard creador",
    ],
    cta: "Empezar prueba gratis",
    highlighted: false,
    href: null,
  },
  {
    id: "business",
    name: "Business",
    price: "29,99",
    desc: "Para profesionales",
    features: [
      "Todo de Creator",
      "Multi-usuario",
      "P&L por proyecto",
      "API acceso",
      "Export gestoría",
      "Account manager",
    ],
    cta: "Contactar ventas",
    highlighted: false,
    href: "mailto:hola@kuentas.eu",
  },
];

export default function PreciosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();

      if (res.status === 401) {
        // Not logged in → redirect to registro with plan param
        router.push(`/registro?plan=${planId}`);
        return;
      }

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Error desconocido");
      }

      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      alert("No se pudo iniciar el pago. Inténtalo de nuevo.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-brand-gray">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-blue transition mb-10"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div className="text-center mb-14">
          <h1 className="text-4xl font-extrabold text-brand-text">
            Planes simples, sin sorpresas
          </h1>
          <p className="mt-3 text-lg text-brand-muted">
            Empieza gratis. Paga solo cuando lo necesites. Cancela cuando quieras.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-8 border-2 bg-white transition relative ${
                plan.highlighted
                  ? "border-brand-blue shadow-xl shadow-brand-blue/10"
                  : "border-brand-border hover:border-brand-blue/30"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-brand text-white text-xs font-bold px-4 py-1 rounded-full">
                  MÁS POPULAR
                </div>
              )}
              <h3 className="text-lg font-bold text-brand-text">{plan.name}</h3>
              <p className="text-sm text-brand-muted mt-1">{plan.desc}</p>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-extrabold text-brand-text">{plan.price}</span>
                <span className="text-brand-muted ml-1">EUR/mes</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-brand-text">
                    <Check className="w-4 h-4 text-brand-green mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.href ? (
                <a
                  href={plan.href}
                  className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition ${
                    plan.highlighted
                      ? "gradient-brand text-white hover:opacity-90"
                      : "bg-brand-gray text-brand-text hover:bg-brand-blue/10"
                  }`}
                >
                  {plan.cta}
                </a>
              ) : plan.id === "gratis" ? (
                <Link
                  href="/registro"
                  className="block text-center py-2.5 rounded-lg font-semibold text-sm bg-brand-gray text-brand-text hover:bg-brand-blue/10 transition"
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={loading === plan.id}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-60 ${
                    plan.highlighted
                      ? "gradient-brand text-white hover:opacity-90"
                      : "bg-brand-gray text-brand-text hover:bg-brand-blue/10"
                  }`}
                >
                  {loading === plan.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</>
                  ) : plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-brand-muted">
          Pago seguro procesado por Stripe · Factura en EUR · IVA incluido ·{" "}
          <a href="mailto:hola@kuentas.eu" className="text-brand-blue hover:underline">
            Contactar soporte
          </a>
        </p>
      </div>
    </div>
  );
}
