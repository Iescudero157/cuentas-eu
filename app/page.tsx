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
  Star,
} from "lucide-react";

const features = [
  {
    icon: CreditCard,
    title: "Conexion bancaria automatica",
    desc: "Conecta BBVA, Santander, CaixaBank y mas via Open Banking. Tus movimientos se importan solos.",
  },
  {
    icon: Brain,
    title: "IA que categoriza por ti",
    desc: "La inteligencia artificial clasifica tus gastos automaticamente. Tu solo revisas y confirmas.",
  },
  {
    icon: BarChart3,
    title: "Impuestos en tiempo real",
    desc: "Sabes CADA DIA cuanto guardar para el IVA (modelo 303) y el IRPF (modelo 130). Sin sorpresas.",
  },
  {
    icon: FileText,
    title: "Facturas legales en segundos",
    desc: "Crea facturas con numeracion legal, envia por email y controla cobros. Todo desde la app.",
  },
  {
    icon: Zap,
    title: "Cash Flow inteligente",
    desc: "Predice tu flujo de caja para los proximos 3 meses basandose en tus patrones reales.",
  },
  {
    icon: Shield,
    title: "Alertas fiscales",
    desc: "Nunca mas te pillan fuera de plazo. Alertas automaticas antes de cada fecha fiscal.",
  },
];

const plans = [
  {
    name: "Gratis",
    price: "0",
    desc: "Para empezar",
    features: ["Dashboard basico", "5 facturas/mes", "Categorizacion manual", "Resumen mensual"],
    cta: "Empezar gratis",
    highlighted: false,
  },
  {
    name: "Autonomo",
    price: "9,99",
    desc: "Todo lo que necesitas",
    features: [
      "Conexion bancaria",
      "IA categorizacion",
      "Estimacion impuestos",
      "Facturas ilimitadas",
      "Alertas fiscales",
      "Soporte prioritario",
    ],
    cta: "Empezar prueba gratis",
    highlighted: true,
  },
  {
    name: "Creator",
    price: "19,99",
    desc: "Para creadores de contenido",
    features: [
      "Todo de Autonomo",
      "YouTube, Twitch, Etsy...",
      "Multi-moneda",
      "Cash flow forecast",
      "Tax savings finder",
      "Dashboard creador",
    ],
    cta: "Empezar prueba gratis",
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
      "Export gestoria",
      "Account manager",
    ],
    cta: "Contactar ventas",
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="KUENTAS.EU" width={36} height={36} />
            <span className="text-xl font-bold text-gradient-brand">KUENTAS.EU</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-brand-muted">
            <a href="#features" className="hover:text-brand-blue transition">Funcionalidades</a>
            <a href="#pricing" className="hover:text-brand-blue transition">Precios</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-brand-text hover:text-brand-blue transition">
              Iniciar sesion
            </Link>
            <Link
              href="/registro"
              className="gradient-brand text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-brand opacity-5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center relative">
          <div className="inline-flex items-center gap-2 bg-brand-blue/10 text-brand-blue text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Star className="w-4 h-4" />
            App #1 para autonomos en Espana
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-brand-text leading-tight max-w-4xl mx-auto">
            Tu gestoria con IA.{" "}
            <span className="text-gradient-brand">Todas tus cuentas, en una app.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-brand-muted max-w-2xl mx-auto">
            Conecta tu banco, categoriza gastos con IA, estima impuestos en tiempo real, factura en
            segundos y predice tu cash flow. Disenada para autonomos espanoles.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="gradient-brand text-white font-semibold px-8 py-3.5 rounded-xl text-lg hover:opacity-90 transition flex items-center gap-2 shadow-lg shadow-brand-blue/25"
            >
              Probar demo gratis <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/registro"
              className="bg-white border-2 border-brand-border text-brand-text font-semibold px-8 py-3.5 rounded-xl text-lg hover:border-brand-blue/30 transition"
            >
              Crear cuenta
            </Link>
          </div>
          <p className="mt-4 text-sm text-brand-muted">
            Sin tarjeta de credito. Acceso inmediato a la demo.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-brand-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-brand-text">
              Todo lo que un autonomo necesita
            </h2>
            <p className="mt-4 text-lg text-brand-muted max-w-2xl mx-auto">
              Deja de perder tiempo con Excel y gestorias caras. KUENTAS.EU automatiza tu
              contabilidad.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition border border-brand-border/50"
              >
                <div className="w-12 h-12 rounded-xl gradient-brand flex items-center justify-center mb-5">
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
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-brand-text">
              Planes simples, sin sorpresas
            </h2>
            <p className="mt-4 text-lg text-brand-muted">
              Empieza gratis. Paga solo cuando lo necesites.
            </p>
          </div>
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
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-brand text-white text-xs font-bold px-4 py-1 rounded-full">
                    MAS POPULAR
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
                <Link
                  href="/registro"
                  className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition ${
                    plan.highlighted
                      ? "gradient-brand text-white hover:opacity-90"
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

      {/* CTA */}
      <section className="py-20 gradient-brand">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Empieza a controlar tus finanzas hoy
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            Unete a miles de autonomos que ya gestionan sus cuentas con IA. Sin complicaciones, sin
            letra pequena.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-white text-brand-blue font-bold px-8 py-4 rounded-xl text-lg hover:bg-white/90 transition shadow-lg"
          >
            Probar demo ahora <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

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
                Gestion financiera con IA para autonomos, freelancers y creadores.
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
                <li><a href="#" className="hover:text-white transition">Privacidad</a></li>
                <li><a href="#" className="hover:text-white transition">Terminos</a></li>
                <li><a href="#" className="hover:text-white transition">Cookies</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Contacto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:hola@cuentas.eu" className="hover:text-white transition">hola@cuentas.eu</a></li>
                <li><a href="#" className="hover:text-white transition">Twitter/X</a></li>
                <li><a href="#" className="hover:text-white transition">LinkedIn</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-8 border-t border-white/10 text-sm text-center">
            &copy; {new Date().getFullYear()} KUENTAS.EU - MercadonetGlobal. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
