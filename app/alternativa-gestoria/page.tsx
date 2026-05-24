import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, X, ArrowRight, Clock, Shield, HeadphonesIcon, Zap, TrendingDown } from "lucide-react";

export const metadata: Metadata = {
  title: "Alternativa a la Gestoría para Autónomos — Desde €9,99/mes | KUENTAS.EU",
  description:
    "¿Cuánto pagas al gestor cada mes? Kuentas hace lo mismo por €9,99/mes: facturas, IVA, declaraciones y gastos deducibles. Sin citas, sin esperas, sin sorpresas.",
  keywords: [
    "alternativa gestoria autonomo",
    "precio gestoria autonomo",
    "cuanto cobra un gestor autonomo",
    "gestoria online autonomos",
    "sustituir gestor autonomo",
    "gestoria barata autonomo",
  ],
  alternates: { canonical: "https://app.kuentas.eu/alternativa-gestoria" },
  openGraph: {
    title: "Alternativa a la Gestoría — Kuentas desde €9,99/mes",
    description: "Mismo resultado que un gestor. Sin citas, sin esperas, sin sorpresas.",
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

const comparativa = [
  { aspecto: "Coste mensual",        gestor: "€80–€200/mes",        kuentas: "€9,99/mes",           win: "kuentas" },
  { aspecto: "Disponibilidad",       gestor: "Horario de oficina",   kuentas: "24 h / 365 días",     win: "kuentas" },
  { aspecto: "Tiempo de respuesta",  gestor: "Días o semanas",       kuentas: "Inmediato",           win: "kuentas" },
  { aspecto: "Modelo 303 (IVA)",     gestor: "Lo hace el gestor",    kuentas: "Automático con IA",   win: "kuentas" },
  { aspecto: "Modelo 130 (IRPF)",    gestor: "Lo hace el gestor",    kuentas: "Automático con IA",   win: "kuentas" },
  { aspecto: "Facturas",             gestor: "Las aportas tú",       kuentas: "Crea y gestiona Kuentas", win: "kuentas" },
  { aspecto: "Gastos deducibles",    gestor: "Tú se los informas",   kuentas: "IA los detecta sola", win: "kuentas" },
  { aspecto: "Permanencia",          gestor: "Anual habitual",       kuentas: "Ninguna",             win: "kuentas" },
];

const incluye = [
  "Facturas ilimitadas con numeración legal",
  "IVA trimestral automático — Modelo 303",
  "IRPF trimestral automático — Modelo 130",
  "Detector de gastos deducibles con IA",
  "Escaneo OCR de facturas y tickets",
  "Alertas de vencimientos fiscales",
  "Importación de movimientos bancarios",
  "Historial completo de declaraciones",
];

const faqs = [
  {
    q: "¿Kuentas reemplaza completamente a mi gestor?",
    a: "Para la mayoría de autónomos en estimación directa simplificada: sí. Kuentas cubre facturación, IVA trimestral (Modelo 303), IRPF trimestral (Modelo 130), gestión de gastos deducibles y alertas fiscales. Para casos complejos como deducciones especiales, operaciones intracomunitarias frecuentes o inspecciones de Hacienda, sigue siendo recomendable contar con asesoramiento puntual.",
  },
  {
    q: "¿Kuentas se mantiene actualizado con los cambios fiscales?",
    a: "Sí. El equipo de Kuentas actualiza la app con cada cambio normativo relevante para autónomos. Las tablas de retención del IRPF, los límites de deducción y los plazos de presentación se actualizan automáticamente sin que tengas que hacer nada.",
  },
  {
    q: "¿Qué incluye el plan gratuito comparado con el de pago?",
    a: "El plan gratuito incluye hasta 5 facturas al mes, categorización manual de gastos y el dashboard financiero básico. El plan Autónomo (€9,99/mes) desbloquea facturas ilimitadas, la IA de categorización automática, el Modelo 130 y 303 automáticos, OCR de facturas y alertas fiscales avanzadas.",
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
            Prueba gratis
          </Link>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 pt-16 pb-12 text-center">
        <span className="inline-block bg-brand-blue/10 text-brand-blue text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5">
          Alternativa a la gestoría · Sin gestor desde €9,99/mes
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-text leading-tight mb-4">
          Tu gestor cobra €1.800/año.<br />
          <span className="text-brand-blue">Kuentas cuesta €9,99/mes.</span>
        </h1>
        <p className="text-lg text-brand-muted max-w-xl mx-auto mb-8">
          Mismo resultado que un gestor tradicional — facturas, IVA, declaraciones y gastos deducibles —
          sin citas, sin esperas y sin sorpresas en la factura a fin de mes.
        </p>
        <Link
          href="/registro"
          className="inline-flex items-center gap-2 bg-brand-blue text-white font-bold px-8 py-4 rounded-xl hover:opacity-90 transition text-lg shadow-lg shadow-brand-blue/20"
        >
          Prueba gratis — sin tarjeta <ArrowRight className="w-5 h-5" />
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

      {/* ── COMPARATIVA ──────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 py-14">
        <h2 className="text-2xl font-bold text-brand-text text-center mb-2">Kuentas vs. tu gestoría actual</h2>
        <p className="text-brand-muted text-center text-sm mb-8">La misma gestión fiscal. A una fracción del precio.</p>
        <div className="rounded-2xl border border-brand-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 bg-brand-gray">
            <div className="p-3 text-xs font-semibold text-brand-muted uppercase tracking-wide">Aspecto</div>
            <div className="p-3 text-xs font-semibold text-brand-muted text-center">Gestoría</div>
            <div className="p-3 text-xs font-semibold text-brand-blue text-center">Kuentas</div>
          </div>
          {comparativa.map(({ aspecto, gestor, kuentas }, i) => (
            <div key={aspecto} className={`grid grid-cols-3 border-t border-brand-border ${i % 2 === 0 ? "bg-white" : "bg-brand-gray/50"}`}>
              <div className="p-3.5 text-sm text-brand-text font-medium">{aspecto}</div>
              <div className="p-3.5 text-sm text-brand-muted text-center flex items-center justify-center gap-1.5">
                <X className="w-3.5 h-3.5 text-red-400 shrink-0" /> {gestor}
              </div>
              <div className="p-3.5 text-sm text-brand-blue font-semibold text-center flex items-center justify-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-brand-success shrink-0" /> {kuentas}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── QUÉ INCLUYE ──────────────────────────────────────────────── */}
      <section className="bg-brand-blue py-14">
        <div className="max-w-4xl mx-auto px-5">
          <h2 className="text-2xl font-bold text-white text-center mb-2">Todo lo que incluye Kuentas — desde €9,99/mes</h2>
          <p className="text-white/60 text-center text-sm mb-8">El plan Autónomo incluye todo lo que un gestor haría por ti.</p>
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

      {/* ── CUÁNTO AHORRAS ───────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 py-14 text-center">
        <TrendingDown className="w-10 h-10 text-brand-success mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-brand-text mb-3">Calcula cuánto ahorras al año</h2>
        <p className="text-brand-muted mb-8 text-sm leading-relaxed">
          Si pagas €100/mes al gestor (precio muy habitual en autónomos con volumen medio),
          con Kuentas pagarías €9,99/mes. La diferencia es <strong className="text-brand-text">€1.080 al año</strong> que se quedan en tu bolsillo.
          Si pagas €150/mes, el ahorro sube a <strong className="text-brand-text">€1.680 al año</strong>.
        </p>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Si pagas €80/mes", ahorro: "€841/año" },
            { label: "Si pagas €100/mes", ahorro: "€1.081/año" },
            { label: "Si pagas €150/mes", ahorro: "€1.681/año" },
          ].map(({ label, ahorro }) => (
            <div key={label} className="bg-brand-gray rounded-xl border border-brand-border p-4 text-center">
              <p className="text-xs text-brand-muted mb-1">{label}</p>
              <p className="text-xl font-extrabold text-brand-success">{ahorro}</p>
              <p className="text-xs text-brand-muted">ahorrados</p>
            </div>
          ))}
        </div>
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
            Deja de pagar de más por la gestoría
          </h2>
          <p className="text-white/60 mb-7 text-sm leading-relaxed">
            Empieza con el plan gratuito. Sin tarjeta, sin compromiso.
            Si te convence, el plan Autónomo cuesta menos de lo que pagas al gestor en un día.
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
