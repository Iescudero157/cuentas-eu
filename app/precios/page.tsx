"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, ArrowLeft, Sparkles, Zap, Building2, Star, ShieldCheck, Lock } from "lucide-react";

const plans = [
  {
    id: "gratis",
    name: "Gratis",
    price: "0",
    desc: "Para probar sin compromiso",
    icon: Star,
    color: "text-brand-muted",
    features: [
      "Dashboard financiero básico",
      "Hasta 5 facturas/mes",
      "Categorización manual de gastos",
      "Resumen mensual de ingresos/gastos",
      "App web y móvil",
    ],
    unavailable: [
      "IA categorización automática",
      "Estimación IRPF e IVA en tiempo real",
      "Alertas fiscales automáticas",
      "Escaneo OCR de facturas",
    ],
    cta: "Empezar gratis",
    highlighted: false,
    href: "/registro",
  },
  {
    id: "autonomo",
    name: "Autónomo",
    price: "9,99",
    desc: "Todo lo que necesita un autónomo",
    icon: Zap,
    color: "text-brand-blue",
    features: [
      "Facturas ilimitadas",
      "🤖 IA categorización automática",
      "📊 Estimación IRPF e IVA en tiempo real",
      "⚠️ Alertas fiscales (303, 130, 100)",
      "🔍 Escaneo OCR de facturas y tickets",
      "📥 Importación CSV desde tu banco",
      "📧 Envío de facturas por email",
      "Soporte prioritario",
    ],
    cta: "Suscribirme ahora",
    highlighted: true,
    href: null,
  },
  {
    id: "creator",
    name: "Creator",
    price: "19,99",
    desc: "Para creadores de contenido",
    icon: Sparkles,
    color: "text-purple-600",
    features: [
      "Todo de Autónomo",
      "🎬 Dashboard para creadores (YouTube, Twitch, Etsy...)",
      "💱 Multi-moneda (EUR, USD, GBP...)",
      "📈 Cash flow forecast 6 meses",
      "💡 AI Tax Savings Finder",
      "📊 Informe de ingresos por plataforma",
      "Export a gestorías",
    ],
    cta: "Suscribirme ahora",
    highlighted: false,
    href: null,
  },
  {
    id: "business",
    name: "Business",
    price: "29,99",
    desc: "Para equipos y empresas",
    icon: Building2,
    color: "text-brand-success",
    features: [
      "Todo de Creator",
      "👥 Multi-usuario (hasta 5 usuarios)",
      "📁 P&L desglosado por proyecto",
      "🔌 Acceso API REST completa",
      "📤 Export nativo a A3, ContaPlus, Sage",
      "🏦 Conciliación bancaria automática",
      "Account manager dedicado",
    ],
    cta: "Contactar ventas",
    highlighted: false,
    href: "mailto:hola@kuentas.eu?subject=Plan Business KUENTAS.EU",
  },
];

export default function PreciosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const redsysFormRef = useRef<HTMLFormElement>(null);
  const [redsysParams, setRedsysParams] = useState<{
    url: string; sig: string; params: string; sigVer: string;
  } | null>(null);

  async function handleCheckout(planId: string) {
    setLoading(planId);
    try {
      const res  = await fetch("/api/redsys/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();

      if (res.status === 401) { router.push(`/registro?plan=${planId}`); return; }
      if (!res.ok) throw new Error(data.error ?? "Error TPV BBVA");

      setRedsysParams({
        url:    data.redsysUrl,
        sig:    data.Ds_Signature,
        params: data.Ds_MerchantParameters,
        sigVer: data.Ds_SignatureVersion,
      });
      // Pequeño delay para que React renderice el form oculto antes del submit
      setTimeout(() => redsysFormRef.current?.submit(), 100);
    } catch (err) {
      console.error("Checkout error:", err);
      alert("No se pudo iniciar el pago. Inténtalo de nuevo.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-brand-gray">
      {/* Formulario oculto de Redsys — se auto-envía al TPV BBVA */}
      {redsysParams && (
        <form
          ref={redsysFormRef}
          method="POST"
          action={redsysParams.url}
          style={{ display: "none" }}
        >
          <input name="Ds_SignatureVersion"   value={redsysParams.sigVer} readOnly />
          <input name="Ds_MerchantParameters" value={redsysParams.params} readOnly />
          <input name="Ds_Signature"          value={redsysParams.sig}    readOnly />
        </form>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-blue transition mb-10"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        {/* Cabecera */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-extrabold text-brand-text">
            Planes simples, sin sorpresas
          </h1>
          <p className="mt-3 text-lg text-brand-muted">
            Empieza gratis. La IA se activa desde el plan Autónomo. Cancela cuando quieras.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-brand-blue/10 text-brand-blue px-4 py-2 rounded-full text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            La IA incluye: categorización automática, OCR de facturas, estimación fiscal y tax savings finder
          </div>

          {/* Sello de seguridad BBVA */}
          <div className="mt-5 inline-flex items-center gap-3 bg-white border border-brand-border px-5 py-3 rounded-xl shadow-sm">
            <Lock className="w-4 h-4 text-brand-blue shrink-0" />
            <span className="text-sm text-brand-muted">
              Pago seguro a través del{" "}
              <span className="font-semibold text-brand-text">TPV Virtual BBVA</span>
              {" "}(Redsys SHA-256) · Visa · Mastercard · Amex
            </span>
            <ShieldCheck className="w-4 h-4 text-brand-success shrink-0" />
          </div>
        </div>

        {/* Tarjetas de planes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const IconComp = plan.icon;
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-8 border-2 bg-white transition relative flex flex-col ${
                  plan.highlighted
                    ? "border-brand-blue shadow-xl shadow-brand-blue/10"
                    : "border-brand-border hover:border-brand-blue/30"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-blue text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                    MÁS POPULAR
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <IconComp className={`w-5 h-5 ${plan.color}`} />
                  <h3 className="text-lg font-bold text-brand-text">{plan.name}</h3>
                </div>
                <p className="text-sm text-brand-muted mb-4">{plan.desc}</p>

                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-brand-text">{plan.price}</span>
                  <span className="text-brand-muted ml-1">EUR/mes</span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-brand-text">
                      <Check className="w-4 h-4 text-brand-success mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                  {"unavailable" in plan && plan.unavailable?.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-brand-muted line-through opacity-50">
                      <span className="w-4 h-4 shrink-0 text-center leading-none mt-0.5">✕</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {plan.href ? (
                  <a
                    href={plan.href}
                    className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition ${
                      plan.highlighted
                        ? "bg-brand-blue text-white hover:opacity-90"
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
                        ? "bg-brand-blue text-white hover:opacity-90"
                        : "bg-brand-gray text-brand-text hover:bg-brand-blue/10"
                    }`}
                  >
                    {loading === plan.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Redirigiendo al banco...</>
                    ) : (
                      plan.cta
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Pie de página */}
        <div className="mt-10 text-center space-y-2">
          <p className="text-sm text-brand-muted">
            Pago procesado por el TPV Virtual BBVA (Redsys) · Cifrado SSL 256 bits · Factura en EUR · IVA incluido
          </p>
          <p className="text-sm text-brand-muted">
            <a href="mailto:hola@kuentas.eu" className="text-brand-blue hover:underline">
              Contactar soporte
            </a>
            {" · "}
            <Link href="/privacidad" className="text-brand-blue hover:underline">
              Política de privacidad
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
