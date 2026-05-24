import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight, TrendingDown, AlertCircle, Shield, HeadphonesIcon, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Gastos Deducibles para Autónomos: IA que Detecta tus Deducciones | KUENTAS.EU",
  description:
    "¿Cuánto te estás dejando de deducir? La IA de Kuentas analiza tus gastos y detecta las deducciones que muchos gestores pasan por alto. Ahorra hasta €1.200/año.",
  keywords: ["gastos deducibles autonomo", "que gastos puede deducir un autonomo", "deducciones fiscales autonomo", "gastos fiscales autonomo", "deducir gastos freelance"],
  alternates: { canonical: "https://app.kuentas.eu/gastos-deducibles" },
  openGraph: {
    title: "Gastos Deducibles para Autónomos — IA que Detecta tus Deducciones",
    description: "Kuentas analiza tus gastos y encuentra deducciones que muchos gestores pasan por alto.",
    url: "https://app.kuentas.eu/gastos-deducibles",
  },
};

const trust = [
  { icon: CheckCircle,    text: "Sin tarjeta de crédito" },
  { icon: CheckCircle,    text: "Plan gratuito disponible" },
  { icon: Shield,         text: "Datos seguros — SSL + GDPR" },
  { icon: HeadphonesIcon, text: "Soporte en español" },
  { icon: CheckCircle,    text: "Cancela cuando quieras" },
];

const gastos = [
  {
    cat: "🏠 Suministros del hogar",
    items: ["Electricidad (% uso profesional)", "Internet y teléfono (% uso profesional)", "Alquiler de despacho o coworking"],
  },
  {
    cat: "💻 Material y software",
    items: ["Ordenador, monitor, periféricos", "Suscripciones de software y apps", "Material de oficina y fungibles"],
  },
  {
    cat: "📚 Formación y desarrollo",
    items: ["Cursos, másters, formaciones", "Libros y publicaciones profesionales", "Congresos, ferias y eventos del sector"],
  },
  {
    cat: "🚗 Desplazamientos",
    items: ["Combustible (uso profesional)", "Dietas y manutención en desplazamientos", "Transporte público y taxi laboral"],
  },
  {
    cat: "🛡️ Seguros y cuotas",
    items: ["Cuota de autónomo (Seguridad Social)", "Seguro de responsabilidad civil", "Seguro de salud (hasta €500/año)"],
  },
  {
    cat: "📣 Publicidad y servicios",
    items: ["Publicidad y marketing online", "Honorarios de otros profesionales", "Gastos de gestoría (¡sí, son deducibles!)"],
  },
];

const faqs = [
  {
    q: "¿Kuentas verifica automáticamente que mis deducciones son legales?",
    a: "Kuentas aplica las reglas fiscales vigentes de la AEAT para clasificar cada gasto. Si un gasto tiene requisitos específicos (como el porcentaje de uso profesional del hogar), la app te guía para calcularlo correctamente. No es asesoramiento legal personalizado, pero los criterios son los que aplica Hacienda.",
  },
  {
    q: "¿Puedo subir facturas antiguas de meses o años anteriores?",
    a: "Sí. Puedes importar facturas con cualquier fecha. Kuentas las procesa y las asigna al trimestre que corresponde automáticamente. Si hay que regularizar algún período, te lo indicará.",
  },
  {
    q: "¿Qué diferencia hay entre el plan gratuito y el de pago en cuanto a gastos deducibles?",
    a: "El plan gratuito incluye categorización manual de gastos. El plan Autónomo (€9,99/mes) activa la categorización automática con IA, el escáner OCR de facturas y tickets, y el detector automático de deducciones potenciales.",
  },
];

export default function GastosDeduciblesPage() {
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
        <span className="inline-block bg-green-100 text-green-700 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5">
          Gastos deducibles · IRPF · Ahorro fiscal
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-text leading-tight mb-4">
          ¿Qué gastos puedes deducir tú<br />
          <span className="text-brand-blue">como autónomo?</span>
        </h1>
        <p className="text-lg text-brand-muted max-w-xl mx-auto mb-8">
          La IA de Kuentas analiza tus facturas y detecta automáticamente las deducciones que te corresponden.
          De media, los autónomos descubren <strong className="text-brand-text">€1.200 en gastos no deducidos</strong> el primer mes.
        </p>
        <Link
          href="/registro"
          className="inline-flex items-center gap-2 bg-brand-blue text-white font-bold px-8 py-4 rounded-xl hover:opacity-90 transition text-lg shadow-lg shadow-brand-blue/20"
        >
          Ver mis deducciones gratis <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="mt-3 text-sm text-brand-muted">Sin tarjeta · Plan gratuito · Cancela cuando quieras</p>
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

      {/* ── STATS ────────────────────────────────────────────────────── */}
      <section className="bg-brand-blue py-10">
        <div className="max-w-4xl mx-auto px-5 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { val: "€1.200", label: "ahorro medio anual al deducir correctamente" },
            { val: "23+",    label: "categorías de gastos deducibles para autónomos" },
            { val: "47 %",   label: "de autónomos no deduce todo lo que podría" },
          ].map(({ val, label }) => (
            <div key={val}>
              <p className="text-3xl font-extrabold text-white mb-1">{val}</p>
              <p className="text-white/60 text-xs leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── LISTA DE GASTOS ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <h2 className="text-2xl font-bold text-brand-text text-center mb-2">
          Los gastos que puedes deducir como autónomo
        </h2>
        <p className="text-brand-muted text-center text-sm mb-10">
          Kuentas los detecta automáticamente para que no se te escape ninguno.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gastos.map(({ cat, items }) => (
            <div key={cat} className="bg-brand-gray rounded-2xl border border-brand-border p-5">
              <h3 className="font-bold text-brand-text text-sm mb-3">{cat}</h3>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-brand-muted">
                    <CheckCircle className="w-4 h-4 text-brand-success shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-brand-muted mt-5">
          * La deducibilidad depende de la actividad y del porcentaje de uso profesional.
          Kuentas aplica los criterios vigentes de la AEAT.
        </p>
      </section>

      {/* ── CÓMO DETECTA KUENTAS ─────────────────────────────────────── */}
      <section className="bg-brand-gray py-14">
        <div className="max-w-4xl mx-auto px-5 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-bold text-brand-text mb-4">
              Cómo Kuentas maximiza tus deducciones
            </h2>
            <div className="space-y-4">
              {[
                { icon: Zap,           titulo: "Detección automática con IA", desc: "La IA categoriza tus gastos y marca los deducibles sin que hagas nada." },
                { icon: AlertCircle,   titulo: "Sin gastos olvidados", desc: "Kuentas detecta patrones de gastos habituales que no has registrado y te avisa." },
                { icon: TrendingDown,  titulo: "IRPF optimizado", desc: "Con todos los gastos bien registrados, tu Modelo 130 trimestral refleja lo que realmente debes." },
              ].map(({ icon: Icon, titulo, desc }) => (
                <div key={titulo} className="flex items-start gap-4 bg-white rounded-xl border border-brand-border p-4">
                  <div className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-brand-blue" />
                  </div>
                  <div>
                    <p className="font-bold text-brand-text text-sm">{titulo}</p>
                    <p className="text-brand-muted text-xs mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Price anchor */}
          <div className="bg-white rounded-2xl border border-brand-border p-7 shadow-sm">
            <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-4">Lo que te cuesta Kuentas vs. lo que te ahorra</p>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 text-center bg-red-50 rounded-xl p-4 border border-red-100">
                <p className="text-xs text-red-500 font-semibold mb-1">Sin Kuentas</p>
                <p className="text-2xl font-extrabold text-red-500">−€1.200</p>
                <p className="text-xs text-red-400 mt-1">en deducciones perdidas</p>
              </div>
              <span className="text-brand-muted font-bold">vs</span>
              <div className="flex-1 text-center bg-green-50 rounded-xl p-4 border border-green-100">
                <p className="text-xs text-brand-success font-semibold mb-1">Con Kuentas</p>
                <p className="text-2xl font-extrabold text-brand-success">+€1.200</p>
                <p className="text-xs text-green-500 mt-1">recuperados al año</p>
              </div>
            </div>
            <Link
              href="/registro"
              className="flex items-center justify-center gap-2 w-full bg-brand-blue text-white font-bold py-3 rounded-xl hover:opacity-90 transition"
            >
              Descubrir mis deducciones <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-center text-xs text-brand-muted mt-3">Desde €9,99/mes · Plan gratis disponible</p>
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
          <h2 className="text-2xl font-bold text-white mb-3">
            Empieza a deducir lo que te corresponde
          </h2>
          <p className="text-white/70 mb-7 text-sm leading-relaxed">
            Crea tu cuenta gratis y descubre en minutos los gastos que deberías estar deduciendo.
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
