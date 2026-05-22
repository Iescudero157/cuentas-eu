import type { Metadata } from "next";

import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Cómo Hacer una Factura como Autónomo en España: Guía 2025",
  description:
    "Todos los datos obligatorios de una factura legal en España: numeración, IVA, retención IRPF y cómo enviarla. Con plantilla y ejemplos reales para autónomos.",
  keywords: [
    "como hacer una factura autonomo",
    "factura autonomo requisitos",
    "datos obligatorios factura españa",
    "numeracion facturas autonomo",
    "factura con iva y retencion irpf",
    "hacer factura autonomo gratis",
  ],
  alternates: {
    canonical: "https://app.kuentas.eu/blog/como-hacer-factura-autonomo-espana",
  },
  openGraph: {
    title: "Cómo Hacer una Factura como Autónomo: Guía Completa 2025",
    description: "Datos obligatorios, numeración, IVA, IRPF y cómo enviarla.",
    type: "article",
    publishedTime: "2025-01-05T00:00:00Z",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Cómo Hacer una Factura como Autónomo en España: Guía 2025",
  datePublished: "2025-01-05",
  dateModified: "2025-01-05",
  author: { "@type": "Organization", name: "KUENTAS.EU", url: "https://app.kuentas.eu" },
  publisher: { "@type": "Organization", name: "KUENTAS.EU", logo: "https://app.kuentas.eu/logo.png" },
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://app.kuentas.eu/blog/como-hacer-factura-autonomo-espana" },
};

const camposObligatorios = [
  { campo: "Número de factura", desc: "Correlativo y sin saltos. Ejemplo: F2025-001, F2025-002..." },
  { campo: "Fecha de expedición", desc: "Fecha en que se emite la factura (no necesariamente cuando se presta el servicio)." },
  { campo: "Datos del emisor", desc: "Tu nombre completo o razón social, NIF/CIF y dirección fiscal completa." },
  { campo: "Datos del destinatario", desc: "Nombre o razón social, NIF/CIF y dirección del cliente." },
  { campo: "Descripción del servicio", desc: "Descripción clara de los servicios o bienes facturados. Evita descripciones genéricas." },
  { campo: "Base imponible", desc: "Importe sin IVA. Es la cantidad sobre la que se aplica el porcentaje de IVA." },
  { campo: "Tipo impositivo de IVA", desc: "El porcentaje de IVA aplicado: 21%, 10%, 4% o 0%. Especificar siempre." },
  { campo: "Cuota de IVA", desc: "El importe resultante de aplicar el tipo de IVA a la base imponible." },
  { campo: "Total de la factura", desc: "Suma de base imponible + IVA − retención IRPF (si aplica)." },
];

export default function FacturaAutonomoPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 mb-8 flex items-center gap-2">
          <Link href="/blog" className="hover:text-[#2A5AAE] transition">Blog</Link>
          <span>/</span>
          <span className="text-gray-600">Cómo hacer una factura autónomo</span>
        </nav>

        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">Facturación</span>
          <span className="text-xs text-gray-400">8 min de lectura · Actualizado enero 2025</span>
        </div>

        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-5">
          Cómo Hacer una Factura como Autónomo en España: Guía Completa 2025
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed mb-10">
          Emitir facturas incorrectas es uno de los errores más comunes entre autónomos que
          empiezan. Una factura sin los datos obligatorios puede ser rechazada por el cliente o
          tener problemas con Hacienda. Esta guía te explica exactamente qué datos necesitas y cómo
          calcular IVA y retención IRPF.
        </p>

        {/* Datos obligatorios */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Datos obligatorios de una factura en España</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            El Reglamento de Facturación (RD 1619/2012) establece qué datos debe contener cualquier
            factura emitida en España para ser válida ante Hacienda. Si falta alguno, la factura no
            es deducible para tu cliente ni para ti.
          </p>
          <div className="space-y-3">
            {camposObligatorios.map((c, i) => (
              <div key={c.campo} className="flex gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#2A5AAE]/20 transition">
                <div className="w-7 h-7 rounded-full bg-[#2A5AAE] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-0.5">{c.campo}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Numeración */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">La numeración de facturas: cómo hacerlo bien</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            La ley exige que las facturas tengan un número correlativo y sin saltos dentro de cada
            serie. No puedes emitir la factura F2025-003 y luego la F2025-001 retroactivamente.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Puedes usar series diferentes (por ejemplo, una para clientes nacionales y otra para
            internacionales), pero cada serie debe ser correlativa internamente. El formato más
            habitual es <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">AAAA-NNN</code>{" "}
            (año + número secuencial): F2025-001, F2025-002, etc.
          </p>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-sm text-amber-700">
              <strong>Errores frecuentes:</strong> Usar el mismo número dos veces, dejar huecos en
              la numeración (pasar de 005 a 007), o reiniciar la numeración a mitad de año. Todos
              pueden ser indicios de fraude para Hacienda en caso de inspección.
            </p>
          </div>
        </section>

        {/* Cálculo */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Cómo calcular IVA y retención IRPF</h2>

          <h3 className="text-lg font-bold text-gray-900 mb-3">Los tipos de IVA en España</h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-5 text-gray-500 font-semibold">Tipo</th>
                  <th className="text-left py-3 px-5 text-gray-500 font-semibold">%</th>
                  <th className="text-left py-3 px-5 text-gray-500 font-semibold">Qué incluye</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { tipo: "General", pct: "21%", items: "Servicios, tecnología, diseño, consultoría, fotografía..." },
                  { tipo: "Reducido", pct: "10%", items: "Transporte de viajeros, hostelería, alimentos elaborados..." },
                  { tipo: "Superreducido", pct: "4%", items: "Pan, leche, medicamentos, libros, periódicos..." },
                  { tipo: "Exento", pct: "0%", items: "Servicios financieros, educación, sanidad, seguros..." },
                ].map((r) => (
                  <tr key={r.tipo} className="hover:bg-gray-50/50">
                    <td className="py-3 px-5 font-medium text-gray-900">{r.tipo}</td>
                    <td className="py-3 px-5 font-bold text-[#2A5AAE]">{r.pct}</td>
                    <td className="py-3 px-5 text-gray-600">{r.items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-3">La retención de IRPF</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            La retención de IRPF solo se aplica cuando facturas a una empresa o autónomo (no a
            particulares). Funciona como un anticipo del IRPF: el cliente te retiene un porcentaje
            que ingresa directamente a Hacienda en tu nombre.
          </p>
          <div className="space-y-3 mb-6">
            {[
              { tipo: "15% — Retención general", desc: "Si llevas más de 3 años de actividad o ya has facturado antes." },
              { tipo: "7% — Retención reducida", desc: "Durante el año de inicio y los dos siguientes. Debes indicarlo en la factura." },
            ].map((r) => (
              <div key={r.tipo} className="flex gap-3 items-start bg-gray-50 rounded-xl p-4">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{r.tipo}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Ejemplo de factura */}
          <h3 className="text-lg font-bold text-gray-900 mb-3">Ejemplo de factura completa</h3>
          <div className="bg-gray-50 rounded-2xl p-6 font-mono text-sm">
            <div className="space-y-1.5 text-gray-700">
              <p className="font-sans font-bold text-gray-900 mb-3">FACTURA F2025-007</p>
              <p>Carlos Martínez López · 12345678A</p>
              <p>Calle Gran Vía 42, 28013 Madrid</p>
              <div className="border-t border-gray-200 my-3" />
              <p>A: Empresa Cliente S.L. · B98765432</p>
              <div className="border-t border-gray-200 my-3" />
              <p>Servicios de desarrollo web — Enero 2025</p>
              <div className="border-t border-gray-200 my-3" />
              <div className="flex justify-between"><span>Base imponible:</span><span>2.000,00 €</span></div>
              <div className="flex justify-between text-emerald-700"><span>IVA 21%:</span><span>+ 420,00 €</span></div>
              <div className="flex justify-between text-red-500"><span>Retención IRPF 15%:</span><span>− 300,00 €</span></div>
              <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-gray-900">
                <span>TOTAL A COBRAR:</span><span>2.120,00 €</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            * La base imponible es 2.000€. El cliente te transfiere 2.120€ (base + IVA − retención). Los 300€ de retención ya los ingresó él a Hacienda.
          </p>
        </section>

        {/* Tipos de facturas */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Tipos de facturas que necesitas conocer</h2>
          <div className="space-y-4">
            {[
              {
                tipo: "Factura ordinaria",
                desc: "La factura estándar con todos los datos obligatorios. Es la que emitirás en la mayoría de casos cuando facturas a empresas.",
              },
              {
                tipo: "Factura simplificada (ticket)",
                desc: "Para ventas a particulares inferiores a 400€ (IVA incluido). No hace falta incluir los datos del destinatario. No es deducible para el receptor.",
              },
              {
                tipo: "Factura rectificativa",
                desc: "Para corregir errores en una factura ya emitida (importe incorrecto, datos erróneos, etc.). Debe hacer referencia a la factura original que corrige.",
              },
              {
                tipo: "Autofactura",
                desc: "En caso de inversión del sujeto pasivo (servicios de proveedores europeos sin NIF español), tú mismo emites la factura en tu nombre para declarar el IVA.",
              },
            ].map((t) => (
              <div key={t.tipo} className="border border-gray-100 rounded-xl p-5">
                <p className="font-semibold text-gray-900 mb-1">{t.tipo}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12">
          <div className="rounded-2xl bg-[#2A5AAE]/5 border border-[#2A5AAE]/10 p-7">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Crea facturas legales en segundos con KUENTAS.EU</h3>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">
              Sin preocuparte por la numeración ni los cálculos. Rellena los datos del cliente y
              del servicio, KUENTAS calcula IVA y retención automáticamente, genera la factura en
              PDF con numeración legal y la envía por email. Historial completo de cobros pendientes y pagados.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 bg-[#2A5AAE] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition">
                Crear mi primera factura <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/registro" className="inline-flex items-center justify-center gap-2 border-2 border-[#2A5AAE]/30 text-[#2A5AAE] text-sm font-semibold px-5 py-2.5 rounded-lg hover:border-[#2A5AAE] transition">
                Crear cuenta gratis
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Preguntas frecuentes sobre facturación</h2>
          <div className="space-y-5">
            {[
              {
                q: "¿Puedo emitir facturas a particulares sin retención de IRPF?",
                a: "Sí. La retención de IRPF solo se aplica cuando facturas a empresas o autónomos. Si tu cliente es un particular, no aplicas retención. Solo aplicas el IVA correspondiente.",
              },
              {
                q: "¿Cuánto tiempo tengo que guardar las facturas?",
                a: "La ley establece un período de conservación de 4 años (el plazo de prescripción tributaria). No obstante, en caso de pérdidas compensables que afecten a ejercicios posteriores, puede ser necesario conservarlas más tiempo. Lo prudente es guardar facturas durante al menos 5 años.",
              },
              {
                q: "¿Qué pasa si el cliente no me paga y ya declaré el IVA?",
                a: "Si un cliente no te paga, puedes recuperar el IVA ingresado mediante la modificación de la base imponible, pero hay requisitos estrictos: la deuda debe ser incobrable (generalmente tras 6 meses de mora para autónomos, o 1 año para empresas), y debes reclamarla fehacientemente. Para ello es fundamental conservar toda la documentación.",
              },
              {
                q: "¿Es obligatorio enviar facturas en PDF o puedo usar Word?",
                a: "No hay formato obligatorio. Puedes enviar la factura en PDF, Word, o incluso en papel. Lo importante es que contenga todos los datos obligatorios y que el receptor la pueda conservar. El PDF es el formato más recomendable por su integridad y fácil almacenamiento.",
              },
            ].map((faq) => (
              <div key={faq.q} className="border border-gray-100 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12">
          <Link href="/blog/modelo-303-iva-trimestral-guia" className="flex items-center gap-2 text-[#2A5AAE] font-semibold text-sm hover:underline">
            ← Volver: Guía completa del Modelo 303
          </Link>
        </div>
      </article>
    </>
  );
}
