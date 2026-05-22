import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, AlertCircle, Clock, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Cómo hacer una factura correcta en 2025 (sin que Hacienda te llame)",
  description:
    "Todos los requisitos legales de una factura correcta en España: datos obligatorios, numeración, IVA, retención IRPF y errores que activan inspecciones. Guía práctica para autónomos.",
  keywords: [
    "como hacer una factura correcta",
    "factura correcta autonomo",
    "requisitos factura legal españa 2025",
    "datos obligatorios factura",
    "factura con iva y retencion irpf",
    "numeracion facturas autonomo",
    "factura correcta hacienda",
  ],
  alternates: {
    canonical: "https://app.kuentas.eu/blog/como-hacer-factura-correcta-espana",
  },
  openGraph: {
    title: "Cómo hacer una factura correcta en 2025 (sin que Hacienda te llame)",
    description:
      "Datos obligatorios, numeración legal, IVA, IRPF y los errores que más provocan requerimientos de Hacienda.",
    type: "article",
    publishedTime: "2025-05-05T00:00:00Z",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cómo hacer una factura correcta en 2025",
    description:
      "Guía práctica: datos obligatorios, numeración, IVA, IRPF y los errores más comunes.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Cómo hacer una factura correcta en 2025 (sin que Hacienda te llame)",
  description:
    "Requisitos legales de una factura correcta en España: datos obligatorios, numeración, IVA, retención IRPF y errores frecuentes.",
  datePublished: "2025-05-05",
  dateModified: "2025-05-05",
  author: { "@type": "Organization", name: "KUENTAS.EU", url: "https://app.kuentas.eu" },
  publisher: {
    "@type": "Organization",
    name: "KUENTAS.EU",
    logo: { "@type": "ImageObject", url: "https://app.kuentas.eu/logo.png" },
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://app.kuentas.eu/blog/como-hacer-factura-correcta-espana",
  },
  keywords:
    "factura correcta, autonomo, datos obligatorios, iva, irpf, hacienda, factura legal",
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

const camposObligatorios = [
  {
    campo: "Número de factura",
    desc: "Correlativo y sin saltos dentro del año. Ejemplo: F2025-001, F2025-002... Si saltas un número, necesitas una explicación justificada.",
    obligatorio: true,
  },
  {
    campo: "Fecha de expedición",
    desc: "Cuándo emites la factura. Puede diferir de la fecha de prestación del servicio.",
    obligatorio: true,
  },
  {
    campo: "Datos del emisor",
    desc: "Tu nombre completo o razón social, NIF/CIF y dirección fiscal completa.",
    obligatorio: true,
  },
  {
    campo: "Datos del destinatario",
    desc: "Nombre o razón social, NIF/CIF y dirección del cliente. Obligatorio si el cliente es empresa o autónomo.",
    obligatorio: true,
  },
  {
    campo: "Descripción del servicio o bien",
    desc: "Qué has prestado o vendido. Evita descripciones genéricas como «servicios profesionales». Sé concreto.",
    obligatorio: true,
  },
  {
    campo: "Base imponible",
    desc: "El importe sin IVA. Es la cantidad sobre la que se calcula el porcentaje de IVA.",
    obligatorio: true,
  },
  {
    campo: "Tipo de IVA aplicado",
    desc: "El porcentaje: 21%, 10%, 4% o exento. Si hay varios tipos en la misma factura, detállalos por separado.",
    obligatorio: true,
  },
  {
    campo: "Cuota de IVA",
    desc: "El importe resultante de aplicar el tipo impositivo a la base.",
    obligatorio: true,
  },
  {
    campo: "Retención de IRPF (si aplica)",
    desc: "Solo cuando facturas a empresas o autónomos españoles. Lo habitual es el 15%. El primer año como autónomo puedes aplicar el 7%.",
    obligatorio: false,
  },
  {
    campo: "Total de la factura",
    desc: "Base imponible + IVA − retención IRPF. El importe que el cliente te va a pagar.",
    obligatorio: true,
  },
];

const erroresFactura = [
  {
    error: "Descripción demasiado vaga",
    detalle:
      "«Servicios prestados en enero» no describe nada. Si Hacienda lo revisa, no puede verificar si el gasto es deducible para tu cliente. Usa descripciones concretas: «Diseño de logotipo e identidad corporativa», «Mantenimiento web mes de enero».",
  },
  {
    error: "No aplicar retención IRPF cuando corresponde",
    detalle:
      "Si tu cliente es una empresa española y no aplicas el 15% de retención, estás poniendo en riesgo tu declaración de IRPF. El cliente te retendrá ese porcentaje de todas formas en el pago; no ponerlo en la factura genera descuadres.",
  },
  {
    error: "Numeración con saltos",
    detalle:
      "Si tienes F2025-001, F2025-002 y luego F2025-005, ¿qué pasó con la tres y la cuatro? En una inspección, esos huecos generan preguntas incómodas. La numeración debe ser correlativa y sin interrupciones.",
  },
  {
    error: "Guardar solo el PDF y no el original",
    detalle:
      "Hacienda puede requerir facturas de hasta cuatro años atrás. Si solo tienes el PDF y el sistema con el que la generaste ya no existe, puede ser un problema. Guarda siempre las facturas en un lugar seguro y con respaldo.",
  },
  {
    error: "Facturar a un cliente de la UE sin revisar las reglas del IVA intracomunitario",
    detalle:
      "Si facturas a una empresa de otro país de la UE, generalmente no aplicas IVA si tienen número VAT europeo. Si lo aplicas cuando no debes, o no lo aplicas cuando debes, el error puede costarte dinero en ambos casos.",
  },
];

function InlineCTA() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#2A5AAE] to-[#1a3d7c] p-7 my-10 text-white">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">KUENTAS.EU</p>
      <h3 className="text-xl font-bold mb-3">Facturas legales en menos de dos minutos</h3>
      <p className="text-white/80 text-sm leading-relaxed mb-5">
        Crea facturas con todos los datos obligatorios, numeración automática e IVA calculado. Tu
        cliente recibe el PDF por email y tú ya tienes el ingreso registrado en tus cuentas.
      </p>
      <Link
        href="https://app.kuentas.eu/registro"
        className="inline-flex items-center gap-2 bg-[#4ECB71] text-gray-900 text-sm font-bold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
      >
        Crear mi primera factura gratis <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

export default function FacturaCorrectaPage() {
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
          <span className="text-gray-600">Cómo hacer una factura correcta</span>
        </nav>

        {/* Meta badges */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Facturación
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            10 min de lectura · Actualizado mayo 2025
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-5">
          Cómo hacer una factura correcta en 2025 (sin que Hacienda te llame)
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed mb-10">
          Una factura incorrecta no es solo un papel mal hecho. Puede costarle dinero a tu
          cliente en deducciones rechazadas, generarte un requerimiento de Hacienda o dejarte sin
          cobrar si hay una disputa. Esto es lo que necesita una factura legal en España y los
          errores que más problemas dan.
        </p>

        {/* Índice */}
        <nav className="bg-gray-50 rounded-2xl p-6 mb-12">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            En este artículo
          </p>
          <ol className="space-y-1.5 text-sm text-[#2A5AAE]">
            <li><a href="#tipos" className="hover:underline">1. Tipos de factura que existen</a></li>
            <li><a href="#datos-obligatorios" className="hover:underline">2. Los diez datos obligatorios</a></li>
            <li><a href="#iva-irpf" className="hover:underline">3. IVA e IRPF: cómo calcularlos</a></li>
            <li><a href="#numeracion" className="hover:underline">4. La numeración y por qué importa</a></li>
            <li><a href="#ejemplos" className="hover:underline">5. Ejemplos de facturas reales</a></li>
            <li><a href="#errores" className="hover:underline">6. Cinco errores que provocan problemas</a></li>
            <li><a href="#conservar" className="hover:underline">7. Cuánto tiempo conservar las facturas</a></li>
          </ol>
        </nav>

        {/* Tipos */}
        <section id="tipos" className="scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Qué tipos de factura existen (y cuándo usar cada uno)
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            En España hay básicamente tres tipos de factura que necesitas conocer como autónomo:
          </p>
          <div className="space-y-4">
            <div className="border border-gray-100 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-[#2A5AAE] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-900 mb-1">Factura ordinaria</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    La más habitual. Incluye todos los datos obligatorios. Se usa para la mayoría
                    de operaciones con empresas y con particulares cuando el importe supera los
                    400 € (IVA incluido) o cuando el destinatario lo requiere.
                  </p>
                </div>
              </div>
            </div>
            <div className="border border-gray-100 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-[#2A5AAE] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-900 mb-1">Factura simplificada (antes: ticket)</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Para operaciones de menor cuantía con particulares, generalmente en comercio al
                    por menor, hostelería o transporte. No incluye los datos del destinatario.
                    Como autónomo que factura a empresas, rara vez la usarás.
                  </p>
                </div>
              </div>
            </div>
            <div className="border border-gray-100 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-[#2A5AAE] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-900 mb-1">Factura rectificativa</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Cuando hay un error en una factura ya emitida o hay que modificar el importe.
                    No se anula la original: se emite una rectificativa que hace referencia a la
                    factura que corrige.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Datos obligatorios */}
        <section id="datos-obligatorios" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Los diez datos obligatorios de una factura legal
          </h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            El Reglamento de Facturación (RD 1619/2012) es claro sobre qué debe contener una
            factura para ser válida ante Hacienda. Si falta alguno de estos campos, la factura no
            sirve como justificante deducible para tu cliente.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-[#2A5AAE]/5">
                <tr>
                  <th className="text-left py-3 px-5 text-gray-600 font-semibold">Campo</th>
                  <th className="text-left py-3 px-5 text-gray-600 font-semibold">Descripción</th>
                  <th className="text-left py-3 px-5 text-gray-600 font-semibold">Obligatorio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {camposObligatorios.map((c) => (
                  <tr key={c.campo} className="hover:bg-gray-50/50">
                    <td className="py-3 px-5 font-semibold text-gray-900 align-top whitespace-nowrap">
                      {c.campo}
                    </td>
                    <td className="py-3 px-5 text-gray-600 leading-relaxed">{c.desc}</td>
                    <td className="py-3 px-5 align-top">
                      {c.obligatorio ? (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                          Sí
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                          Condicional
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout type="warning">
            Si facturas a un cliente en la UE y quieres aplicar exención de IVA, también necesitas
            incluir el número VAT europeo del cliente y la mención «Exento IVA — Art. 25 LIVA» o
            el motivo de exención equivalente.
          </Callout>
        </section>

        {/* IVA e IRPF */}
        <section id="iva-irpf" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            IVA e IRPF: cómo calcularlos en la factura
          </h2>

          <h3 className="text-lg font-bold text-gray-900 mb-3">El IVA</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            El tipo general en España es el 21%. Hay tipos reducidos: 10% para ciertos servicios y
            alimentos, y 4% para productos de primera necesidad. Como autónomo de servicios, casi
            siempre aplicarás el 21%.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Hay actividades exentas de IVA —sanidad, educación, servicios financieros— donde no
            aplicas ningún tipo. Si tienes dudas sobre el tuyo, busca tu epígrafe del IAE.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mb-3 mt-6">La retención del IRPF</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            La retención no es un gasto tuyo: es un pago anticipado de tu IRPF anual que hace el
            cliente en tu nombre. Cuando presentas la declaración de renta, ese importe ya está
            pagado y lo descontarás.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            El tipo general es el <strong>15%</strong>. Durante los tres primeros años de actividad
            puedes aplicar el <strong>7%</strong> si ninguno de los dos últimos años tu rendimiento
            de actividad superó 15.000 € y representa más del 75% de tus rentas.
          </p>
          <Callout type="tip">
            La retención solo se aplica cuando facturas a <strong>empresas o autónomos españoles</strong>.
            Si tu cliente es un particular o una empresa extranjera, no aplicas retención de IRPF.
          </Callout>

          <div className="bg-gray-50 rounded-xl p-6 my-6">
            <p className="text-sm font-bold text-gray-900 mb-4">Ejemplo de factura completa:</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Base imponible (servicios de consultoría)</span>
                <span className="font-medium">2.000,00 €</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>+ IVA 21%</span>
                <span className="font-medium">420,00 €</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>− Retención IRPF 15%</span>
                <span className="font-semibold text-red-500">−300,00 €</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between text-gray-900 font-bold">
                <span>Total a cobrar</span>
                <span className="text-[#2A5AAE] text-base">2.120,00 €</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              * El cliente te ingresa 2.120 € y le retiene los 300 € de IRPF que pagará a
              Hacienda en su nombre.
            </p>
          </div>
        </section>

        {/* Numeración */}
        <section id="numeracion" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            La numeración de las facturas: por qué importa más de lo que parece
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            La ley exige que la numeración sea <strong>correlativa y sin saltos</strong> dentro de
            cada serie. No hay un formato obligatorio, pero sí reglas claras:
          </p>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[#4ECB71] shrink-0 mt-0.5" />
              <span>
                Puedes reiniciar la numeración cada año (F2025-001, F2026-001...) o mantenerla
                continua sin reinicio.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[#4ECB71] shrink-0 mt-0.5" />
              <span>
                Puedes tener series separadas si tienes actividades distintas o quieres separar las
                facturas rectificativas (serie R2025-001 para rectificativas).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[#4ECB71] shrink-0 mt-0.5" />
              <span>
                No puedes tener el mismo número en dos facturas ni saltar números sin justificación
                documentada.
              </span>
            </li>
          </ul>
          <Callout type="warning">
            Si usas Word o Excel para hacer facturas manualmente, el riesgo de saltarte un número
            o repetirlo es alto. Un software de facturación asigna el número automáticamente y no
            deja huecos.
          </Callout>
        </section>

        {/* Ejemplos */}
        <section id="ejemplos" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Cómo quedaría una factura correcta: dos ejemplos reales
          </h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            El primer caso es el más habitual para un autónomo que presta servicios a empresas
            españolas. El segundo, cómo cambia la factura cuando facturas a un particular.
          </p>

          {/* Ejemplo 1 */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden mb-6">
            <div className="bg-[#2A5AAE] px-6 py-4">
              <p className="text-white font-bold text-sm">
                FACTURA · Nº F2025-018
              </p>
            </div>
            <div className="p-6 text-sm text-gray-700 space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Emisor</p>
                  <p className="font-semibold">Carlos López García</p>
                  <p>NIF: 12345678A</p>
                  <p>C/ Mayor 14, 2ºA, Madrid 28001</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Cliente</p>
                  <p className="font-semibold">Empresa Demo SL</p>
                  <p>CIF: B87654321</p>
                  <p>Av. Diagonal 100, Barcelona 08008</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium mb-2">Desarrollo web — Sprint 3 (mayo 2025)</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Base imponible</span>
                    <span className="font-medium">3.500,00 €</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA 21%</span>
                    <span className="font-medium">735,00 €</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Retención IRPF 15%</span>
                    <span className="font-medium">−525,00 €</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-gray-900">
                    <span>TOTAL A COBRAR</span>
                    <span className="text-[#2A5AAE]">3.710,00 €</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400">Fecha expedición: 31/05/2025 · Fecha operación: mayo 2025</p>
            </div>
          </div>

          <Callout type="tip">
            Cuando facturas a un particular (persona física no empresaria), no aplicas retención
            de IRPF. El total sería 3.500 + 735 = <strong>4.235 €</strong>.
          </Callout>
        </section>

        <InlineCTA />

        {/* Errores */}
        <section id="errores" className="mt-4 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Cinco errores en facturas que provocan problemas con Hacienda
          </h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            No son los más raros. Son los más frecuentes, los que se repiten, y los que
            convierten una factura normal en un dolor de cabeza.
          </p>
          <div className="space-y-5">
            {erroresFactura.map((e, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-5">
                <div className="flex items-start gap-3 mb-2">
                  <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <h3 className="font-bold text-gray-900 leading-snug">{e.error}</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed pl-9">{e.detalle}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Conservar */}
        <section id="conservar" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Cuánto tiempo tienes que guardar las facturas
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            La ley general es <strong>cuatro años</strong> desde que vence el plazo para presentar
            la declaración en la que se usó esa factura. En la práctica, muchos asesores
            recomiendan guardarlas cinco o seis años por si las cuentas de algún año se revisan con
            retraso.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            No hace falta guardar papel. La AEAT acepta las facturas en formato digital siempre que
            se garantice su autenticidad e integridad. Un PDF almacenado en la nube cumple ese
            requisito.
          </p>
          <Callout type="tip">
            Crea una carpeta anual en la nube (Google Drive, Dropbox...) con todas tus facturas
            emitidas y recibidas, organizadas por trimestre. Tarda cinco minutos al mes y te puede
            ahorrar mucho tiempo si recibes un requerimiento.
          </Callout>
        </section>

        {/* Final CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-br from-[#2A5AAE] to-[#1a3d7c] p-8 text-white text-center">
          <h3 className="text-xl font-bold mb-3">
            Facturas correctas, sin errores y guardadas automáticamente
          </h3>
          <p className="text-white/80 text-sm leading-relaxed mb-6 max-w-md mx-auto">
            Kuentas genera facturas con todos los campos obligatorios, calcula el IVA y la
            retención en automático, asigna el número de serie y las archiva para ti. Sin errores
            y sin preocupaciones.
          </p>
          <Link
            href="https://app.kuentas.eu/registro"
            className="inline-flex items-center gap-2 bg-[#4ECB71] text-gray-900 font-bold px-6 py-3 rounded-xl hover:opacity-90 transition"
          >
            Crear mi primera factura gratis <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Preguntas frecuentes sobre facturas
          </h2>
          <div className="space-y-5">
            {[
              {
                q: "¿Puedo hacer una factura en Word o Excel?",
                a: "Técnicamente sí, siempre que incluya todos los campos obligatorios. El problema es la numeración correlativa, que es difícil de controlar manualmente, y el riesgo de cometer errores. Un software de facturación lo hace automático y evita problemas.",
              },
              {
                q: "¿Cuándo puedo aplicar el 7% de retención IRPF en lugar del 15%?",
                a: "Durante los tres primeros años de actividad, si en los dos ejercicios anteriores tus rendimientos de la actividad fueron inferiores a 15.000 € y representaron más del 75% de tus rentas. Debes indicar en la factura que aplicas el tipo reducido del inicio de actividad.",
              },
              {
                q: "¿Qué hago si me equivoco en una factura ya enviada?",
                a: "Emites una factura rectificativa que hace referencia expresa a la factura original. No la borras ni la corriges: emites una nueva con el prefijo R (o el que uses para rectificativas) que anula o modifica la original.",
              },
              {
                q: "¿Tengo que enviar la factura en papel o sirve el PDF?",
                a: "El PDF sirve perfectamente. La AEAT acepta facturas electrónicas y el formato PDF es válido siempre que sea legible, no esté modificado y puedas garantizar su autenticidad. Envíala por email y guarda confirmación de recepción.",
              },
            ].map((faq) => (
              <div key={faq.q} className="border border-gray-100 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Navigation */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4">
          <Link
            href="/blog/modelo-303-autonomos-guia-completa"
            className="flex-1 border border-gray-100 rounded-xl p-4 hover:border-[#2A5AAE]/30 transition text-sm"
          >
            <p className="text-xs text-gray-400 mb-1">También te interesa</p>
            <p className="font-semibold text-gray-900">← Modelo 303: guía completa</p>
          </Link>
          <Link
            href="/blog/gastos-deducibles-autonomo-lista-completa"
            className="flex-1 border border-gray-100 rounded-xl p-4 hover:border-[#2A5AAE]/30 transition text-sm text-right"
          >
            <p className="text-xs text-gray-400 mb-1">Siguiente artículo</p>
            <p className="font-semibold text-gray-900">Gastos deducibles: lista completa →</p>
          </Link>
        </div>
      </article>
    </>
  );
}
