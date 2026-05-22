import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  CreditCard,
  BarChart3,
  FileText,
  Brain,
  Shield,
  Zap,
  Check,
  ArrowRight,
  ChevronDown,
  Star,
} from "lucide-react";
import LandingNav from "./_components/LandingNav";

export const metadata: Metadata = {
  title: "KUENTAS.EU — App Gestión Financiera con IA para Autónomos Españoles",
  description:
    "Conecta tu banco, calcula IVA y IRPF en tiempo real, crea facturas legales y predice tu cash flow. La app financiera pensada para autónomos españoles. Prueba gratis.",
  alternates: { canonical: "https://app.kuentas.eu" },
};

const features = [
  {
    icon: CreditCard,
    title: "Conexión bancaria automática",
    desc: "Conecta BBVA, Santander, CaixaBank y más vía Open Banking. Tus movimientos se importan solos.",
    color: "bg-brand-blue",
  },
  {
    icon: Brain,
    title: "IA que categoriza por ti",
    desc: "La inteligencia artificial clasifica tus gastos automáticamente. Tú solo revisas y confirmas.",
    color: "bg-purple-500",
  },
  {
    icon: BarChart3,
    title: "Impuestos en tiempo real",
    desc: "Sabes CADA DÍA cuánto guardar para el IVA (modelo 303) y el IRPF (modelo 130). Sin sorpresas.",
    color: "bg-amber-500",
  },
  {
    icon: FileText,
    title: "Facturas legales en segundos",
    desc: "Crea facturas con numeración legal, envía por email y controla cobros. Todo desde la app.",
    color: "bg-emerald-500",
  },
  {
    icon: Zap,
    title: "Cash Flow inteligente",
    desc: "Predice tu flujo de caja para los próximos 3 meses basándose en tus patrones reales.",
    color: "bg-orange-500",
  },
  {
    icon: Shield,
    title: "Alertas fiscales",
    desc: "Nunca más te pillan fuera de plazo. Alertas automáticas antes de cada fecha fiscal.",
    color: "bg-rose-500",
  },
];

const plans = [
  {
    name: "Gratis",
    price: "0",
    desc: "Para empezar",
    features: ["Dashboard básico", "5 facturas/mes", "Categorización manual", "Resumen mensual"],
    cta: "Empezar gratis",
    href: "/registro",
    highlighted: false,
  },
  {
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
    href: "/precios#autonomo",
    highlighted: true,
  },
  {
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
    href: "/precios#creator",
    highlighted: false,
  },
  {
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
    href: "mailto:hola@kuentas.eu",
    highlighted: false,
  },
];

const howItWorks = [
  {
    step: "01",
    emoji: "🏦",
    title: "Conecta tu banco",
    desc: "Open Banking regulado (PSD2). Solo lectura, tus credenciales nunca se almacenan. Listo en 2 minutos.",
  },
  {
    step: "02",
    emoji: "🤖",
    title: "La IA lo organiza todo",
    desc: "Cada movimiento queda categorizado automáticamente: gastos deducibles, ingresos, IVA pendiente.",
  },
  {
    step: "03",
    emoji: "📊",
    title: "Tú controlas, sin sorpresas",
    desc: "Dashboard en tiempo real: cuánto debes a Hacienda hoy, cuándo cobras, cómo va el mes.",
  },
];

const banks = ["BBVA", "Santander", "CaixaBank", "Sabadell", "Bankinter", "ING", "Openbank"];

const comparison = [
  { task: "Categorizar gastos", gestor: "Manual o lo haces tú", kuentas: "IA automática" },
  { task: "Calcular IVA trimestral", gestor: "Al final del trimestre", kuentas: "Diario, en tiempo real" },
  { task: "Alertas de plazos fiscales", gestor: "Depende de tu gestor", kuentas: "Automáticas, siempre" },
  { task: "Crear facturas legales", gestor: "Software aparte o PDF", kuentas: "Integrado en la app" },
  { task: "Coste mensual", gestor: "150 – 200 €/mes", kuentas: "Desde 9,99 €/mes" },
];

const testimonials = [
  {
    name: "Carlos M.",
    role: "Consultor IT · Madrid",
    text: "Antes perdía 3-4 horas al trimestre con el IVA en Excel. Ahora KUENTAS lo calcula en tiempo real. La conexión bancaria es lo mejor que he probado.",
    plan: "Plan Autónomo",
    rating: 5,
  },
  {
    name: "Laura S.",
    role: "Fotógrafa freelance · Barcelona",
    text: "No entiendo de contabilidad y no hace falta. La IA categoriza todo sola y me avisa cuando se acerca el modelo 130. Un alivio enorme.",
    plan: "Plan Autónomo",
    rating: 5,
  },
  {
    name: "Javier R.",
    role: "Creador de contenido · Valencia",
    text: "Tengo ingresos de YouTube, Twitch y Patreon en distintas monedas. Por fin una app que lo junta todo y me dice exactamente cuánto debo a Hacienda.",
    plan: "Plan Creator",
    rating: 5,
  },
];

const faqs = [
  {
    q: "¿Es seguro conectar mi banco?",
    a: "Sí. Utilizamos Open Banking regulado por el Banco de España bajo la directiva PSD2. Nunca almacenamos tus credenciales bancarias. El acceso es de solo lectura: podemos ver tus movimientos, pero nunca mover dinero.",
  },
  {
    q: "¿Necesito saber de contabilidad para usarlo?",
    a: "No. La IA categoriza automáticamente cada gasto e ingreso. Tú solo revisas y confirmas. Si algo no está bien categorizado, lo corriges con un clic y la IA aprende.",
  },
  {
    q: "¿Sustituye a mi gestoría?",
    a: "Para la gestión diaria del negocio, sí. Para la declaración de la Renta anual o situaciones complejas, recomendamos un asesor. KUENTAS.EU exporta todo preparado para que tu gestor tarde minutos, no horas.",
  },
  {
    q: "¿Qué pasa con mis datos si cancelo?",
    a: "Son tuyos siempre. Puedes exportar todo en CSV o PDF antes de cancelar. No conservamos datos personales después de 30 días de darte de baja.",
  },
  {
    q: "¿Funciona para todo tipo de autónomos?",
    a: "Sí: estimación directa simplificada y normal, y módulos. Cubre tanto el Régimen General como el Simplificado del IVA, con soporte para modelos 303 y 130.",
  },
];

const jsonLdSoftware = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KUENTAS.EU",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web, Android",
  url: "https://app.kuentas.eu",
  installUrl: "https://play.google.com/store/apps/details?id=eu.kuentas.app",
  description:
    "App con IA para autónomos españoles. Calcula IVA y IRPF en tiempo real, crea facturas legales, conecta tu banco y predice tu cash flow.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "9.99",
      priceCurrency: "EUR",
      billingDuration: "P1M",
    },
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "47",
    bestRating: "5",
  },
  featureList: [
    "Conexión bancaria Open Banking PSD2",
    "Categorización automática con IA",
    "Cálculo IVA tiempo real (Modelo 303)",
    "Cálculo IRPF (Modelo 130)",
    "Facturación legal",
    "Cash flow forecast 3 meses",
    "Alertas fiscales automáticas",
  ],
};

const jsonLdFaq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿Es seguro conectar mi banco a KUENTAS.EU?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí. Utilizamos Open Banking regulado por el Banco de España bajo la directiva PSD2. Nunca almacenamos tus credenciales bancarias. El acceso es de solo lectura.",
      },
    },
    {
      "@type": "Question",
      name: "¿Necesito saber de contabilidad para usar KUENTAS.EU?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. La IA categoriza automáticamente cada gasto e ingreso. Tú solo revisas y confirmas con un clic.",
      },
    },
    {
      "@type": "Question",
      name: "¿KUENTAS.EU sustituye a mi gestoría?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Para la gestión diaria del negocio, sí. Para la declaración de la Renta anual recomendamos un asesor. KUENTAS.EU exporta todo preparado para que tu gestor tarde minutos, no horas.",
      },
    },
    {
      "@type": "Question",
      name: "¿Cuánto cuesta KUENTAS.EU?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hay un plan gratuito para empezar. El plan Autónomo cuesta 9,99€/mes e incluye conexión bancaria, IA de categorización, impuestos en tiempo real y facturas ilimitadas.",
      },
    },
    {
      "@type": "Question",
      name: "¿Funciona para todo tipo de autónomos?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí. Cubre estimación directa simplificada y normal, y módulos. Soporta modelos 303 y 130 tanto en Régimen General como Simplificado.",
      },
    },
  ],
};

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "KUENTAS.EU",
  url: "https://app.kuentas.eu",
  logo: "https://app.kuentas.eu/logo.png",
  contactPoint: {
    "@type": "ContactPoint",
    email: "hola@kuentas.eu",
    contactType: "customer service",
    availableLanguage: "Spanish",
  },
  sameAs: [],
};

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSoftware) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }} />

      {/* Skip to content (accessibility) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-brand-blue focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Saltar al contenido principal
      </a>

      {/* Nav — client component with hamburger */}
      <LandingNav />

      <main id="main-content">
        {/* Hero */}
        <section className="relative overflow-hidden bg-white">
          <div className="absolute inset-0 bg-brand-blue opacity-[0.03]" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-28 pb-0 text-center relative">
            <div className="inline-flex items-center gap-2 bg-brand-blue/10 text-brand-blue text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
              Nuevo · Gestión financiera con IA para autónomos españoles
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-brand-text leading-tight max-w-4xl mx-auto">
              Tu gestoría con IA.{" "}
              <span className="text-brand-blue">Todas tus cuentas, en una app.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-brand-muted max-w-2xl mx-auto">
              Conecta tu banco, categoriza gastos con IA, estima impuestos en tiempo real, factura en
              segundos y predice tu cash flow. Diseñada para autónomos españoles.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="bg-brand-blue text-white font-semibold px-8 py-3.5 rounded-xl text-lg hover:opacity-90 transition flex items-center gap-2 shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
              >
                Probar demo gratis <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/registro"
                className="bg-white border-2 border-brand-border text-brand-text font-semibold px-8 py-3.5 rounded-xl text-lg hover:border-brand-blue/40 transition focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
              >
                Crear cuenta
              </Link>
            </div>
            <p className="mt-4 text-sm text-brand-muted">
              Sin tarjeta de crédito · Acceso inmediato a la demo
            </p>

            {/* Dashboard mockup */}
            <div className="mt-16 mx-auto max-w-4xl">
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-brand-border ring-1 ring-black/5">
                {/* Browser chrome */}
                <div className="bg-[#f0f2f5] border-b border-brand-border px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1.5 shrink-0">
                    <span className="block w-3 h-3 rounded-full bg-red-400" />
                    <span className="block w-3 h-3 rounded-full bg-yellow-400" />
                    <span className="block w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 bg-white rounded-md text-xs text-brand-muted border border-brand-border px-3 py-1 text-center max-w-xs mx-auto">
                    app.kuentas.eu/dashboard
                  </div>
                </div>
                {/* Dashboard UI */}
                <div className="bg-[#f8fafc] p-5 text-left">
                  {/* KPIs */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: "Ingresos · Abril", value: "4.850 €", badge: "+12% vs marzo", badgeColor: "text-emerald-600 bg-emerald-50" },
                      { label: "IVA a ingresar", value: "730 €", badge: "Modelo 303 · Jul", badgeColor: "text-amber-600 bg-amber-50" },
                      { label: "IRPF estimado", value: "485 €", badge: "Modelo 130 · Jul", badgeColor: "text-brand-blue bg-brand-blue/10" },
                    ].map((card) => (
                      <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-brand-border/60">
                        <p className="text-[11px] text-brand-muted font-medium uppercase tracking-wide">{card.label}</p>
                        <p className="text-2xl font-extrabold text-brand-text mt-1">{card.value}</p>
                        <span className={`inline-block text-[11px] font-semibold mt-2 px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                          {card.badge}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Transactions */}
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-brand-border/60">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-brand-text">Últimas transacciones</p>
                      <span className="text-xs text-brand-blue font-semibold">Ver todo →</span>
                    </div>
                    <div className="space-y-3">
                      {[
                        { name: "Cliente Inditex S.A.", cat: "Factura cobrada", amount: "+2.400,00 €", catColor: "bg-emerald-100 text-emerald-700" },
                        { name: "Amazon Business", cat: "Material oficina", amount: "-89,90 €", catColor: "bg-orange-100 text-orange-700" },
                        { name: "Vodafone España", cat: "Telecomunicaciones", amount: "-45,00 €", catColor: "bg-blue-100 text-blue-700" },
                      ].map((tx) => (
                        <div key={tx.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold ${tx.catColor}`}>
                              {tx.cat}
                            </span>
                            <span className="text-sm text-brand-text truncate">{tx.name}</span>
                          </div>
                          <span className={`text-sm font-bold shrink-0 ml-3 ${tx.amount.startsWith("+") ? "text-emerald-600" : "text-brand-text"}`}>
                            {tx.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Fade bottom edge */}
              <div className="h-12 bg-gradient-to-b from-transparent to-white -mt-12 relative z-10" />
            </div>
          </div>
        </section>

        {/* Bank logos strip */}
        <div className="border-y border-brand-border py-8 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs text-brand-muted uppercase tracking-widest font-semibold mb-5">
              Compatible con los principales bancos españoles
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-5">
              {banks.map((bank) => (
                <span
                  key={bank}
                  className="px-4 py-2 rounded-lg border border-brand-border bg-brand-gray text-sm font-semibold text-brand-muted hover:border-brand-blue/30 hover:text-brand-blue transition"
                >
                  {bank}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats: Datos de autónomos en España ── */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="inline-block bg-rose-50 text-rose-600 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest mb-4">
                El problema que resolvemos
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-brand-text">
                3,3 millones de autónomos en España<br className="hidden md:block" />
                merecen algo mejor
              </h2>
              <p className="mt-4 text-lg text-brand-muted max-w-2xl mx-auto">
                La burocracia fiscal lastra a los profesionales más dinámicos del país. Hasta ahora.
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  value: "3,3M",
                  label: "autónomos activos en España",
                  emoji: "👥",
                  accent: "text-brand-blue",
                  bg: "border-brand-blue/20 bg-brand-blue/[0.03]",
                },
                {
                  value: "180€",
                  label: "al mes de media en gestorías",
                  emoji: "💸",
                  accent: "text-rose-600",
                  bg: "border-rose-200 bg-rose-50/50",
                },
                {
                  value: "48 h",
                  label: "anuales perdidas en trámites fiscales",
                  emoji: "⏰",
                  accent: "text-amber-600",
                  bg: "border-amber-200 bg-amber-50/50",
                },
                {
                  value: "2.160€",
                  label: "ahorrados de media al año con KUENTAS.EU",
                  emoji: "💡",
                  accent: "text-emerald-600",
                  bg: "border-emerald-200 bg-emerald-50/50",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`rounded-2xl p-7 border-2 text-center transition hover:-translate-y-1 hover:shadow-md duration-200 ${s.bg}`}
                >
                  <div className="text-4xl mb-3">{s.emoji}</div>
                  <div className={`text-4xl md:text-5xl font-extrabold mb-2 ${s.accent}`}>{s.value}</div>
                  <p className="text-sm text-brand-muted leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── App Mobile: Descarga en Google Play ── */}
        <section id="app" className="relative overflow-hidden py-20 lg:py-28 bg-[#0d1f4e]">
          {/* Decorative background glows */}
          <div className="pointer-events-none absolute -top-48 -left-48 w-[700px] h-[700px] rounded-full bg-brand-blue/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-36 -right-24 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] rounded-full bg-brand-blue/10 blur-3xl" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">

              {/* Left: copy + CTA */}
              <div>
                <span className="inline-flex items-center gap-2 bg-white/10 text-white/90 text-sm font-semibold px-4 py-2 rounded-full mb-6 border border-white/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Aprobada y disponible en Google Play
                </span>

                <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-5">
                  Tus cuentas en el bolsillo.{" "}
                  <span className="text-emerald-400">Donde estés.</span>
                </h2>

                <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-lg">
                  Descarga la app oficial de KUENTAS.EU para Android y gestiona tus finanzas de
                  autónomo desde cualquier lugar: facturas, IVA, alertas fiscales y escáner de tickets.
                </p>

                <ul className="space-y-3 mb-10">
                  {[
                    "Escanea tickets con la cámara (OCR con IA)",
                    "Crea y envía facturas legales al instante",
                    "IVA e IRPF calculados en tiempo real",
                    "Alertas automáticas de vencimientos fiscales",
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-3 text-white/85 text-sm">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <a
                    href="https://play.google.com/store/apps/details?id=eu.kuentas.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3.5 bg-white text-gray-900 px-5 py-3.5 rounded-2xl hover:bg-gray-50 active:scale-95 transition shadow-2xl shadow-black/40 font-medium"
                    aria-label="Descargar KUENTAS.EU en Google Play"
                  >
                    {/* Google Play icon */}
                    <svg viewBox="0 0 24 24" className="w-7 h-7 shrink-0" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1.5 1.2C1.2 1.5 1 2 1 2.6v18.8c0 .6.2 1.1.5 1.4L2 23l10.5-10.5V12L2 1.5l-.5-.3z" fill="#01d0ea"/>
                      <path d="M16 16l-3.5-3.5V12L16 8.5l.4.2 4.1 2.3c1.2.7 1.2 1.8 0 2.5L16.4 15.8 16 16z" fill="#f9c11b"/>
                      <path d="M16.4 15.8L12.5 12 2 22.6c.4.4 1 .4 1.7.1l12.7-6.9z" fill="#21d25f"/>
                      <path d="M2 1.4C1.3 1.1.7 1.1.3 1.5l10.5 10.5L14.2 8.5 3.7 1.5C3.1 1.1 2.4 1.1 2 1.4z" fill="#f93d44"/>
                    </svg>
                    <div className="flex flex-col leading-tight">
                      <span className="text-[9px] text-gray-500 uppercase tracking-widest font-medium">Disponible en</span>
                      <span className="text-[17px] font-bold text-gray-900">Google Play</span>
                    </div>
                  </a>
                  <p className="text-white/40 text-xs leading-relaxed">
                    Descarga gratuita<br />
                    Android 8.0+ · App en español
                  </p>
                </div>
              </div>

              {/* Right: Phone mockup + QR code */}
              <div className="flex items-center justify-center gap-6 sm:gap-10 flex-col sm:flex-row">

                {/* CSS Phone mockup */}
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 rounded-[3rem] bg-brand-blue/60 blur-3xl scale-110 opacity-70" />
                  <div className="relative border-[3px] border-white/20 rounded-[3rem] overflow-hidden w-[172px] bg-white/10 backdrop-blur-sm shadow-2xl p-[5px]">
                    <div className="rounded-[2.5rem] overflow-hidden bg-[#f8fafc]">
                      {/* Status bar */}
                      <div className="bg-brand-blue px-4 pt-3.5 pb-2.5 flex items-center justify-between">
                        <span className="text-white font-black text-[9px] tracking-tight">KUENTAS.EU</span>
                        <div className="flex gap-1 items-center">
                          <span className="block w-1 h-1 rounded-full bg-white/50" />
                          <span className="block w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      </div>
                      {/* App content */}
                      <div className="p-3 space-y-2 min-h-[280px]">
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                          <p className="text-[7px] text-brand-muted font-semibold uppercase tracking-wide">Ingresos · Mayo</p>
                          <p className="text-[17px] font-extrabold text-brand-text leading-tight">4.850 €</p>
                          <span className="inline-flex items-center text-[7px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold mt-1">
                            ↑ +12% vs abril
                          </span>
                        </div>
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                          <p className="text-[7px] text-brand-muted font-semibold uppercase tracking-wide">IVA pendiente</p>
                          <p className="text-[17px] font-extrabold text-amber-600 leading-tight">730 €</p>
                          <span className="inline-flex items-center text-[7px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-bold mt-1">
                            Mod. 303 · 20 Jul
                          </span>
                        </div>
                        <div className="bg-brand-blue rounded-xl p-3 text-white">
                          <p className="text-[7px] font-bold opacity-75 mb-0.5">🔔 Próx. vencimiento</p>
                          <p className="text-[9px] font-extrabold">Modelo 303 · 20 Jul</p>
                        </div>
                        <div className="flex gap-1.5">
                          <div className="flex-1 bg-white rounded-xl p-2 border border-gray-100 text-center">
                            <p className="text-[7px] font-bold text-brand-text">+3 facturas</p>
                            <p className="text-[6px] text-brand-muted">este mes</p>
                          </div>
                          <div className="flex-1 bg-emerald-50 rounded-xl p-2 border border-emerald-100 text-center">
                            <p className="text-[7px] font-bold text-emerald-700">0 alertas</p>
                            <p className="text-[6px] text-emerald-600">pendientes</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* QR code card */}
                <div className="flex flex-col items-center">
                  <div className="bg-white rounded-2xl p-4 shadow-2xl ring-4 ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent("https://play.google.com/store/apps/details?id=eu.kuentas.app")}&bgcolor=ffffff&color=0d1f4e&margin=6&format=png`}
                      alt="Código QR para descargar KUENTAS.EU en Google Play"
                      width={160}
                      height={160}
                      className="rounded-lg block"
                    />
                  </div>
                  <p className="mt-3 text-white font-semibold text-sm text-center">Escanea para descargar</p>
                  <p className="mt-1 text-white/50 text-xs text-center">Apunta la cámara al código QR</p>
                  <div className="mt-3 flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/15">
                    <span className="text-[10px] text-white/60 font-medium">eu.kuentas.app</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-brand-text">
                Listo en 3 minutos, sin formación
              </h2>
              <p className="mt-4 text-lg text-brand-muted max-w-xl mx-auto">
                Sin importaciones manuales. Sin curva de aprendizaje. Sin contratos anuales.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              {howItWorks.map((s, i) => (
                <div key={s.step} className="relative text-center">
                  {i < howItWorks.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-[calc(50%+3rem)] right-[calc(-50%+3rem)] h-px bg-brand-border" />
                  )}
                  <div className="w-16 h-16 rounded-2xl bg-brand-blue text-3xl flex items-center justify-center mx-auto mb-5 shadow-lg relative z-10">
                    {s.emoji}
                  </div>
                  <div className="text-xs font-bold text-brand-blue/50 tracking-widest uppercase mb-2">
                    Paso {s.step}
                  </div>
                  <h3 className="text-lg font-bold text-brand-text mb-2">{s.title}</h3>
                  <p className="text-brand-muted text-sm leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 bg-brand-gray">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-brand-text">
                Todo lo que un autónomo necesita
              </h2>
              <p className="mt-4 text-lg text-brand-muted max-w-2xl mx-auto">
                Deja de perder tiempo con Excel y gestorías caras. KUENTAS.EU automatiza tu
                contabilidad.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition border border-brand-border/50"
                >
                  <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-5`}>
                    <f.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-brand-text mb-2">{f.title}</h3>
                  <p className="text-brand-muted text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl md:text-4xl font-bold text-brand-text">
                Planes simples, sin sorpresas
              </h2>
              <p className="mt-4 text-lg text-brand-muted">
                Empieza gratis. Paga solo cuando lo necesites.
              </p>
            </div>

            {/* Comparison table vs gestoría */}
            <div className="max-w-2xl mx-auto mb-14">
              <div className="overflow-hidden rounded-2xl border border-brand-border shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-gray">
                      <th className="text-left py-3 px-5 text-brand-muted font-semibold">Tarea</th>
                      <th className="py-3 px-5 text-brand-muted font-semibold text-center">Gestoría</th>
                      <th className="py-3 px-5 text-brand-blue font-bold text-center bg-brand-blue/5">
                        KUENTAS.EU
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((row, i) => (
                      <tr key={row.task} className={i % 2 === 0 ? "bg-white" : "bg-brand-gray/40"}>
                        <td className="py-3 px-5 font-medium text-brand-text">{row.task}</td>
                        <td className="py-3 px-5 text-brand-muted text-center">{row.gestor}</td>
                        <td className="py-3 px-5 text-center bg-brand-blue/[0.04]">
                          <span className="inline-flex items-center gap-1.5 text-brand-blue font-semibold">
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            {row.kuentas}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-center text-xs text-brand-muted mt-3">
                Ahorra hasta <strong className="text-brand-text">190€/mes</strong> frente a una gestoría tradicional
              </p>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl p-8 border-2 transition ${
                    plan.highlighted
                      ? "border-brand-blue shadow-xl shadow-brand-blue/10 relative"
                      : "border-brand-border hover:border-brand-blue/30"
                  }`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-blue text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                      MÁS POPULAR
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-brand-text">{plan.name}</h3>
                  <p className="text-sm text-brand-muted mt-1">{plan.desc}</p>
                  <div className="mt-4 mb-6">
                    <span className="text-4xl font-extrabold text-brand-text">{plan.price}</span>
                    <span className="text-brand-muted ml-1">€/mes</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-brand-text">
                        <Check className="w-4 h-4 text-brand-green mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 ${
                      plan.highlighted
                        ? "bg-brand-blue text-white hover:opacity-90"
                        : "bg-brand-gray text-brand-text hover:bg-brand-blue/10"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 bg-brand-gray">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-brand-text">
                Lo que dicen nuestros usuarios
              </h2>
              <p className="mt-4 text-lg text-brand-muted">
                Autónomos reales que gestionan sus finanzas con KUENTAS.EU
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((t) => (
                <div
                  key={t.name}
                  className="bg-white rounded-2xl p-8 shadow-sm border border-brand-border/50 flex flex-col"
                >
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-brand-text text-sm leading-relaxed flex-1">&ldquo;{t.text}&rdquo;</p>
                  <div className="mt-6 pt-5 border-t border-brand-border/50 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-brand-text text-sm">{t.name}</p>
                      <p className="text-xs text-brand-muted mt-0.5">{t.role}</p>
                    </div>
                    <span className="text-xs bg-brand-blue/10 text-brand-blue font-semibold px-2.5 py-1 rounded-full">
                      {t.plan}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-brand-text">Preguntas frecuentes</h2>
              <p className="mt-3 text-brand-muted">Lo que más nos preguntan antes de empezar.</p>
            </div>
            <div className="space-y-3">
              {faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group bg-brand-gray rounded-2xl border border-brand-border overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-4 p-6 cursor-pointer list-none font-semibold text-brand-text hover:text-brand-blue transition select-none">
                    {faq.q}
                    <ChevronDown className="w-5 h-5 text-brand-muted shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-6 pb-6 text-sm text-brand-muted leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-brand-blue">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Empieza a controlar tus finanzas hoy
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
              Di adiós a las sorpresas fiscales. Sin complicaciones, sin letra pequeña, sin permanencia.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-white text-brand-blue font-bold px-8 py-4 rounded-xl text-lg hover:bg-white/90 transition shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-blue"
              >
                Probar demo ahora <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/registro"
                className="inline-flex items-center gap-2 bg-transparent border-2 border-white/40 text-white font-semibold px-8 py-4 rounded-xl text-lg hover:border-white/70 transition focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-blue"
              >
                Crear cuenta gratis
              </Link>
            </div>
            <p className="mt-5 text-white/60 text-sm">Sin tarjeta de crédito · Cancela cuando quieras</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-brand-dark text-white/60 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Image src="/logo.png" alt="KUENTAS.EU" width={28} height={28} />
                <span className="text-white font-bold">KUENTAS.EU</span>
              </div>
              <p className="text-sm">
                Gestión financiera con IA para autónomos, freelancers y creadores.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Producto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition">Funcionalidades</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Precios</a></li>
                <li><Link href="/dashboard" className="hover:text-white transition">Demo gratis</Link></li>
                <li>
                  <a
                    href="https://play.google.com/store/apps/details?id=eu.kuentas.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition inline-flex items-center gap-1.5"
                  >
                    App Android
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Recursos</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/blog" className="hover:text-white transition">Blog autónomos</Link></li>
                <li><Link href="/herramientas/calculadora-iva" className="hover:text-white transition">Calculadora IVA</Link></li>
                <li><Link href="/blog/gastos-deducibles-autonomos-lista-completa" className="hover:text-white transition">Gastos deducibles</Link></li>
                <li><Link href="/blog/modelo-303-iva-trimestral-guia" className="hover:text-white transition">Guía Modelo 303</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacidad" className="hover:text-white transition">Privacidad</Link></li>
                <li><Link href="/terminos" className="hover:text-white transition">Términos</Link></li>
                <li><a href="mailto:hola@kuentas.eu" className="hover:text-white transition">hola@kuentas.eu</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-8 border-t border-white/10 text-sm text-center">
            &copy; {new Date().getFullYear()} KUENTAS.EU · MercadonetGlobal · Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
