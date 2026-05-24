import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight, Lightbulb, TrendingUp } from "lucide-react";

export const metadata: Metadata = {
  title: "Gastos Deducibles para Autónomos: 23 Deducciones que Debes Conocer | KUENTAS.EU",
  description:
    "Descubre los gastos que puedes deducir como autónomo en España. Kuentas detecta automáticamente tus deducciones para que pagues solo lo justo a Hacienda.",
  keywords: [
    "gastos deducibles autonomo",
    "que gastos puede deducir un autonomo",
    "deducciones fiscales autonomo",
    "gastos fiscales autonomo",
    "deducir gastos freelance",
  ],
  alternates: { canonical: "https://app.kuentas.eu/gastos-deducibles" },
  openGraph: {
    title: "Gastos Deducibles para Autónomos — 23 Deducciones",
    description: "La IA de Kuentas detecta las deducciones que muchos gestores pasan por alto.",
    url: "https://app.kuentas.eu/gastos-deducibles",
  },
};

const gastos = [
  { cat: "Suministros del hogar", items: ["Electricidad (porcentaje uso laboral)", "Internet y teléfono", "Agua (si aplica)"] },
  { cat: "Material de trabajo", items: ["Ordenador y periféricos", "Software y suscripciones", "Material de oficina"] },
  { cat: "Formación y desarrollo", items: ["Cursos y formaciones", "Libros y publicaciones", "Congresos y eventos"] },
  { cat: "Vehículo y desplazamientos", items: ["Combustible (actividades profesionales)", "Dietas y manutención", "Transporte público"] },
  { cat: "Servicios profesionales", items: ["Asesor fiscal o gestor (sí, es deducible)", "Abogado por temas laborales", "Publicidad y marketing"] },
  { cat: "Cuotas y seguros", items: ["Cuota de autónomo (Seguridad Social)", "Seguro de responsabilidad civil", "Seguro de salud (límite €500/año)"] },
];

const stats = [
  { valor: "€1.200", desc: "ahorro medio anual con deducciones correctas" },
  { valor: "23", desc: "tipos de gastos deducibles habituales" },
  { valor: "47%", desc: "de autónomos no deduce todos los gastos que podría" },
];

export default function GastosDeduciblesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-[#2A5AAE]">KUENTAS.EU</Link>
          <Link
            href="/registro"
            className="bg-[#2A5AAE] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition"
          >
            Prueba gratis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-5">
          Gastos deducibles · IRPF · Ahorro fiscal
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
          ¿Cuánto te estás dejando<br />
          <span className="text-[#2A5AAE]">de deducir cada año?</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-8">
          Muchos autónomos pagan más impuestos de los que deberían porque no registran todos sus gastos deducibles.
          Kuentas los detecta automáticamente y te ayuda a pagar solo lo justo.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/registro"
            className="inline-flex items-center gap-2 bg-[#2A5AAE] text-white font-bold px-8 py-4 rounded-xl hover:opacity-90 transition text-lg"
          >
            Descubrir mis deducciones <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/precios"
            className="inline-flex items-center gap-2 border-2 border-gray-200 text-gray-700 font-semibold px-8 py-4 rounded-xl hover:border-[#2A5AAE]/40 transition text-lg"
          >
            Ver planes
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-400">Sin tarjeta · Plan gratuito disponible · Sin permanencia</p>
      </section>

      {/* Stats */}
      <section className="bg-[#2A5AAE] py-12">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {stats.map(({ valor, desc }) => (
              <div key={valor}>
                <p className="text-4xl font-extrabold text-white mb-2">{valor}</p>
                <p className="text-white/70 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gastos */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Los 23 gastos deducibles más habituales</h2>
            <p className="text-gray-500">Si eres autónomo en España, estos son los gastos que deberías estar deduciendo. ¿Estás aprovechando todos?</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {gastos.map(({ cat, items }) => (
              <div key={cat} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#2A5AAE]/10 flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-[#2A5AAE]" />
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm">{cat}</h3>
                </div>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            * La deducibilidad de cada gasto depende de tu actividad y del porcentaje de uso profesional. Kuentas te ayuda a calcularlos correctamente.
          </p>
        </div>
      </section>

      {/* Cómo ayuda Kuentas */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Cómo Kuentas maximiza tus deducciones</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: TrendingUp, titulo: "Detección automática", desc: "La IA categoriza tus gastos y detecta los que son deducibles sin que tengas que revisar uno a uno." },
              { icon: CheckCircle, titulo: "Sin gastos olvidados", desc: "Kuentas te avisa si detecta patrones de gastos que normalmente deberías deducir pero que no están registrados." },
              { icon: Lightbulb, titulo: "Declaraciones optimizadas", desc: "Con todos los gastos correctamente registrados, tu Modelo 130 trimestral refleja lo que realmente debes pagar." },
            ].map(({ icon: Icon, titulo, desc }) => (
              <div key={titulo} className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#2A5AAE]/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-[#2A5AAE]" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{titulo}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Empieza a deducir lo que te corresponde</h2>
          <p className="text-gray-500 mb-8">
            De media, los autónomos que empiezan a usar Kuentas descubren €1.200 de gastos deducibles que no estaban registrando.
            El plan gratuito incluye categorización básica de gastos.
          </p>
          <Link
            href="/registro"
            className="inline-flex items-center gap-2 bg-[#2A5AAE] text-white font-bold px-10 py-4 rounded-xl hover:opacity-90 transition text-lg"
          >
            Prueba Kuentas gratis <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-sm text-gray-400">Plan gratuito · Sin tarjeta · Cancela cuando quieras</p>
        </div>
      </section>

      {/* Footer simple */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <span className="font-bold text-gray-500">KUENTAS.EU</span>
          <div className="flex gap-5">
            <Link href="/privacidad" className="hover:text-gray-600 transition">Privacidad</Link>
            <Link href="/terminos" className="hover:text-gray-600 transition">Términos</Link>
            <Link href="/precios" className="hover:text-gray-600 transition">Precios</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
