import type { Metadata } from "next";

import Link from "next/link";
import { ArrowRight, CheckCircle, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Modelo 303: Guía Completa del IVA Trimestral para Autónomos 2025",
  description:
    "Todo sobre el Modelo 303: quién lo presenta, plazos 2025, cómo calcular el IVA a pagar o devolver, y cómo rellenarlo paso a paso. Con ejemplos reales.",
  keywords: [
    "modelo 303",
    "modelo 303 iva",
    "como rellenar modelo 303",
    "iva trimestral autonomos",
    "modelo 303 plazos 2025",
    "iva repercutido soportado",
  ],
  alternates: {
    canonical: "https://app.kuentas.eu/blog/modelo-303-iva-trimestral-guia",
  },
  openGraph: {
    title: "Modelo 303: Guía del IVA Trimestral para Autónomos 2025",
    description: "Plazos, cálculos y cómo rellenarlo. Todo sobre el IVA trimestral.",
    type: "article",
    publishedTime: "2025-01-10T00:00:00Z",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Modelo 303: Guía Completa del IVA Trimestral para Autónomos 2025",
  datePublished: "2025-01-10",
  dateModified: "2025-01-10",
  author: { "@type": "Organization", name: "KUENTAS.EU", url: "https://app.kuentas.eu" },
  publisher: { "@type": "Organization", name: "KUENTAS.EU", logo: "https://app.kuentas.eu/logo.png" },
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://app.kuentas.eu/blog/modelo-303-iva-trimestral-guia" },
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

const plazos = [
  { trim: "1T (enero – marzo)", plazo: "Del 1 al 20 de abril", urgente: false },
  { trim: "2T (abril – junio)", plazo: "Del 1 al 20 de julio", urgente: false },
  { trim: "3T (julio – septiembre)", plazo: "Del 1 al 20 de octubre", urgente: false },
  { trim: "4T (octubre – diciembre)", plazo: "Del 1 al 30 de enero del año siguiente", urgente: true },
];

export default function Modelo303Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 mb-8 flex items-center gap-2">
          <Link href="/blog" className="hover:text-[#2A5AAE] transition">Blog</Link>
          <span>/</span>
          <span className="text-gray-600">Modelo 303 — IVA trimestral</span>
        </nav>

        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">IVA</span>
          <span className="text-xs text-gray-400">11 min de lectura · Actualizado enero 2025</span>
        </div>

        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-5">
          Modelo 303: Guía Completa del IVA Trimestral para Autónomos 2025
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed mb-10">
          El Modelo 303 es la declaración trimestral de IVA que casi todos los autónomos y empresas
          están obligados a presentar. En esta guía encontrarás todo: qué es, quién lo presenta,
          cómo calcularlo y los plazos exactos de 2025.
        </p>

        {/* Qué es */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">¿Qué es el Modelo 303?</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            El Modelo 303 es la autoliquidación trimestral del Impuesto sobre el Valor Añadido
            (IVA). A través de él, el autónomo liquida la diferencia entre el IVA que ha cobrado a
            sus clientes (IVA repercutido) y el IVA que ha pagado a sus proveedores (IVA soportado).
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Si has cobrado más IVA del que has pagado, el resultado es positivo y debes ingresarlo a
            Hacienda. Si has pagado más del que has cobrado, el resultado es a tu favor: puedes
            solicitar la devolución (al final del año, con el Modelo 303 del 4T) o compensarlo en
            trimestres posteriores.
          </p>
          <Callout type="tip">
            El IVA que cobras a tus clientes no es tuyo. Actúas como recaudador de Hacienda. Por
            eso es fundamental reservarlo desde que lo cobras y no gastarlo en el negocio.
          </Callout>
        </section>

        {/* Quién */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">¿Quién está obligado a presentar el Modelo 303?</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Están obligados a presentar el Modelo 303 todos los autónomos y empresas que realicen
            actividades sujetas a IVA en España, independientemente de si el resultado es a pagar, a
            compensar o a devolver.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            También debes presentarlo aunque no hayas tenido actividad durante el trimestre (el
            resultado será 0, pero la obligación formal persiste).
          </p>
          <p className="text-gray-600 leading-relaxed">
            <strong>Excepciones:</strong> Actividades exentas de IVA como educación, sanidad o
            servicios financieros no presentan Modelo 303. Los autónomos en estimación objetiva
            (módulos) con criterio de caja simplificado tienen un régimen especial.
          </p>
        </section>

        {/* Plazos */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Plazos de presentación del Modelo 303 en 2025</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-5 text-gray-500 font-semibold">Trimestre</th>
                  <th className="text-left py-3 px-5 text-gray-500 font-semibold">Plazo de presentación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {plazos.map((p) => (
                  <tr key={p.trim} className={p.urgente ? "bg-amber-50" : "hover:bg-gray-50/50"}>
                    <td className="py-3 px-5 font-medium text-gray-900">{p.trim}</td>
                    <td className={`py-3 px-5 font-semibold ${p.urgente ? "text-amber-700" : "text-gray-700"}`}>{p.plazo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout type="warning">
            El plazo del <strong>4T termina el 30 de enero</strong>, no el 20. Es el más largo pero
            también el que más gente olvida. Presentarlo con retraso conlleva recargos del 5%, 10% o
            15% según los meses de demora, más los intereses de demora.
          </Callout>
        </section>

        {/* Cálculo */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Cómo calcular el IVA a ingresar: la fórmula</h2>
          <div className="bg-[#2A5AAE]/5 border border-[#2A5AAE]/10 rounded-2xl p-6 my-6">
            <p className="text-center text-xl font-bold text-[#2A5AAE]">
              IVA a ingresar = IVA repercutido − IVA soportado deducible
            </p>
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-3">IVA repercutido</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            Es el IVA que has cobrado a tus clientes en tus facturas emitidas durante el trimestre.
            Si has emitido facturas por 10.000€ base + 21% IVA, tu IVA repercutido es 2.100€.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mb-3">IVA soportado deducible</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            Es el IVA que has pagado en tus facturas de proveedores y que es deducible (gastos
            relacionados con tu actividad). Si has pagado 800€ de IVA en gastos deducibles, tu IVA
            soportado es 800€.
          </p>

          <div className="bg-gray-50 rounded-xl p-6 my-6">
            <p className="text-sm font-bold text-gray-900 mb-4">Ejemplo trimestral real:</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Facturas emitidas (base)</span>
                <span className="font-medium">12.000 €</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IVA repercutido (21%)</span>
                <span className="font-semibold text-emerald-600">+ 2.520 €</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IVA soportado (gastos deducibles)</span>
                <span className="font-semibold text-red-500">− 630 €</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between text-gray-900 font-bold">
                <span>A ingresar a Hacienda</span>
                <span className="text-[#2A5AAE]">1.890 €</span>
              </div>
            </div>
          </div>

          <Callout type="tip">
            Si el resultado es negativo (más IVA soportado que repercutido), puedes{" "}
            <strong>compensarlo</strong> en los trimestres siguientes o{" "}
            <strong>solicitar la devolución</strong> en el Modelo 303 del 4T marcando la casilla de
            devolución.
          </Callout>
        </section>

        {/* Cómo rellenarlo */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Cómo rellenar el Modelo 303 paso a paso</h2>
          <ol className="list-none space-y-5">
            {[
              {
                n: "01",
                title: "Accede a la sede electrónica de la AEAT",
                desc: "Entra en aeat.es con tu certificado digital, Cl@ve PIN o DNI electrónico. Busca \"Modelo 303\" en el buscador de trámites.",
              },
              {
                n: "02",
                title: "Rellena los datos identificativos",
                desc: "NIF, nombre o razón social, ejercicio fiscal y trimestre que presentas.",
              },
              {
                n: "03",
                title: "Introduce el IVA devengado (repercutido)",
                desc: "Base imponible e IVA de tus facturas emitidas, separadas por tipo: 21%, 10% y 4%.",
              },
              {
                n: "04",
                title: "Introduce el IVA deducible (soportado)",
                desc: "Base e IVA de tus facturas recibidas por gastos deducibles. Incluye las cuotas de IVA de todos los proveedores con los que hayas trabajado.",
              },
              {
                n: "05",
                title: "Comprueba el resultado",
                desc: "La plataforma calcula automáticamente el IVA a ingresar, compensar o devolver. Revisa que los importes coincidan con tus registros.",
              },
              {
                n: "06",
                title: "Presenta y paga (si procede)",
                desc: "Si el resultado es a ingresar, puedes pagar en el momento con cargo en cuenta, mediante adeudo en cuenta o con NRC del banco.",
              },
            ].map((s) => (
              <li key={s.n} className="flex gap-5">
                <span className="w-9 h-9 rounded-full bg-[#2A5AAE] text-white text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {s.n}
                </span>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">{s.title}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Automatizar */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">El truco para no estresarte cada trimestre</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            La mayoría de autónomos llegan al 19 de cada trimestre sin saber exactamente cuánto
            deben pagar. El motivo es simple: no llevan las cuentas al día.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            La solución es conectar el banco a una herramienta que calcule el IVA de forma
            automática. Así sabes en todo momento cuánto tienes que pagar antes de que llegue el
            plazo, y puedes reservar el dinero con antelación.
          </p>

          <div className="rounded-2xl bg-[#2A5AAE]/5 border border-[#2A5AAE]/10 p-6">
            <p className="text-sm font-semibold text-[#2A5AAE] mb-2">KUENTAS.EU calcula tu IVA en tiempo real</p>
            <p className="text-sm text-gray-600 mb-4">
              Conecta tu banco y cada movimiento queda categorizado automáticamente. El Modelo 303
              se calcula solo, cada día. Al final del trimestre solo tienes que revisar y presentar.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-[#2A5AAE] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
            >
              Probar calculadora de IVA gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Preguntas frecuentes sobre el Modelo 303</h2>
          <div className="space-y-5">
            {[
              {
                q: "¿Qué pasa si no presento el Modelo 303 a tiempo?",
                a: "Si lo presentas fuera de plazo pero antes de que Hacienda te requiera, el recargo es del 5% (hasta 3 meses tarde), 10% (hasta 6 meses) o 15% (más de 6 meses), más intereses de demora. Si Hacienda te requiere antes de que presentes, se convierte en infracción tributaria con multa de entre el 50% y el 150% de la cuota.",
              },
              {
                q: "¿Puedo pedir aplazamiento del pago?",
                a: "Sí. El IVA es aplazable mediante solicitud a Hacienda. Sin embargo, para deudas inferiores a 30.000€, el aplazamiento generalmente se concede automáticamente. Eso sí, devengan intereses de demora del 4,0625% anual.",
              },
              {
                q: "¿Qué diferencia hay entre el Modelo 303 y el Modelo 390?",
                a: "El Modelo 303 es trimestral y liquidas el IVA. El Modelo 390 es el resumen anual informativo del IVA: no implica pago, solo informa a Hacienda del total del año. Los autónomos que presentan el 303 mensualmente o están en SII (Suministro Inmediato de Información) no están obligados a presentar el 390.",
              },
              {
                q: "¿Puedo deducir el IVA de una factura de un proveedor extranjero?",
                a: "Depende de si el proveedor está en la UE o fuera. Los servicios de empresas de la UE (como suscripciones de software europeo) suelen venir sin IVA y se declaran por inversión del sujeto pasivo en la casilla correspondiente del 303. Las facturas de empresas de fuera de la UE se rigen por reglas de importación.",
              },
            ].map((faq) => (
              <div key={faq.q} className="border border-gray-100 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-col sm:flex-row gap-4">
          <Link href="/blog/gastos-deducibles-autonomos-lista-completa" className="flex-1 border border-gray-100 rounded-xl p-4 hover:border-[#2A5AAE]/30 transition text-sm">
            <p className="text-xs text-gray-400 mb-1">Artículo anterior</p>
            <p className="font-semibold text-gray-900">← Gastos deducibles: lista completa</p>
          </Link>
          <Link href="/blog/como-hacer-factura-autonomo-espana" className="flex-1 border border-gray-100 rounded-xl p-4 hover:border-[#2A5AAE]/30 transition text-sm text-right">
            <p className="text-xs text-gray-400 mb-1">Siguiente artículo</p>
            <p className="font-semibold text-gray-900">Cómo hacer una factura →</p>
          </Link>
        </div>
      </article>
    </>
  );
}
