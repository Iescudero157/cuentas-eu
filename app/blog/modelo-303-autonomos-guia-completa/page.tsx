import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, AlertCircle, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Modelo 303: el error que cometen el 73% de los autónomos (y cómo evitarlo)",
  description:
    "Guía completa del Modelo 303 para autónomos en 2025: qué es, plazos exactos, cómo rellenarlo paso a paso, errores más comunes y cómo automatizarlo con Kuentas.eu.",
  keywords: [
    "modelo 303 autonomo",
    "modelo 303 como rellenarlo",
    "modelo 303 iva trimestral",
    "errores modelo 303",
    "plazos modelo 303 2025",
    "iva trimestral autonomos 2025",
    "autoliquidacion iva autonomo",
  ],
  alternates: {
    canonical: "https://app.kuentas.eu/blog/modelo-303-autonomos-guia-completa",
  },
  openGraph: {
    title: "Modelo 303: el error que cometen el 73% de los autónomos",
    description:
      "Guía completa del Modelo 303: plazos 2025, cómo rellenarlo y los errores más frecuentes que cuestan dinero.",
    type: "article",
    publishedTime: "2025-05-01T00:00:00Z",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Modelo 303: el error que cometen el 73% de los autónomos",
    description: "Guía práctica del IVA trimestral para autónomos. Plazos, errores y automatización.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Modelo 303: el error que cometen el 73% de los autónomos (y cómo evitarlo)",
  description:
    "Guía completa del Modelo 303 para autónomos: qué es, plazos 2025, cómo rellenarlo paso a paso, errores comunes y automatización.",
  datePublished: "2025-05-01",
  dateModified: "2025-05-01",
  author: { "@type": "Organization", name: "KUENTAS.EU", url: "https://app.kuentas.eu" },
  publisher: {
    "@type": "Organization",
    name: "KUENTAS.EU",
    logo: { "@type": "ImageObject", url: "https://app.kuentas.eu/logo.png" },
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://app.kuentas.eu/blog/modelo-303-autonomos-guia-completa",
  },
  keywords: "modelo 303, autonomo, iva trimestral, hacienda, plazos 2025",
};

function Callout({ type, children }: { type: "tip" | "warning" | "danger"; children: React.ReactNode }) {
  const styles = {
    tip: "bg-blue-50 border border-blue-100",
    warning: "bg-amber-50 border border-amber-100",
    danger: "bg-red-50 border border-red-100",
  };
  const icons = {
    tip: <CheckCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
    danger: <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />,
  };
  return (
    <div className={`flex gap-3 rounded-xl p-4 my-6 ${styles[type]}`}>
      {icons[type]}
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

function InlineCTA() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#2A5AAE] to-[#1a3d7c] p-7 my-10 text-white">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">KUENTAS.EU</p>
      <h3 className="text-xl font-bold mb-3">¿Y si el Modelo 303 se calculara solo?</h3>
      <p className="text-white/80 text-sm leading-relaxed mb-5">
        Conecta tu banco, categoriza cada movimiento con IA y ten el IVA del trimestre preparado
        sin buscar facturas a último momento. Prueba gratis, sin tarjeta.
      </p>
      <Link
        href="https://app.kuentas.eu/registro"
        className="inline-flex items-center gap-2 bg-[#4ECB71] text-gray-900 text-sm font-bold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
      >
        Empezar gratis ahora <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

const plazos = [
  { trim: "1T (enero – marzo)", plazo: "Del 1 al 20 de abril de 2025", urgente: false },
  { trim: "2T (abril – junio)", plazo: "Del 1 al 20 de julio de 2025", urgente: false },
  { trim: "3T (julio – septiembre)", plazo: "Del 1 al 20 de octubre de 2025", urgente: false },
  { trim: "4T (octubre – diciembre)", plazo: "Del 1 al 30 de enero de 2026", urgente: true },
];

const erroresComunes = [
  {
    error: "Mezclar IVA repercutido y base imponible",
    detalle:
      "Uno de los más frecuentes: poner el importe total de la factura (base + IVA) en la casilla de IVA repercutido. La casilla pide solo el IVA, no la base. Si facturas 1.210 € (1.000 + 210 de IVA), en IVA repercutido va 210, no 1.210.",
    frecuencia: "Muy frecuente",
  },
  {
    error: "No incluir facturas de proveedores extranjeros",
    detalle:
      "Las plataformas como Adobe, Shopify o AWS facturan sin IVA a empresas fuera de su país. Pero tú tienes que declarar ese IVA por inversión del sujeto pasivo en las casillas 10/11 del 303. Muchos autónomos lo omiten.",
    frecuencia: "Frecuente",
  },
  {
    error: "Deducir el IVA de gastos personales o mixtos sin justificación",
    detalle:
      "El coche, el teléfono o el ordenador que también usas en casa son gastos mixtos. Solo puedes deducir el porcentaje de uso profesional. Si deduces el 100% sin justificarlo, Hacienda puede requerirte.",
    frecuencia: "Muy frecuente",
  },
  {
    error: "Presentar fuera de plazo el 4T",
    detalle:
      "El cuarto trimestre tiene plazo hasta el 30 de enero, no el 20. Muchos confunden la fecha y lo presentan tarde. La sanción empieza en el 5% de la cuota aunque sea un día tarde.",
    frecuencia: "Frecuente",
  },
  {
    error: "No guardar las facturas que justifican el IVA soportado",
    detalle:
      "Deducir IVA sin tener la factura que lo justifica es ilegal. En una inspección, si no puedes presentar el documento original, Hacienda te elimina esa deducción más los intereses.",
    frecuencia: "Crítico",
  },
];

export default function Modelo303GuiaCompletaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 mb-8 flex items-center gap-2" aria-label="Breadcrumb">
          <Link href="/blog" className="hover:text-[#2A5AAE] transition">
            Blog
          </Link>
          <span>/</span>
          <span className="text-gray-600">Modelo 303 — guía completa</span>
        </nav>

        {/* Meta badges */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
            IVA
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            12 min de lectura · Actualizado mayo 2025
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-5">
          Modelo 303: el error que cometen el 73% de los autónomos (y cómo evitarlo)
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed mb-10">
          Llegó el día 19 del mes. Abres la sede electrónica de la AEAT, miras los números y no
          estás seguro de si están bien. Eso, exactamente eso, es lo que le pasa a la mayoría de
          autónomos cada trimestre. Esta guía existe para que no vuelva a pasarte.
        </p>

        {/* Índice */}
        <nav className="bg-gray-50 rounded-2xl p-6 mb-12">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            En este artículo
          </p>
          <ol className="space-y-1.5 text-sm text-[#2A5AAE]">
            <li><a href="#que-es" className="hover:underline">1. Qué es el Modelo 303</a></li>
            <li><a href="#quien" className="hover:underline">2. Quién está obligado a presentarlo</a></li>
            <li><a href="#plazos" className="hover:underline">3. Plazos 2025</a></li>
            <li><a href="#calculo" className="hover:underline">4. Cómo calcular el IVA a pagar</a></li>
            <li><a href="#como-rellenarlo" className="hover:underline">5. Cómo rellenarlo paso a paso</a></li>
            <li><a href="#errores" className="hover:underline">6. Los cinco errores más frecuentes</a></li>
            <li><a href="#automatizar" className="hover:underline">7. Cómo automatizarlo con Kuentas</a></li>
            <li><a href="#faq" className="hover:underline">8. Preguntas frecuentes</a></li>
          </ol>
        </nav>

        {/* Qué es */}
        <section id="que-es" className="scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">¿Qué es el Modelo 303?</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            El Modelo 303 es la autoliquidación trimestral del IVA (Impuesto sobre el Valor
            Añadido). Cada tres meses, liquidas la diferencia entre el IVA que cobraste a tus
            clientes —llamado IVA repercutido— y el IVA que pagaste a tus proveedores —el IVA
            soportado deducible.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Si cobras más IVA del que pagas, la diferencia va a Hacienda. Si pasa al revés, puedes
            compensar ese saldo en trimestres siguientes o pedir la devolución al final del año.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            La trampa mental que lleva a muchos errores es esta: el IVA que cobras a tus clientes
            nunca fue tuyo. Actúas como recaudador de Hacienda. Si gastas ese dinero antes de
            liquidarlo, tendrás que ponerlo de tu bolsillo cuando llegue el trimestre.
          </p>
          <Callout type="tip">
            Reserva el IVA de cada factura en el momento en que la cobras, no cuando vence el
            trimestre. Una cuenta separada o una subcuenta de ahorro te ahorra más de un susto.
          </Callout>
        </section>

        {/* Quién */}
        <section id="quien" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            ¿Quién está obligado a presentar el Modelo 303?
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Todo autónomo o empresa que realice actividades sujetas a IVA en España. No importa si
            el resultado es a pagar, a compensar o a cero: la obligación de presentación existe en
            cualquier caso.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Quedan fuera los autónomos cuya actividad está exenta de IVA por ley: médicos,
            psicólogos, profesores particulares, servicios financieros y algunos artistas. Si tienes
            dudas sobre si tu actividad está exenta, el epígrafe del IAE al que perteneces es el
            primer sitio donde buscar.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Los autónomos en estimación objetiva (módulos) que aplican el régimen simplificado de
            IVA tienen un cálculo diferente: el IVA a ingresar se determina por módulos, no por las
            facturas reales.
          </p>
        </section>

        {/* Plazos */}
        <section id="plazos" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Plazos de presentación del Modelo 303 en 2025
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-[#2A5AAE]/5">
                <tr>
                  <th className="text-left py-3 px-5 text-gray-600 font-semibold">Trimestre</th>
                  <th className="text-left py-3 px-5 text-gray-600 font-semibold">
                    Plazo de presentación
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {plazos.map((p) => (
                  <tr key={p.trim} className={p.urgente ? "bg-amber-50" : "hover:bg-gray-50/50"}>
                    <td className="py-3 px-5 font-medium text-gray-900">{p.trim}</td>
                    <td
                      className={`py-3 px-5 font-semibold ${p.urgente ? "text-amber-700" : "text-gray-700"}`}
                    >
                      {p.plazo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout type="warning">
            <strong>Ojo con el 4T:</strong> el plazo es el 30 de enero, no el 20 como el resto de
            trimestres. Cada año hay autónomos que lo presentan tarde por esta confusión. El recargo
            mínimo por presentación extemporánea es del 5% de la cuota.
          </Callout>
          <p className="text-gray-600 leading-relaxed text-sm">
            Si el día 20 (o el 30) cae en fin de semana o festivo nacional, el plazo se traslada al
            siguiente día hábil. Comprobarlo en el calendario de la AEAT te evita sorpresas.
          </p>
        </section>

        {/* Cálculo */}
        <section id="calculo" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Cómo calcular el IVA a ingresar
          </h2>
          <div className="bg-[#2A5AAE]/5 border border-[#2A5AAE]/10 rounded-2xl p-6 my-6">
            <p className="text-center text-xl font-bold text-[#2A5AAE]">
              Resultado = IVA repercutido − IVA soportado deducible
            </p>
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-3 mt-6">IVA repercutido</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            Es el IVA que has cobrado en tus facturas emitidas durante el trimestre. Solo el IVA,
            no la base. Si emitiste facturas por 15.000 € de base al 21%, tu IVA repercutido es
            3.150 €.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mb-3">IVA soportado deducible</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            El IVA que pagaste en gastos de tu actividad y que tienes documentado con factura. Si
            pagaste 950 € de IVA en materiales, software y servicios de proveedores, ese es tu IVA
            soportado.
          </p>

          <div className="bg-gray-50 rounded-xl p-6 my-6">
            <p className="text-sm font-bold text-gray-900 mb-4">Ejemplo real — 2T 2025:</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Facturas emitidas (base)</span>
                <span className="font-medium">18.000 €</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IVA repercutido al 21%</span>
                <span className="font-semibold text-emerald-600">+ 3.780 €</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IVA soportado deducible</span>
                <span className="font-semibold text-red-500">− 950 €</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between text-gray-900 font-bold">
                <span>A ingresar a Hacienda</span>
                <span className="text-[#2A5AAE] text-base">2.830 €</span>
              </div>
            </div>
          </div>

          <Callout type="tip">
            Si el resultado es negativo —pagaste más IVA del que cobraste— puedes compensarlo en el
            siguiente trimestre o pedir la devolución en el 4T. La devolución no es automática: hay
            que marcarla explícitamente en la casilla correspondiente del Modelo 303.
          </Callout>
        </section>

        {/* Cómo rellenarlo */}
        <section id="como-rellenarlo" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Cómo rellenar el Modelo 303 paso a paso
          </h2>
          <ol className="list-none space-y-6">
            {[
              {
                n: "01",
                title: "Entra a la sede electrónica de la AEAT",
                desc: 'Accede a aeat.es con tu certificado digital, Cl@ve o DNI electrónico. Busca "Modelo 303" en el apartado de trámites o ve directamente al formulario online.',
              },
              {
                n: "02",
                title: "Rellena los datos de identificación",
                desc: "NIF, nombre o razón social, ejercicio (2025) y el trimestre que presentas. Verifica que el periodo es el correcto antes de continuar.",
              },
              {
                n: "03",
                title: "Introduce el IVA devengado por tipo",
                desc: "En las casillas del IVA devengado, introduce la base imponible y el IVA cobrado a clientes, separado por tipo impositivo: 21%, 10% y 4%. La plataforma calcula automáticamente la cuota.",
              },
              {
                n: "04",
                title: "Introduce el IVA deducible",
                desc: "Las cuotas de IVA de tus facturas de gastos. Solo las deducibles: las relacionadas directamente con tu actividad y que estén respaldadas por factura completa.",
              },
              {
                n: "05",
                title: "Revisa el resultado y decide",
                desc: "Si el resultado es positivo, pagas. Si es negativo, decides si compensas en el siguiente trimestre o solicitas devolución (solo disponible en el 4T). Revisa que los números cuadren con tu libro de facturas.",
              },
              {
                n: "06",
                title: "Presenta y paga",
                desc: "Presenta electrónicamente. Si tienes que pagar, puedes hacerlo en el momento con cargo a cuenta o generar un NRC en tu banco y pagar antes de presentar.",
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

        <InlineCTA />

        {/* Errores comunes */}
        <section id="errores" className="mt-4 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Los cinco errores del Modelo 303 que más dinero cuestan
          </h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            No son los errores más raros ni los más técnicos. Son los más frecuentes, los que se
            repiten cada trimestre y los que generan requerimientos de Hacienda que nadie quiere
            recibir.
          </p>
          <div className="space-y-5">
            {erroresComunes.map((e, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="font-bold text-gray-900 leading-snug">{e.error}</h3>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                      e.frecuencia === "Crítico"
                        ? "bg-red-100 text-red-700"
                        : e.frecuencia === "Muy frecuente"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {e.frecuencia}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{e.detalle}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Automatizar */}
        <section id="automatizar" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Cómo dejar de sufrir cada trimestre: la alternativa al caos de facturas
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            El problema de fondo no es el Modelo 303 en sí: es que la mayoría de autónomos llevan
            las cuentas de forma reactiva. Esperan al trimestre, buscan todas las facturas de tres
            meses, calculan a mano y rezan para no haberse olvidado de nada.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            La alternativa es llevar el IVA al día, de forma automática. Cuando cada factura se
            registra en el momento, tienes visibilidad constante de cuánto debes a Hacienda antes de
            que llegue el plazo. Puedes reservar ese dinero. Y cuando llega el día 19, solo tienes
            que revisar y presentar.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            KUENTAS.EU conecta tu banco y categoriza cada movimiento con IA. El IVA repercutido y el
            soportado se calculan en tiempo real. Cada trimestre tienes un resumen listo antes de
            que ni pienses en la AEAT.
          </p>

          <div className="rounded-2xl bg-[#4ECB71]/10 border border-[#4ECB71]/30 p-6 my-6">
            <p className="text-sm font-semibold text-gray-800 mb-1">Lo que ves en tu cuenta de Kuentas cada día:</p>
            <ul className="space-y-2 mt-3">
              {[
                "IVA repercutido acumulado este trimestre: 2.310 €",
                "IVA soportado deducible: 487 €",
                "Resultado estimado Modelo 303: 1.823 €",
                "Próximo plazo: 20 de julio",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-[#4ECB71] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Preguntas frecuentes sobre el Modelo 303
          </h2>
          <div className="space-y-5">
            {[
              {
                q: "¿Qué pasa si presento el Modelo 303 fuera de plazo?",
                a: "Si lo presentas antes de que Hacienda te requiera, el recargo es del 5% (hasta 3 meses tarde), 10% (hasta 6 meses) o 15% (más de 6 meses), más intereses de demora. Si Hacienda te requiere primero, se convierte en infracción tributaria con multa de entre el 50% y el 150% de la cuota.",
              },
              {
                q: "¿Puedo aplazar el pago del IVA?",
                a: "Sí, y se tramita desde la misma sede electrónica al presentar el modelo. Para deudas inferiores a 30.000 € suele concederse automáticamente. Genera intereses de demora, así que solo tiene sentido si realmente no tienes liquidez ese mes.",
              },
              {
                q: "¿Qué diferencia hay entre el Modelo 303 y el Modelo 390?",
                a: "El 303 es trimestral y liquidas el IVA. El 390 es el resumen anual informativo: no implica pago, solo informa del total del año. Los autónomos en SII (Suministro Inmediato de Información) están exentos del 390.",
              },
              {
                q: "Tengo una factura de un proveedor de fuera de la UE (por ejemplo, Adobe). ¿Cómo la declaro?",
                a: "Los servicios de empresas extranjeras no miembros de la UE que se prestan en España tributan por inversión del sujeto pasivo. Tú calculas el IVA equivalente, lo pones en las casillas 10 y 11 del 303 (lo que repercutes y lo que deduces se compensan si el gasto es 100% deducible, resultando en cero impacto neto).",
              },
              {
                q: "¿Puedo deducir el IVA de una comida de negocios?",
                a: "Solo si tienes factura completa (no ticket), el cliente está identificado y puedes demostrar que tiene relación directa con la actividad. Hacienda acepta la deducción del IVA de gastos de representación pero aplica la regla del 50% en algunos casos. Guarda siempre la factura completa.",
              },
            ].map((faq) => (
              <div key={faq.q} className="border border-gray-100 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-br from-[#2A5AAE] to-[#1a3d7c] p-8 text-white text-center">
          <h3 className="text-xl font-bold mb-3">
            El próximo trimestre, sin el estrés del día 19
          </h3>
          <p className="text-white/80 text-sm leading-relaxed mb-6 max-w-md mx-auto">
            Kuentas calcula tu IVA en tiempo real, categoriza tus gastos con IA y te avisa antes
            de cada plazo. Sin sorpresas, sin carreras de última hora.
          </p>
          <Link
            href="https://app.kuentas.eu/registro"
            className="inline-flex items-center gap-2 bg-[#4ECB71] text-gray-900 font-bold px-6 py-3 rounded-xl hover:opacity-90 transition"
          >
            Probar Kuentas gratis <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Navigation */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4">
          <Link
            href="/blog/gastos-deducibles-autonomo-lista-completa"
            className="flex-1 border border-gray-100 rounded-xl p-4 hover:border-[#2A5AAE]/30 transition text-sm"
          >
            <p className="text-xs text-gray-400 mb-1">Siguiente artículo</p>
            <p className="font-semibold text-gray-900">Gastos deducibles: la lista completa →</p>
          </Link>
          <Link
            href="/blog/mejor-software-facturacion-autonomos-2025"
            className="flex-1 border border-gray-100 rounded-xl p-4 hover:border-[#2A5AAE]/30 transition text-sm text-right"
          >
            <p className="text-xs text-gray-400 mb-1">También te interesa</p>
            <p className="font-semibold text-gray-900">Mejor software de facturación 2025 →</p>
          </Link>
        </div>
      </article>
    </>
  );
}
