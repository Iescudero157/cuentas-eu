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
    slug: "gastos-deducibles-autonomos-lista-completa",
    title: "Gastos Deducibles para Autónomos en España: Lista Completa 2025",
    excerpt:
      "Todo lo que puedes desgravar como autónomo: local, vehículo, material, software, seguros y más. Con ejemplos reales y cuánto te puedes ahorrar.",
    category: "Impuestos",
    readTime: "9 min",
    date: "2025-01-15",
    featured: true,
  },
  {
    slug: "modelo-303-iva-trimestral-guia",
    title: "Modelo 303: Guía Completa del IVA Trimestral para Autónomos 2025",
    excerpt:
      "Plazos, cálculos y cómo rellenarlo paso a paso. Aprende a calcular el IVA a ingresar (o a devolver) cada trimestre sin complicaciones.",
    category: "IVA",
    readTime: "11 min",
    date: "2025-01-10",
    featured: true,
  },
  {
    slug: "como-hacer-factura-autonomo-espana",
    title: "Cómo Hacer una Factura como Autónomo en España: Guía 2025",
    excerpt:
      "Datos obligatorios, numeración legal, cálculo de IVA y retención de IRPF. Todo lo que necesitas para emitir facturas válidas ante Hacienda.",
    category: "Facturación",
    readTime: "8 min",
    date: "2025-01-05",
    featured: true,
  },
];

const categoryColors: Record<string, string> = {
  Impuestos: "bg-amber-100 text-amber-700",
  IVA: "bg-blue-100 text-blue-700",
  Facturación: "bg-emerald-100 text-emerald-700",
  Gestión: "bg-purple-100 text-purple-700",
};

export default function BlogIndexPage() {
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

      {/* Articles grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/blog/${article.slug}`}
            className="group bg-white rounded-2xl border border-gray-100 hover:border-[#2A5AAE]/30 hover:shadow-lg transition overflow-hidden flex flex-col"
          >
            {/* Category banner */}
            <div className="h-2 bg-[#2A5AAE]" />

            <div className="p-6 flex flex-col flex-1">
              {/* Meta */}
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

      {/* CTA banner */}
      <div className="mt-16 rounded-2xl bg-gradient-to-br from-[#2A5AAE] to-[#1a3d7c] p-10 text-center text-white">
        <h2 className="text-2xl font-bold mb-3">
          ¿Cansado de calcular impuestos a mano?
        </h2>
        <p className="text-white/80 mb-6 max-w-lg mx-auto">
          KUENTAS.EU automatiza el IVA, el IRPF y la facturación para que tú te centres en tu
          negocio. Prueba gratis, sin tarjeta de crédito.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-white text-[#2A5AAE] font-bold px-6 py-3 rounded-xl hover:bg-white/90 transition"
        >
          Probar demo ahora <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
