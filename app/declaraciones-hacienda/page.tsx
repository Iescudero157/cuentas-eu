import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight, Calendar, Shield, HeadphonesIcon, FileText, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Modelos 130 y 303 para autónomos: estima tu IRPF e IVA trimestral",
  description:
    "Kuentas estima en tiempo real tu pago fraccionado de IRPF (modelo 130) y tu IVA trimestral (modelo 303) con tus facturas y gastos, y te da un borrador imprimible. La presentación la haces tú en la Sede de la AEAT. Plan gratuito disponible.",
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
    title: "Modelos 130 y 303 — tu IRPF e IVA trimestral, estimados al día",
    description: "Kuentas estima tus impuestos trimestrales con tus facturas y gastos. Tú revisas las cifras y presentas los modelos en la Sede de la AEAT.",
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
    desc: "El pago fraccionado del IRPF. Se presenta 4 veces al año y Kuentas lo estima con tus ingresos y gastos del trimestre.",
    plazos: ["1er trim — hasta 20 abril", "2º trim — hasta 20 julio", "3er trim — hasta 20 octubre", "4º trim — hasta 30 enero"],
    color: "border-brand-blue bg-brand-blue/5",
    badgeColor: "bg-brand-blue text-white",
  },
  {
    modelo: "Modelo 303",
    nombre: "IVA trimestral",
    desc: "La liquidación del IVA. Kuentas estima la diferencia entre el IVA cobrado en tus facturas y el IVA pagado en tus gastos.",
    plazos: ["1er trim — hasta 20 abril", "2º trim — hasta 20 julio", "3er trim — hasta 20 octubre", "4º trim — hasta 30 enero"],
    color: "border-brand-success bg-brand-success/5",
    badgeColor: "bg-brand-success text-white",
  },
];

const features = [
  "Estimación del modelo 130 con tus ingresos y gastos",
  "Estimación del modelo 303 con el IVA de tus facturas y gastos",
  "Alertas de vencimiento antes de cada plazo trimestral",
  "Resumen por trimestres del año en curso",
  "Borrador imprimible para revisar las cifras antes de presentar",
  "Compatible con estimación directa simplificada",
];

const faqs = [
  {
    q: "¿Kuentas presenta las declaraciones por mí en la AEAT?",
    a: "No. Kuentas estima las cifras de los modelos 130 y 303 y te da un borrador imprimible orientativo. La presentación oficial la haces tú en la Sede Electrónica de la AEAT, con certificado digital o Cl@ve PIN, después de revisar las cifras.",
  },
  {
    q: "¿El Modelo 130 y el Modelo 303 son lo mismo?",
    a: "No. El Modelo 130 es el pago fraccionado del IRPF (lo que pagas a cuenta de la declaración anual). El Modelo 303 es la liquidación del IVA (diferencia entre el IVA cobrado y el IVA pagado). Kuentas estima los dos.",
  },
  {
    q: "¿Qué pasa si presento una declaración fuera de plazo?",
    a: "Si la presentas tarde sin requerimiento previo de Hacienda, se aplica un recargo del 1 % más otro 1 % por cada mes completo de retraso; a partir de 12 meses, el recargo es del 15 % más intereses de demora (art. 27 de la Ley General Tributaria). Kuentas te muestra en la app los próximos plazos y los destaca cuando se acercan.",
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
            Empezar gratis
          </Link>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 pt-16 pb-12 text-center">
        <span className="inline-block bg-brand-blue/10 text-brand-blue text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5">
          Declaraciones autónomos · Modelo 130 · Modelo 303
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-text leading-tight mb-4">
          Tus modelos 130 y 303,<br />
          <span className="text-brand-blue">estimados en tiempo real.</span>
        </h1>
        <p className="text-lg text-brand-muted max-w-xl mx-auto mb-8">
          Kuentas estima tu pago fraccionado de IRPF y tu IVA trimestral con tus facturas y gastos,
          y te avisa de los plazos. Tú revisas las cifras y presentas los modelos en la Sede Electrónica de la AEAT.
        </p>
        <Link
          href="/registro"
          className="inline-flex items-center gap-2 bg-brand-blue text-white font-bold px-8 py-4 rounded-xl hover:opacity-90 transition text-lg shadow-lg shadow-brand-blue/20"
        >
          Empieza gratis <ArrowRight className="w-5 h-5" />
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
        <p className="text-brand-muted text-center text-sm mb-10">Kuentas estima las dos. Tú revisas las cifras y presentas los modelos.</p>
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
            <h2 className="text-xl font-bold text-brand-text mb-5">Lo que incluye Kuentas para tus impuestos trimestrales</h2>
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
            <div className="bg-brand-blue/10 rounded-xl p-4 text-center mb-4">
              <p className="text-sm text-brand-muted mb-1">Plan Autónomo</p>
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
            Tus impuestos trimestrales, a la vista.
          </h2>
          <p className="text-white/70 mb-7 text-sm leading-relaxed">
            Kuentas estima tu IVA y tu IRPF de cada trimestre. Tú revisas las cifras y presentas los modelos en la Sede de la AEAT.
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
