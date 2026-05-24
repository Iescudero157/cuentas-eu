import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight, AlertTriangle, Clock, TrendingDown, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "IVA Trimestral para Autónomos: Modelo 303 Automático | KUENTAS.EU",
  description:
    "Gestiona tu IVA trimestral sin errores y sin gestor. Kuentas calcula el Modelo 303 automáticamente con tus facturas. Prueba gratis.",
  keywords: [
    "iva trimestral autonomos",
    "modelo 303 automatico",
    "calcular iva autonomo",
    "declaracion iva trimestral",
    "gestión iva autonomo",
  ],
  alternates: { canonical: "https://app.kuentas.eu/iva-autonomos" },
  openGraph: {
    title: "IVA Trimestral para Autónomos: Modelo 303 Automático",
    description: "Olvídate del Modelo 303 manual. Kuentas lo prepara solo con tus facturas.",
    url: "https://app.kuentas.eu/iva-autonomos",
  },
};

const problemas = [
  { icon: Clock, text: "Horas calculando IVA soportado e IVA repercutido a mano cada trimestre" },
  { icon: AlertTriangle, text: "Miedo a cometer errores en el Modelo 303 y recibir sanciones de Hacienda" },
  { icon: TrendingDown, text: "Pagar más de lo necesario por no tener todos los gastos bien registrados" },
  { icon: FileText, text: "Depender del gestor para algo que se puede hacer en minutos con las herramientas correctas" },
];

const pasos = [
  { num: "01", titulo: "Sube o crea tus facturas", desc: "Introduce tus facturas de ingresos y gastos en Kuentas, o escanéalas con el OCR automático." },
  { num: "02", titulo: "Kuentas calcula el IVA", desc: "La app separa automáticamente el IVA soportado del repercutido y calcula la cuota diferencial." },
  { num: "03", titulo: "Revisa y presenta", desc: "Ve un resumen claro antes de presentar. Tú tienes el control; Kuentas hace los cálculos." },
];

const beneficios = [
  "IVA soportado y repercutido calculado automáticamente",
  "Modelo 303 preparado con los datos correctos cada trimestre",
  "Alertas antes de los plazos de presentación (enero, abril, julio, octubre)",
  "Histórico de todas tus declaraciones de IVA",
  "Sin errores de suma ni de categorización",
  "Funciona con cualquier tipo de IVA: 21%, 10%, 4%, 0%",
];

export default function IVAAutonomosPage() {
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
        <span className="inline-block bg-[#2A5AAE]/10 text-[#2A5AAE] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-5">
          IVA trimestral · Modelo 303
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
          Olvídate del Modelo 303 manual.<br />
          <span className="text-[#2A5AAE]">Kuentas lo genera automático.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-8">
          La app que calcula tu IVA trimestral con tus facturas y prepara el Modelo 303 sin que tengas que tocar una hoja de cálculo.
          Sin gestor. Sin errores. Sin sorpresas.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/registro"
            className="inline-flex items-center gap-2 bg-[#2A5AAE] text-white font-bold px-8 py-4 rounded-xl hover:opacity-90 transition text-lg"
          >
            Empieza gratis <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/precios"
            className="inline-flex items-center gap-2 border-2 border-gray-200 text-gray-700 font-semibold px-8 py-4 rounded-xl hover:border-[#2A5AAE]/40 transition text-lg"
          >
            Ver precios
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-400">Sin tarjeta · Plan gratuito disponible · Cancela cuando quieras</p>
      </section>

      {/* Problema */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">¿Te suena esto cada trimestre?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {problemas.map(({ icon: Icon, text }) => (
              <div key={text} className="bg-white rounded-xl border border-gray-100 p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">Cómo funciona en 3 pasos</h2>
          <p className="text-gray-500 text-center mb-12">De cero a tu declaración de IVA en menos de 10 minutos.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {pasos.map(({ num, titulo, desc }) => (
              <div key={num} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#2A5AAE]/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-extrabold text-[#2A5AAE]">{num}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{titulo}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="bg-[#2A5AAE] py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Todo lo que incluye la gestión de IVA en Kuentas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {beneficios.map((b) => (
              <div key={b} className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
                <CheckCircle className="w-5 h-5 text-white shrink-0 mt-0.5" />
                <span className="text-white text-sm leading-relaxed">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparativa */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">¿Por qué no seguir con el gestor?</h2>
          <p className="text-gray-500 mb-8">El gestor medio cobra entre €80 y €150 al mes a un autónomo. Solo por gestionar el IVA y las declaraciones trimestrales.</p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
              <p className="text-sm font-semibold text-red-700 mb-2">Gestoría tradicional</p>
              <p className="text-3xl font-extrabold text-red-600 mb-1">€1.800</p>
              <p className="text-xs text-red-400">de media al año</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
              <p className="text-sm font-semibold text-green-700 mb-2">Kuentas.eu</p>
              <p className="text-3xl font-extrabold text-green-600 mb-1">€9,99</p>
              <p className="text-xs text-green-400">al mes · sin permanencia</p>
            </div>
          </div>
          <Link
            href="/registro"
            className="inline-flex items-center gap-2 bg-[#2A5AAE] text-white font-bold px-8 py-4 rounded-xl hover:opacity-90 transition"
          >
            Empieza gratis hoy <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer simple */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
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
