import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, TrendingUp, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Herramientas Gratuitas para Autónomos: Calculadoras de IVA e IRPF",
  description:
    "Calculadoras gratuitas para autónomos españoles: IVA de facturas, IRPF trimestral y más. Sin registro, sin instalación.",
  alternates: { canonical: "https://app.kuentas.eu/herramientas" },
};

const tools = [
  {
    href: "/herramientas/calculadora-iva",
    icon: Calculator,
    title: "Calculadora de IVA",
    desc: "Calcula base imponible, cuota de IVA y retención IRPF. Útil para preparar facturas o estimar el Modelo 303.",
    badge: "Más usada",
    badgeColor: "bg-[#2A5AAE]/10 text-[#2A5AAE]",
  },
  {
    href: "/herramientas/calculadora-irpf",
    icon: TrendingUp,
    title: "Estimador de IRPF trimestral",
    desc: "Estima el pago fraccionado del IRPF (Modelo 130) a partir de tus ingresos y gastos del trimestre.",
    badge: "Próximamente",
    badgeColor: "bg-gray-100 text-gray-500",
  },
];

export default function HerramientasIndexPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
          Herramientas gratuitas para autónomos
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Calculadoras online para autónomos españoles. Sin registro, sin trucos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group bg-white rounded-2xl border border-gray-100 hover:border-[#2A5AAE]/30 hover:shadow-md transition p-7 flex flex-col"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-[#2A5AAE]/10 rounded-xl flex items-center justify-center">
                <t.icon className="w-6 h-6 text-[#2A5AAE]" />
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${t.badgeColor}`}>
                {t.badge}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 group-hover:text-[#2A5AAE] transition mb-2">
              {t.title}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed flex-1">{t.desc}</p>
            <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-[#2A5AAE]">
              Abrir <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-14 rounded-2xl bg-[#2A5AAE] p-8 text-center text-white">
        <h2 className="text-xl font-bold mb-3">¿Necesitas algo más que una calculadora?</h2>
        <p className="text-white/80 text-sm mb-5 max-w-md mx-auto">
          KUENTAS.EU hace todo esto de forma automática: calcula el IVA de cada factura, estima el
          IRPF en tiempo real y te avisa antes de cada plazo fiscal.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-white text-[#2A5AAE] font-bold px-5 py-2.5 rounded-xl hover:bg-white/90 transition text-sm"
        >
          Probar demo gratis <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
