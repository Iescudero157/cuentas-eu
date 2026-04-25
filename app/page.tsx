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

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
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
                <li><a href="#" className="hover:text-white transition">Integraciones</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/privacidad" className="hover:text-white transition">Privacidad</a></li>
                <li><a href="#" className="hover:text-white transition">Términos</a></li>
                <li><a href="#" className="hover:text-white transition">Cookies</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Contacto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:hola@kuentas.eu" className="hover:text-white transition">hola@kuentas.eu</a></li>
                <li><a href="#" className="hover:text-white transition">Twitter/X</a></li>
                <li><a href="#" className="hover:text-white transition">LinkedIn</a></li>
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
