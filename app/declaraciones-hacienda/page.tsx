import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight, Calendar, AlertTriangle, Shield, HeadphonesIcon, FileText, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Modelo 130 Automático para Autónomos — Declaraciones sin Gestor | KUENTAS.EU",
  description:
    "Kuentas genera el Modelo 130 de IRPF y el Modelo 303 de IVA automáticamente. Declara en Hacienda sin gestor, sin errores y sin multas. Prueba gratis.",
  keywords: [
    "declaraciones hacienda autonomo",
    "modelo 130 autonomo",
    "declarar irpf autonomo",
    "como declarar hacienda autonomo",
    "presentar declaracion autonomo online",
    "modelo 130 irpf autonomo",
  ],
  alternates: { canonical: "https://app.kuentas.eu/declaraciones-hacienda" },
  openGraph: {
    title: "Modelo 130 Automático — Declara en Hacienda sin Gestor",
    description: "Kuentas genera tus declaraciones de IRPF e IVA automáticamente. Sin errores, sin multas.",
    url: "https://app.kuentas.eu/declaraciones-hacienda",
  },
};

const trust = [
  { icon: CheckCircle,    text: "Sin tarjeta de crédito" },
  { icon: CheckCircle,    text: "Plan gratuito disponible" },
  { icon: Shield,         text: "Datos seguros — SSL + GDPR" },
  { icon: HeadphonesIcon, text: "Soporte en español" },
  { icon: CheckCircle,    text: "Cancela cuando quieras" },
];

const modelos = [
  {
    modelo: "Modelo 130",
    nombre: "IRPF trimestral",
    desc: "El pago fraccionado del IRPF. Se presenta 4 veces al año y Kuentas lo prepara automáticamente con tus ingresos y gastos del trimestre.",
    plazos: ["1er trim — hasta 20 abril", "2º trim — hasta 20 julio", "3er trim — hasta 20 octubre", "4º trim — hasta 30 enero"],
    color: "border-brand-blue bg-brand-blue/5",
    badgeColor: "bg-brand-blue text-white",
  },
  {
    modelo: "Modelo 303",
    nombre: "IVA trimestral",
    desc: "La liquidación del IVA. Kuentas calcula la diferencia entre el IVA cobrado en tus facturas y el IVA pagado en tus gastos.",
    plazos: ["1er trim — hasta 20 abril", "2º trim — hasta 20 julio", "3er trim — hasta 20 octubre", "4º trim — hasta 30 enero"],
    color: "border-brand-success bg-brand-success/5",
    badgeColor: "bg-brand-success text-white",
  },
];

const features = [
  "Modelo 130 generado automáticamente con tus ingresos y gastos",
  "Modelo 303 calculado con el IVA de tus facturas",
  "Alertas de vencimiento antes de cada plazo trimestral",
  "Histórico completo de todas tus declaraciones",
  "Datos pre-rellenados para presentar en la sede AEAT",
  "Compatible con estimación directa simplificada",
];

const faqs = [
  {
    q: "¿Kuentas presenta las declaraciones por mí en la AEAT?",
    a: "Kuentas genera los datos y el borrador del Modelo 130 y 303. La presentación oficial la realizas tú en la sede electrónica de la AEAT usando el certificado digital o Cl@ve PIN. El proceso tarda menos de 5 minutos una vez tienes los datos preparados.",
  },
  {
    q: "¿El Modelo 130 y el Modelo 303 son lo mismo?",
    a: "No. El Modelo 130 es el pago fraccionado del IRPF (lo que pagas a cuenta de la declaración anual). El Modelo 303 es la liquidación del IVA (diferencia entre el IVA cobrado y el IVA pagado). Kuentas gestiona ambos automáticamente.",
  },
  {
    q: "¿Qué pasa si presento una declaración fuera de plazo?",
    a: "Hacienda aplica recargos del 1 % al 20 % según el retraso (1 % por mes hasta 12 meses, luego el 20 % más intereses). Kuentas te avisa antes de cada vencimiento para que nunca presentes tarde.",
  },
];

export default function DeclaracionesHaciendaPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Minimal header */}
      <header className="border-b border-brand-border px-5 py-4 sticky top-0 bg-white z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-extrabold text-brand-blue tracking-tight">KUENTAS.EU</Link>
          <Link href="/registro" className="bg-brand-blue text-white text-sm font-bold px-5 py-2 rounded-lg hover:opacity-90 transition">
            Prueba gratis
          </Link>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 pt-16 pb-12 text-center">
        <span className="inline-block bg-brand-blue/10 text-brand-blue text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5">
          Declaraciones autónomos · Modelo 130 · Modelo 303
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-text leading-tight mb-4">
          Modelo 130 automático.<br />
          <span className="text-brand-blue">Hacienda sin complicaciones.</span>
        </h1>
        <p className="text-lg text-brand-muted max-w-xl mx-auto mb-8">
          Kuentas genera tus declaraciones trimestrales de IRPF e IVA automáticamente.
          Sin gestor, sin errores y sin multas por presentar fuera de plazo.
        </p>
        <Link
          href="/registro"
          className="inline-flex items-center gap-2 bg-brand-blue text-white font-bold px-8 py-4 rounded-xl hover:opacity-90 transition text-lg shadow-lg shadow-brand-blue/20"
        >
          Declara sin gestor, gratis <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="mt-3 text-sm text-brand-muted">Sin tarjeta · Plan gratuito disponible · Cancela cuando quieras</p>
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

      {/* ── MODELOS ──────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 py-14">
        <h2 className="text-2xl font-bold text-brand-text text-center mb-2">Las dos declaraciones trimestrales del autónomo</h2>
        <p className="text-brand-muted text-center text-sm mb-10">Kuentas las prepara las dos. Tú solo las revisas y presentas.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {modelos.map(({ modelo, nombre, desc, plazos, color, badgeColor }) => (
            <div key={modelo} className={`rounded-2xl border-2 p-6 ${color}`}>
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-sm font-bold px-3 py-1 rounded-lg ${badgeColor}`}>{modelo}</span>
                <span className="font-bold text-brand-text text-sm">{nombre}</span>
              </div>
              <p className="text-brand-muted text-sm leading-relaxed mb-4">{desc}</p>
              <div className="space-y-1.5">
                {plazos.map((p) => (
                  <div key={p} className="flex items-center gap-2 text-xs text-brand-muted">
                    <Calendar className="w-3.5 h-3.5 shrink-0" /> {p}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES + PRECIO ────────────────────────────────────────── */}
      <section className="bg-brand-gray py-14">
        <div className="max-w-4xl mx-auto px-5 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div>
            <h2 className="text-xl font-bold text-brand-text mb-5">Lo que incluye Kuentas para tus declaraciones</h2>
            <ul className="space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-brand-success shrink-0 mt-0.5" />
                  <span className="text-brand-text text-sm leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-brand-border p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-brand-warning" />
              <p className="text-sm font-bold text-brand-text">Coste real de una gestoría</p>
            </div>
            <div className="space-y-3 mb-5">
              {[
                { label: "Gestoría tradicional (media)", val: "€1.800/año" },
                { label: "Sanciones por error en declaración", val: "hasta €1.500" },
                { label: "Recargo por retraso en presentación", val: "+20 %" },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between text-sm border-b border-brand-border pb-2">
                  <span className="text-brand-muted">{label}</span>
                  <span className="font-bold text-brand-danger">{val}</span>
                </div>
              ))}
            </div>
            <div className="bg-brand-blue/10 rounded-xl p-4 text-center mb-4">
              <p className="text-sm text-brand-muted mb-1">Kuentas (todo incluido)</p>
              <p className="text-3xl font-extrabold text-brand-blue">€9,99/mes</p>
              <p className="text-xs text-brand-muted mt-1">Sin permanencia · Plan gratis disponible</p>
            </div>
            <Link
              href="/registro"
              className="flex items-center justify-center gap-2 w-full bg-brand-blue text-white font-bold py-3 rounded-xl hover:opacity-90 transition"
            >
              Empezar gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 py-14">
        <h2 className="text-2xl font-bold text-brand-text text-center mb-8">Preguntas frecuentes</h2>
        <div className="space-y-4">
          {faqs.map(({ q, a }) => (
            <div key={q} className="bg-brand-gray rounded-2xl border border-brand-border p-6">
              <h3 className="font-bold text-brand-text mb-2 text-sm">{q}</h3>
              <p className="text-brand-muted text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────── */}
      <section className="bg-brand-blue py-16">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <FileText className="w-10 h-10 text-white mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl font-bold text-white mb-3">
            Sin multas de Hacienda. Sin gestor.
          </h2>
          <p className="text-white/70 mb-7 text-sm leading-relaxed">
            Kuentas genera tus declaraciones trimestrales automáticamente. Tú las revisas y presentas en minutos.
          </p>
          <Link
            href="/registro"
            className="inline-flex items-center gap-2 bg-white text-brand-blue font-bold px-8 py-4 rounded-xl hover:bg-brand-gray transition text-lg"
          >
            Crear cuenta gratis <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-white/50 text-xs">Sin tarjeta · Sin permanencia · Soporte en español</p>
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
            <Link href="/iva-autonomos" className="hover:text-brand-blue transition">IVA trimestral</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
