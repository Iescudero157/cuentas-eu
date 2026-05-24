import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight, Clock, AlertTriangle, X, Zap, Shield, HeadphonesIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Modelo 303 Automático para Autónomos — Gestión IVA sin Gestor | KUENTAS.EU",
  description:
    "Kuentas calcula y prepara tu IVA trimestral automáticamente. Modelo 303 listo con tus facturas, sin errores, sin gestor. Plan gratuito disponible.",
  keywords: ["iva trimestral autonomos", "modelo 303 automatico", "calcular iva autonomo", "gestión iva autonomo", "declaración iva trimestral autonomo"],
  alternates: { canonical: "https://app.kuentas.eu/iva-autonomos" },
  openGraph: {
    title: "Modelo 303 Automático — Tu IVA trimestral sin gestor",
    description: "Kuentas prepara tu Modelo 303 automáticamente. Sin errores, sin sorpresas en Hacienda.",
    url: "https://app.kuentas.eu/iva-autonomos",
  },
};

const trust = [
  { icon: CheckCircle, text: "Sin tarjeta de crédito" },
  { icon: CheckCircle, text: "Plan gratuito disponible" },
  { icon: Shield,       text: "Datos seguros — SSL + GDPR" },
  { icon: HeadphonesIcon, text: "Soporte en español" },
  { icon: CheckCircle, text: "Cancela cuando quieras" },
];

const problemas = [
  { icon: Clock,         text: "Horas separando IVA soportado e IVA repercutido a mano" },
  { icon: AlertTriangle, text: "Miedo a equivocarte y que Hacienda te sancione" },
  { icon: X,             text: "Pagar al gestor €80–€150/mes para que haga lo mismo que puedes hacer tú" },
];

const pasos = [
  { num: "1", titulo: "Añade tus facturas", desc: "Crea o importa tus facturas de ingresos y gastos. El OCR de Kuentas las lee por ti." },
  { num: "2", titulo: "Kuentas calcula el IVA", desc: "Separamos automáticamente IVA soportado y repercutido. Cuota diferencial calculada al instante." },
  { num: "3", titulo: "Revisa y presenta", desc: "Descarga el borrador del Modelo 303 o preséntalo directamente desde la app. En minutos." },
];

const features = [
  "IVA soportado y repercutido calculados sin intervención manual",
  "Modelo 303 generado automáticamente cada trimestre",
  "Alertas antes de cada plazo: enero, abril, julio, octubre",
  "Compatible con todos los tipos de IVA (21 %, 10 %, 4 %, 0 %)",
  "Histórico completo de declaraciones trimestre a trimestre",
  "Cuadre automático entre facturas emitidas y recibidas",
];

const faqs = [
  {
    q: "¿Necesito conocimientos de contabilidad para gestionar el IVA con Kuentas?",
    a: "No. Kuentas está diseñado para autónomos sin formación contable. La app clasifica tus facturas, calcula el IVA y te explica cada cifra en español claro. Si algo no cuadra, te avisa antes de que presentes.",
  },
  {
    q: "¿Kuentas me ayuda a presentar el Modelo 303 directamente en la AEAT?",
    a: "Kuentas genera los datos del Modelo 303 listos para presentar. Puedes descargarlo en el formato que acepta la AEAT o seguir nuestras instrucciones paso a paso para la presentación online. La presentación oficial la realizas tú en la sede electrónica de la AEAT.",
  },
  {
    q: "Tengo meses de facturas sin registrar. ¿Puedo regularizarlos?",
    a: "Sí. Puedes importar facturas con cualquier fecha pasada. Kuentas recalcula el IVA de cada trimestre automáticamente cuando añades datos históricos.",
  },
];

export default function IVAAutonomosPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Minimal header — sin distracciones */}
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
          Gestión IVA · Modelo 303 Automático
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-text leading-tight mb-4">
          Tu IVA trimestral,<br />
          <span className="text-brand-blue">calculado y listo en minutos.</span>
        </h1>
        <p className="text-lg text-brand-muted max-w-xl mx-auto mb-8">
          Kuentas prepara el Modelo 303 automáticamente con tus facturas. Sin errores, sin gestor,
          sin perder horas cada trimestre.
        </p>
        <Link
          href="/registro"
          className="inline-flex items-center gap-2 bg-brand-blue text-white font-bold px-8 py-4 rounded-xl hover:opacity-90 transition text-lg shadow-lg shadow-brand-blue/20"
        >
          Empieza gratis ahora <ArrowRight className="w-5 h-5" />
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

      {/* ── PROBLEMA ─────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 py-14">
        <h2 className="text-2xl font-bold text-brand-text text-center mb-2">
          ¿Esto te pasa cada trimestre?
        </h2>
        <p className="text-brand-muted text-center mb-8 text-sm">Si la respuesta es sí, Kuentas lo resuelve de raíz.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {problemas.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-5">
              <Icon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-brand-text leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ────────────────────────────────────────────── */}
      <section className="bg-brand-gray py-14">
        <div className="max-w-4xl mx-auto px-5">
          <h2 className="text-2xl font-bold text-brand-text text-center mb-2">Cómo funciona — 3 pasos</h2>
          <p className="text-brand-muted text-center text-sm mb-10">De cero a tu declaración de IVA preparada en menos de 10 minutos.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {pasos.map(({ num, titulo, desc }) => (
              <div key={num} className="bg-white rounded-2xl border border-brand-border p-6 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full bg-brand-blue text-white font-extrabold text-lg flex items-center justify-center mx-auto mb-4">
                  {num}
                </div>
                <h3 className="font-bold text-brand-text mb-2">{titulo}</h3>
                <p className="text-brand-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-bold text-brand-text mb-2">Todo lo que incluye la gestión de IVA</h2>
            <p className="text-brand-muted text-sm mb-6">Disponible desde el plan Autónomo — €9,99/mes. Sin permanencia.</p>
            <ul className="space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-brand-success shrink-0 mt-0.5" />
                  <span className="text-brand-text text-sm leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Price anchor */}
          <div className="bg-brand-gray rounded-2xl border border-brand-border p-7">
            <p className="text-sm font-semibold text-brand-muted mb-4 uppercase tracking-wide">Compara el coste</p>
            <div className="flex items-end gap-3 mb-3">
              <div className="flex-1 bg-red-50 rounded-xl p-4 text-center border border-red-100">
                <p className="text-xs text-red-500 font-semibold mb-1">Gestoría</p>
                <p className="text-3xl font-extrabold text-red-500">€1.800</p>
                <p className="text-xs text-red-400 mt-1">de media al año</p>
              </div>
              <span className="text-brand-muted font-bold text-lg mb-3">vs</span>
              <div className="flex-1 bg-green-50 rounded-xl p-4 text-center border border-green-100">
                <p className="text-xs text-brand-success font-semibold mb-1">Kuentas</p>
                <p className="text-3xl font-extrabold text-brand-success">€9,99</p>
                <p className="text-xs text-green-500 mt-1">al mes</p>
              </div>
            </div>
            <Link
              href="/registro"
              className="flex items-center justify-center gap-2 w-full bg-brand-blue text-white font-bold py-3 rounded-xl hover:opacity-90 transition mt-4"
            >
              Empieza gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
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
      <section className="bg-brand-blue py-16">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <Zap className="w-10 h-10 text-white mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl font-bold text-white mb-3">
            Gestiona tu IVA trimestral hoy mismo
          </h2>
          <p className="text-white/70 mb-7 text-sm leading-relaxed">
            Miles de autónomos ya no pierden horas con el Modelo 303. Empieza gratis, sin tarjeta.
          </p>
          <Link
            href="/registro"
            className="inline-flex items-center gap-2 bg-white text-brand-blue font-bold px-8 py-4 rounded-xl hover:bg-brand-gray transition text-lg"
          >
            Crear cuenta gratuita <ArrowRight className="w-5 h-5" />
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
            <Link href="/herramientas" className="hover:text-brand-blue transition">Herramientas gratis</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
