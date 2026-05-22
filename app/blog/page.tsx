import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Tag } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog para Autónomos — Guías de IVA, IRPF y Gestión Financiera",
  description:
    "Artículos prácticos sobre impuestos, facturas y gestión financiera para autónomos españoles. Modelo 303, gastos deducibles, facturación y más.",
  alternates: { canonical: "https://app.kuentas.eu/blog" },
};

const articles = [
  {
    slug: "modelo-303-autonomos-guia-completa",
    title: "Modelo 303: el error que cometen el 73% de los autónomos (y cómo evitarlo)",
    excerpt:
      "Llegó el día 19 y no sabes si los números están bien. Esto le pasa a casi todos. Guía completa: qué es, plazos 2025, cómo rellenarlo y los cinco errores que más dinero cuestan.",
    category: "IVA",
    readTime: "12 min",
    date: "2025-05-01",
    featured: true,
  },
  {
    slug: "gastos-deducibles-autonomo-lista-completa",
    title: "Gastos deducibles del autónomo: la lista que tu gestor no te cuenta completa",
    excerpt:
      "Hay autónomos que pagan a Hacienda el doble de lo que deberían. No por fraude, sino porque no saben qué deducir. Vehículo, hogar, formación, software... con porcentajes reales.",
    category: "Impuestos",
    readTime: "14 min",
    date: "2025-05-10",
    featured: true,
  },
  {
    slug: "como-hacer-factura-correcta-espana",
    title: "Cómo hacer una factura correcta en 2025 (sin que Hacienda te llame)",
    excerpt:
      "Una factura incorrecta no es solo un papel mal hecho: puede costarle dinero a tu cliente y generarte un requerimiento. Los diez campos obligatorios y los errores que más problemas dan.",
    category: "Facturación",
    readTime: "10 min",
    date: "2025-05-05",
    featured: true,
  },
  {
    slug: "mejor-software-facturacion-autonomos-2025",
    title: "El mejor software de facturación para autónomos en 2025 (comparativa honesta)",
    excerpt:
      "He comparado los cinco principales: Kuentas, Holded, Billin, Contasimple y Suma. Precios reales, funciones que nadie te cuenta en los anuncios y cuál elegir según tu situación.",
    category: "Herramientas",
    readTime: "11 min",
    date: "2025-05-15",
    featured: true,
  },
  {
    slug: "gastos-deducibles-autonomos-lista-completa",
    title: "Gastos Deducibles para Autónomos en España: Lista Completa 2025",
    excerpt:
      "Todo lo que puedes desgravar como autónomo: local, vehículo, material, software, seguros y más. Con ejemplos reales y cuánto te puedes ahorrar.",
    category: "Impuestos",
    readTime: "9 min",
    date: "2025-01-15",
    featured: false,
  },
  {
    slug: "modelo-303-iva-trimestral-guia",
    title: "Modelo 303: Guía Completa del IVA Trimestral para Autónomos 2025",
    excerpt:
      "Plazos, cálculos y cómo rellenarlo paso a paso. Aprende a calcular el IVA a ingresar (o a devolver) cada trimestre sin complicaciones.",
    category: "IVA",
    readTime: "11 min",
    date: "2025-01-10",
    featured: false,
  },
  {
    slug: "como-hacer-factura-autonomo-espana",
    title: "Cómo Hacer una Factura como Autónomo en España: Guía 2025",
    excerpt:
      "Datos obligatorios, numeración legal, cálculo de IVA y retención de IRPF. Todo lo que necesitas para emitir facturas válidas ante Hacienda.",
    category: "Facturación",
    readTime: "8 min",
    date: "2025-01-05",
    featured: false,
  },
];

const categoryColors: Record<string, string> = {
  Impuestos: "bg-amber-100 text-amber-700",
  IVA: "bg-blue-100 text-blue-700",
  Facturación: "bg-emerald-100 text-emerald-700",
  Herramientas: "bg-purple-100 text-purple-700",
  Gestión: "bg-indigo-100 text-indigo-700",
};

export default function BlogIndexPage() {
  const featured = articles.filter((a) => a.featured);
  const rest = articles.filter((a) => !a.featured);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
      {/* Header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 bg-[#2A5AAE]/10 text-[#2A5AAE] text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
          <Tag className="w-4 h-4" /> Recursos para autónomos
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
          Guías prácticas para autónomos españoles
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          Sin tecnicismos ni letra pequeña. Todo lo que necesitas saber sobre impuestos, facturas y
          gestión financiera explicado con ejemplos reales.
        </p>
      </div>

      {/* Featured articles grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* First featured article — large card */}
        {featured[0] && (
          <Link
            href={`/blog/${featured[0].slug}`}
            className="group bg-gradient-to-br from-[#2A5AAE] to-[#1a3d7c] rounded-2xl p-7 hover:shadow-xl transition flex flex-col text-white md:col-span-2"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white">
                {featured[0].category}
              </span>
              <span className="flex items-center gap-1 text-xs text-white/60">
                <Clock className="w-3.5 h-3.5" />
                {featured[0].readTime}
              </span>
            </div>
            <h2 className="text-2xl font-bold leading-snug mb-3 flex-1">
              {featured[0].title}
            </h2>
            <p className="text-white/70 text-sm leading-relaxed mb-5">{featured[0].excerpt}</p>
            <div className="flex items-center justify-between mt-auto">
              <time className="text-xs text-white/50" dateTime={featured[0].date}>
                {new Date(featured[0].date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
              <span className="flex items-center gap-1 text-sm font-semibold text-[#4ECB71] group-hover:gap-2 transition-all">
                Leer artículo <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>
        )}

        {/* Remaining featured articles */}
        {featured.slice(1).map((article) => (
          <Link
            key={article.slug}
            href={`/blog/${article.slug}`}
            className="group bg-white rounded-2xl border border-gray-100 hover:border-[#2A5AAE]/30 hover:shadow-lg transition overflow-hidden flex flex-col"
          >
            <div className="h-2 bg-[#2A5AAE]" />
            <div className="p-6 flex flex-col flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${categoryColors[article.category] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {article.category}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  {article.readTime}
                </span>
              </div>

              <h2 className="text-lg font-bold text-gray-900 group-hover:text-[#2A5AAE] transition mb-3 leading-snug flex-1">
                {article.title}
              </h2>

              <p className="text-sm text-gray-500 leading-relaxed mb-5">{article.excerpt}</p>

              <div className="flex items-center justify-between mt-auto">
                <time className="text-xs text-gray-400" dateTime={article.date}>
                  {new Date(article.date).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
                <span className="flex items-center gap-1 text-sm font-semibold text-[#2A5AAE] group-hover:gap-2 transition-all">
                  Leer <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Rest of articles */}
      {rest.length > 0 && (
        <>
          <h2 className="text-xl font-bold text-gray-700 mt-14 mb-6">Más guías</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((article) => (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="group bg-white rounded-2xl border border-gray-100 hover:border-[#2A5AAE]/30 hover:shadow-lg transition overflow-hidden flex flex-col"
              >
                <div className="h-1.5 bg-gray-100" />
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${categoryColors[article.category] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {article.category}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      {article.readTime}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-gray-900 group-hover:text-[#2A5AAE] transition mb-3 leading-snug flex-1">
                    {article.title}
                  </h2>
                  <p className="text-sm text-gray-500 leading-relaxed mb-5">{article.excerpt}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <time className="text-xs text-gray-400" dateTime={article.date}>
                      {new Date(article.date).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                    <span className="flex items-center gap-1 text-sm font-semibold text-[#2A5AAE] group-hover:gap-2 transition-all">
                      Leer <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* CTA banner */}
      <div className="mt-16 rounded-2xl bg-gradient-to-br from-[#2A5AAE] to-[#1a3d7c] p-10 text-center text-white">
        <h2 className="text-2xl font-bold mb-3">¿Cansado de calcular impuestos a mano?</h2>
        <p className="text-white/80 mb-6 max-w-lg mx-auto">
          KUENTAS.EU automatiza el IVA, el IRPF y la facturación para que tú te centres en tu
          negocio. Prueba gratis, sin tarjeta de crédito.
        </p>
        <Link
          href="https://app.kuentas.eu/registro"
          className="inline-flex items-center gap-2 bg-[#4ECB71] text-gray-900 font-bold px-6 py-3 rounded-xl hover:opacity-90 transition"
        >
          Probar Kuentas gratis <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
