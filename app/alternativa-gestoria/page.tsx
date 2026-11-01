import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight, Clock, Shield, HeadphonesIcon, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Llevar tus cuentas de autónomo sin gestoría: qué hace Kuentas y qué no",
  description:
    "¿Te planteas llevar tú las cuentas? Kuentas ordena tus facturas y gastos y estima tu IVA e IRPF en tiempo real. No es una gestoría: no te asesora ni presenta tus modelos. Plan gratuito; de pago desde €9,99/mes.",
  keywords: [
    "alternativa gestoria autonomo",
    "precio gestoria autonomo",
    "cuanto cobra un gestor autonomo",
  ],
  alternates: { canonical: "https://app.kuentas.eu/alternativa-gestoria" },
  openGraph: {
    title: "¿Llevar tú las cuentas? Kuentas, gratis o desde €9,99/mes",
    description: "Facturas, gastos y estimación de IVA e IRPF en una app. No es una gestoría: los modelos los presentas tú o tu asesor.",
    url: "https://app.kuentas.eu/alternativa-gestoria",
  },
};

const trust = [
  { icon: CheckCircle,    text: "Sin tarjeta de crédito" },
  { icon: CheckCircle,    text: "Plan gratuito disponible" },
  { icon: Shield,         text: "Datos seguros — SSL + GDPR" },
  { icon: HeadphonesIcon, text: "Soporte en español" },
  { icon: CheckCircle,    text: "Cancela cuando quieras" },
];

const incluye = [
  "Facturas ilimitadas con numeración legal",
  "Estimación del IVA trimestral — Modelo 303",
  "Estimación del IRPF trimestral — Modelo 130",
  "Categorización automática de gastos con IA",
  "Escaneo OCR de facturas y tickets",
  "Alertas de vencimientos fiscales",
  "Importación de movimientos bancarios por CSV",
  "Envío de facturas por email",
];

const faqs = [
  {
    q: "¿Kuentas sustituye a mi gestor?",
    a: "No. Kuentas es un software, no una gestoría: no te asesora ni presenta modelos en tu nombre. Te ayuda a llevar facturas y gastos y estima el IVA (modelo 303) y el pago fraccionado del IRPF (modelo 130), con un borrador imprimible. La presentación la haces tú en la Sede Electrónica de la AEAT, con certificado digital o Cl@ve, o tu asesor, a quien puedes pasar tus datos exportados en CSV o PDF.",
  },
  {
    q: "¿Las cifras de Kuentas tienen en cuenta mi situación fiscal concreta?",
    a: "No. Son estimaciones orientativas a partir de las facturas y los gastos que registras: no tienen en cuenta tu situación personal ni sustituyen la revisión de un asesor. Revisa siempre los importes antes de presentar.",
  },
  {
    q: "¿Qué incluye el plan gratuito comparado con el de pago?",
    a: "El plan gratuito incluye hasta 5 facturas al mes, categorización manual de gastos y el dashboard financiero básico. El plan Autónomo (€9,99/mes) desbloquea facturas ilimitadas, la categorización automática con IA, la estimación del IVA y del IRPF en tiempo real, el OCR de facturas y las alertas fiscales.",
  },
];

export default function AlternativaGestoriaPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Minimal header */}
      <header className="border-b border-brand-border px-5 py-4 sticky top-0 bg-white z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-extrabold text-brand-blue tracking-tight">KUENTAS.EU</Link>
          <Link href="/registro" className="bg-brand-blue text-white text-sm font-bold px-5 py-2 rounded-lg hover:opacity-90 transition">
            Empezar gratis
          </Link>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 pt-16 pb-12 text-center">
        <span className="inline-block bg-brand-blue/10 text-brand-blue text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5">
          Para autónomos que llevan sus cuentas · Gratis o desde €9,99/mes
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-text leading-tight mb-4">
          ¿Te planteas llevar tú las cuentas?<br />
          <span className="text-brand-blue">Kuentas te ayuda, gratis o desde €9,99/mes.</span>
        </h1>
        <p className="text-lg text-brand-muted max-w-xl mx-auto mb-8">
          Facturas, gastos y una estimación en tiempo real de tu IVA e IRPF, en una app. Kuentas es un
          software, no una gestoría: no te asesora ni presenta tus modelos, que presentas tú (o tu asesor) en la Sede de la AEAT.
        </p>
        <Link
          href="/registro"
          className="inline-flex items-center gap-2 bg-brand-blue text-white font-bold px-8 py-4 rounded-xl hover:opacity-90 transition text-lg shadow-lg shadow-brand-blue/20"
        >
          Empezar gratis — sin tarjeta <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="mt-3 text-sm text-brand-muted">Sin tarjeta · Sin permanencia · Cancela cuando quieras</p>
      </section>

      {/* Trust bar */}
      <div className="bg-brand-gray border-y border-brand-border py-3">
        <div className="max-w-4xl mx-auto px-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {trust.map(({ icon: Icon, text }) => (
            <span key={text} className="flex items-center gap-1.5 text-sm text-brand-muted">
              <Icon className="w-4 h-4 text-brand-success" /> {text}
            </span>
          ))}
        </div>
      </div>

      {/* ── QUÉ INCLUYE ──────────────────────────────────────────────── */}
      <section className="bg-brand-blue py-14">
        <div className="max-w-4xl mx-auto px-5">
          <h2 className="text-2xl font-bold text-white text-center mb-2">Qué incluye el plan Autónomo — €9,99/mes</h2>
          <p className="text-white/60 text-center text-sm mb-8">IVA incluido y sin permanencia. Para empezar, el plan gratuito incluye hasta 5 facturas al mes.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {incluye.map((item) => (
              <div key={item} className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
                <CheckCircle className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <span className="text-white text-sm leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 bg-white text-brand-blue font-bold px-8 py-4 rounded-xl hover:bg-brand-gray transition text-lg"
            >
              Empezar gratis <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CUÁNTO CUESTA ────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 py-14 text-center">
        <CheckCircle className="w-10 h-10 text-brand-success mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-brand-text mb-3">¿Cuánto cuesta Kuentas?</h2>
        <p className="text-brand-muted mb-8 text-sm leading-relaxed">
          Puedes empezar con el plan gratuito y pasar a un plan de pago cuando lo necesites: Autónomo
          (€9,99/mes), Creator (€19,99/mes) o Business (€29,99/mes), con IVA incluido y sin permanencia.
        </p>
        <Link href="/precios" className="text-brand-blue text-sm font-semibold hover:underline">
          Ver todos los planes →
        </Link>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="bg-brand-gray py-14">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-2xl font-bold text-brand-text text-center mb-8">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {faqs.map(({ q, a }) => (
              <div key={q} className="bg-white rounded-2xl border border-brand-border p-6">
                <h3 className="font-bold text-brand-text mb-2 text-sm">{q}</h3>
                <p className="text-brand-muted text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────── */}
      <section className="bg-brand-text py-16">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <Zap className="w-10 h-10 text-white mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl font-bold text-white mb-3">
            Lleva tus cuentas al día, con o sin gestor
          </h2>
          <p className="text-white/60 mb-7 text-sm leading-relaxed">
            Empieza con el plan gratuito. Sin tarjeta, sin compromiso.
            Si te convence, el plan Autónomo cuesta €9,99/mes, sin permanencia.
          </p>
          <Link
            href="/registro"
            className="inline-flex items-center gap-2 bg-brand-blue text-white font-bold px-8 py-4 rounded-xl hover:opacity-90 transition text-lg"
          >
            Crear cuenta gratis <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-white/40 text-xs">Sin tarjeta · Sin permanencia · Soporte en español</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-border py-6">
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-brand-muted">
          <span className="font-bold text-brand-text">KUENTAS.EU</span>
          <div className="flex gap-5">
            <Link href="/privacidad" className="hover:text-brand-blue transition">Privacidad</Link>
            <Link href="/terminos" className="hover:text-brand-blue transition">Términos</Link>
            <Link href="/precios" className="hover:text-brand-blue transition">Precios</Link>
            <Link href="/declaraciones-hacienda" className="hover:text-brand-blue transition">Declaraciones</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
