import type { Metadata } from "next";

import Link from "next/link";
import { ArrowRight, CheckCircle, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Gastos Deducibles para Autónomos en España: Lista Completa 2025",
  description:
    "Lista completa de gastos deducibles para autónomos: local, vehículo, material, software, seguros y más. Con ejemplos reales de cuánto te puedes ahorrar en IVA e IRPF.",
  keywords: [
    "gastos deducibles autónomos",
    "que gastos puede deducir un autonomo",
    "gastos deducibles hacienda autónomo",
    "desgravaciones autónomos",
    "gastos deducibles irpf autonomo",
  ],
  alternates: {
    canonical: "https://app.kuentas.eu/blog/gastos-deducibles-autonomos-lista-completa",
  },
  openGraph: {
    title: "Gastos Deducibles para Autónomos: Lista Completa 2025",
    description:
      "Todo lo que puedes desgravar como autónomo. Con ejemplos y cuánto te ahorras.",
    type: "article",
    publishedTime: "2025-01-15T00:00:00Z",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Gastos Deducibles para Autónomos en España: Lista Completa 2025",
  description:
    "Lista completa de gastos deducibles para autónomos españoles: local, vehículo, material, software, seguros y más.",
  datePublished: "2025-01-15",
  dateModified: "2025-01-15",
  author: { "@type": "Organization", name: "KUENTAS.EU", url: "https://app.kuentas.eu" },
  publisher: { "@type": "Organization", name: "KUENTAS.EU", logo: "https://app.kuentas.eu/logo.png" },
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://app.kuentas.eu/blog/gastos-deducibles-autonomos-lista-completa" },
};

function Callout({ type, children }: { type: "tip" | "warning"; children: React.ReactNode }) {
  return (
    <div className={`flex gap-3 rounded-xl p-4 my-6 ${type === "tip" ? "bg-blue-50 border border-blue-100" : "bg-amber-50 border border-amber-100"}`}>
      {type === "tip"
        ? <CheckCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        : <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

const gastos = [
  {
    cat: "Local y oficina",
    items: [
      { name: "Alquiler de local comercial", ded: "100%", iva: "Sí" },
      { name: "Suministros oficina (luz, agua, internet) — uso profesional", ded: "100%", iva: "Sí" },
      { name: "Despacho en casa (% metros cuadrados dedicados)", ded: "Proporcional", iva: "Parcial" },
    ],
  },
  {
    cat: "Material y equipo",
    items: [
      { name: "Ordenador, monitor, teclado", ded: "100% si es uso profesional", iva: "Sí" },
      { name: "Teléfono móvil (uso profesional)", ded: "50% si uso mixto", iva: "50%" },
      { name: "Mobiliario de oficina", ded: "100%", iva: "Sí" },
    ],
  },
  {
    cat: "Software y servicios digitales",
    items: [
      { name: "Adobe, Figma, GitHub, apps de trabajo", ded: "100%", iva: "Sí" },
      { name: "Hosting y dominio", ded: "100%", iva: "Sí" },
      { name: "App de gestión financiera (KUENTAS.EU)", ded: "100%", iva: "Sí" },
      { name: "Servicios en la nube (Notion, Slack, Drive)", ded: "100%", iva: "Sí" },
    ],
  },
  {
    cat: "Vehículo",
    items: [
      { name: "Vehículo exclusivamente profesional", ded: "100%", iva: "Sí" },
      { name: "Vehículo de uso mixto (coche)", ded: "50% IRPF, 50% IVA", iva: "50%" },
      { name: "Gasolina y peajes (profesional)", ded: "50% si vehículo mixto", iva: "50%" },
    ],
  },
  {
    cat: "Formación",
    items: [
      { name: "Cursos y masters relacionados con tu actividad", ded: "100%", iva: "Sí" },
      { name: "Libros y publicaciones profesionales", ded: "100%", iva: "Sí" },
      { name: "Asistencia a congresos y ferias", ded: "100%", iva: "Sí" },
    ],
  },
  {
    cat: "Seguros y cuotas",
    items: [
      { name: "Cuota de autónomos (RETA)", ded: "100% en IRPF", iva: "No aplica" },
      { name: "Seguro de responsabilidad civil profesional", ded: "100%", iva: "No aplica" },
      { name: "Seguro médico (hasta 500€/persona)", ded: "100% en IRPF", iva: "No aplica" },
    ],
  },
  {
    cat: "Servicios profesionales",
    items: [
      { name: "Gestoría y asesoría fiscal", ded: "100%", iva: "Sí" },
      { name: "Abogado para asuntos del negocio", ded: "100%", iva: "Sí" },
      { name: "Diseñador, programador contratado", ded: "100%", iva: "Sí" },
    ],
  },
  {
    cat: "Marketing y comunicación",
    items: [
      { name: "Publicidad en Google Ads, Meta Ads", ded: "100%", iva: "Sí" },
      { name: "Web, logo, fotografía profesional", ded: "100%", iva: "Sí" },
      { name: "Tarjetas de visita, impresos", ded: "100%", iva: "Sí" },
    ],
  },
];

export default function GastosDeduciblesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 mb-8 flex items-center gap-2">
          <Link href="/blog" className="hover:text-[#2A5AAE] transition">Blog</Link>
          <span>/</span>
          <span className="text-gray-600">Gastos deducibles autónomos</span>
        </nav>

        {/* Category + meta */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Impuestos</span>
          <span className="text-xs text-gray-400">9 min de lectura · Actualizado enero 2025</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-5">
          Gastos Deducibles para Autónomos en España: Lista Completa 2025
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed mb-10">
          Cada año los autónomos españoles pagan de más a Hacienda porque no saben qué pueden
          desgravar. Esta guía te da la lista completa, con ejemplos reales y el porcentaje exacto
          que puedes deducir en IVA e IRPF.
        </p>

        {/* Intro */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">¿Qué es un gasto deducible para autónomos?</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Un gasto deducible es aquel que Hacienda acepta como gasto necesario para desarrollar tu
            actividad económica. Al desgravar ese gasto, reduces tu base imponible: pagas menos IRPF
            (Modelo 130) y recuperas el IVA soportado (Modelo 303).
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Para que Hacienda lo acepte, el gasto debe cumplir tres condiciones: estar vinculado a
            tu actividad, estar justificado con factura o ticket y estar contabilizado. Sin factura,
            no existe a efectos fiscales.
          </p>
          <Callout type="tip">
            <strong>Ejemplo práctico:</strong> Si tu actividad es desarrollo web y pagas 120€/mes de
            Adobe Creative Cloud, ese gasto te devuelve 25,20€ de IVA cada trimestre (21%) y reduce
            tu IRPF en unos 18€/mes (si tributas al 15%). En total, ese gasto de 120€ te cuesta
            realmente unos 77€ netos.
          </Callout>
        </section>

        {/* Main table */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Lista completa de gastos deducibles por categoría</h2>
          <div className="space-y-8">
            {gastos.map((grupo) => (
              <div key={grupo.cat}>
                <h3 className="text-lg font-bold text-[#2A5AAE] mb-3 border-b border-gray-100 pb-2">
                  {grupo.cat}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left py-2.5 px-4 text-gray-500 font-semibold rounded-tl-lg">Gasto</th>
                        <th className="text-center py-2.5 px-4 text-gray-500 font-semibold">% Deducible IRPF</th>
                        <th className="text-center py-2.5 px-4 text-gray-500 font-semibold rounded-tr-lg">IVA recuperable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {grupo.items.map((item) => (
                        <tr key={item.name} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-4 text-gray-700">{item.name}</td>
                          <td className="py-2.5 px-4 text-center font-medium text-gray-900">{item.ded}</td>
                          <td className={`py-2.5 px-4 text-center font-semibold ${item.iva === "Sí" ? "text-emerald-600" : item.iva === "No aplica" ? "text-gray-400" : "text-amber-600"}`}>
                            {item.iva}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Special cases */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Casos especiales que confunden a muchos autónomos</h2>

          <h3 className="text-lg font-bold text-gray-900 mb-3">La oficina en casa</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            Si trabajas desde casa, puedes deducir la parte proporcional de los suministros
            (electricidad, internet, agua) en función del porcentaje de metros cuadrados dedicados
            exclusivamente al trabajo. Ejemplo: si tu casa tiene 80 m² y usas 16 m² como despacho,
            puedes deducir el 20% de esos gastos.
          </p>
          <Callout type="warning">
            El IVA de la vivienda habitual <strong>no es deducible</strong> aunque trabajes desde
            casa. Solo lo es si el local está dado de alta como local de negocio y afecto
            exclusivamente a la actividad.
          </Callout>

          <h3 className="text-lg font-bold text-gray-900 mb-3 mt-8">El vehículo</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            Es uno de los puntos más conflictivos con Hacienda. Para la mayoría de autónomos que usan
            el coche de forma mixta (personal y profesional), Hacienda acepta deducir el 50% del IVA
            de forma objetiva. En IRPF, la deducción solo se aplica si demuestras afectación
            exclusiva a la actividad, lo que en la práctica es muy difícil de probar salvo para
            transportistas y agentes comerciales.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mb-3 mt-8">El seguro médico</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            Desde 2018, los autónomos pueden deducirse hasta <strong>500€ anuales</strong> por seguro
            médico privado del titular, cónyuge e hijos menores de 25 años. Si tienes algún familiar
            con discapacidad, el límite sube a 1.500€. Es una de las deducciones más infravaloradas.
          </p>
        </section>

        {/* How to register */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Cómo registrar tus gastos correctamente</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Muchos autónomos pierden deducciones simplemente por no llevar el registro al día.
            Hacienda puede pedirte justificantes de los últimos 4 años en cualquier momento, así que
            organizar los gastos trimestre a trimestre es imprescindible.
          </p>
          <ol className="list-decimal pl-6 space-y-3 text-gray-600 text-sm leading-relaxed">
            <li><strong>Guarda siempre la factura</strong>, no el ticket. El ticket solo vale para gastos menores (comidas de trabajo hasta ciertos límites).</li>
            <li><strong>Asegúrate de que la factura está a tu nombre y NIF</strong>. Si está a tu nombre personal sin NIF, no es válida.</li>
            <li><strong>Separa gastos personales y profesionales</strong>. Abre una cuenta bancaria específica para el negocio.</li>
            <li><strong>Registra cada gasto en el momento</strong>, no a final de trimestre. Así no se te escapa nada.</li>
          </ol>

          {/* CTA */}
          <div className="mt-8 rounded-2xl bg-[#2A5AAE]/5 border border-[#2A5AAE]/10 p-6">
            <p className="text-sm font-semibold text-[#2A5AAE] mb-2">¿Cansado de guardar facturas en carpetas?</p>
            <p className="text-sm text-gray-600 mb-4">
              KUENTAS.EU registra y categoriza automáticamente todos tus gastos desde el banco.
              Nada de Excel, nada de escáneres. Al final del trimestre, ya tienes el IVA calculado.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-[#2A5AAE] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
            >
              Probar gratis ahora <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Preguntas frecuentes</h2>
          <div className="space-y-5">
            {[
              {
                q: "¿Los gastos de comidas con clientes son deducibles?",
                a: "Sí, pero con matices. Las comidas de trabajo con clientes son deducibles al 100% en IRPF si están justificadas y tienen relación directa con la actividad. El IVA también es deducible. Sin embargo, Hacienda vigila este tipo de gastos de cerca, así que conserva siempre la factura con los datos del cliente.",
              },
              {
                q: "¿Puedo deducir una suscripción a Netflix si la uso para crear contenido?",
                a: "Depende. Si eres creador de contenido y puedes demostrar que Netflix es una herramienta de trabajo (inspiración, análisis de formatos), hay base legal para deducirla. No obstante, ante una inspección tendrás que justificarlo. Servicios claramente profesionales como Canva, Adobe o GitHub tienen mucho menos riesgo.",
              },
              {
                q: "¿Cuándo prescriben los gastos que no declaré?",
                a: "Hacienda puede revisar los últimos 4 años. Si no has deducido gastos que tenías derecho a deducir, puedes presentar declaraciones complementarias o rectificativas. Pasados 4 años, prescribe el derecho a reclamar.",
              },
              {
                q: "¿Los gastos de formación en el extranjero son deducibles?",
                a: "Sí, siempre que estén relacionados con tu actividad y tengas la factura correspondiente. Incluso los gastos de desplazamiento y alojamiento para asistir a una formación o congreso internacional son deducibles.",
              },
            ].map((faq) => (
              <div key={faq.q} className="border border-gray-100 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Conclusion */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Conclusión: no dejes dinero sobre la mesa</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Un autónomo medio que gana 40.000€ brutos al año puede tener gastos deducibles de entre
            6.000€ y 12.000€ si lleva bien las cuentas. Eso supone un ahorro real de entre 1.200€ y
            2.500€ en IRPF, más la recuperación del IVA soportado.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            La clave no es buscar gastos artificiales, sino asegurarte de que los gastos reales que
            ya tienes están bien registrados y declarados. Para eso, llevar las cuentas al día es
            imprescindible.
          </p>
          <Link
            href="/blog/modelo-303-iva-trimestral-guia"
            className="inline-flex items-center gap-2 text-[#2A5AAE] font-semibold text-sm hover:underline"
          >
            → Siguiente: Guía completa del Modelo 303 (IVA trimestral)
          </Link>
        </section>
      </article>
    </>
  );
}
