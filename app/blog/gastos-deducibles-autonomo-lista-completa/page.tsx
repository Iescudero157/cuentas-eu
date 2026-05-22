import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, AlertCircle, Clock, TrendingUp } from "lucide-react";

export const metadata: Metadata = {
  title: "Gastos deducibles del autónomo: la lista que tu gestor no te cuenta completa",
  description:
    "Lista completa de gastos deducibles para autónomos en España 2025: local, vehículo, teléfono, dietas, software, formación y más. Cuánto te ahorras realmente en IVA e IRPF.",
  keywords: [
    "gastos deducibles autonomo",
    "gastos deducibles autonomo 2025",
    "que gastos puede deducir un autonomo",
    "gastos deducibles irpf autonomo",
    "desgravaciones autonomo hacienda",
    "gastos autonomo lista completa",
    "autonomo gastos deducibles",
  ],
  alternates: {
    canonical: "https://app.kuentas.eu/blog/gastos-deducibles-autonomo-lista-completa",
  },
  openGraph: {
    title: "Gastos deducibles del autónomo: la lista que tu gestor no te cuenta completa",
    description:
      "Lista actualizada 2025: todos los gastos deducibles para autónomos con ejemplos reales y cuánto te ahorras.",
    type: "article",
    publishedTime: "2025-05-10T00:00:00Z",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gastos deducibles del autónomo 2025: la lista completa",
    description:
      "Local, vehículo, teléfono, formación, dietas... todo lo que puedes deducir y cómo justificarlo.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Gastos deducibles del autónomo: la lista que tu gestor no te cuenta completa",
  description:
    "Lista completa de gastos deducibles para autónomos en España 2025: local, vehículo, teléfono, dietas, software, formación y más.",
  datePublished: "2025-05-10",
  dateModified: "2025-05-10",
  author: { "@type": "Organization", name: "KUENTAS.EU", url: "https://app.kuentas.eu" },
  publisher: {
    "@type": "Organization",
    name: "KUENTAS.EU",
    logo: { "@type": "ImageObject", url: "https://app.kuentas.eu/logo.png" },
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://app.kuentas.eu/blog/gastos-deducibles-autonomo-lista-completa",
  },
  keywords:
    "gastos deducibles autonomo, irpf, iva, hacienda, desgravaciones autonomo 2025",
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
      <h3 className="text-xl font-bold mb-3">Detecta gastos deducibles que se te escapan</h3>
      <p className="text-white/80 text-sm leading-relaxed mb-5">
        Conecta tu banco y la IA de Kuentas clasifica cada gasto automáticamente: deducible,
        parcialmente deducible o personal. Ves en tiempo real cuánto te ahorras en cada
        trimestre.
      </p>
      <Link
        href="https://app.kuentas.eu/registro"
        className="inline-flex items-center gap-2 bg-[#4ECB71] text-gray-900 text-sm font-bold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
      >
        Ver mis gastos deducibles gratis <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

const gastosCategorizados = [
  {
    categoria: "Cuota de autónomos (RETA)",
    deducibleIRPF: "100%",
    deducibleIVA: "No aplica",
    nota: "El gasto más sencillo y que más olvidan incluir algunos. Se deduce íntegramente.",
    icono: "💼",
  },
  {
    categoria: "Local de trabajo / alquiler de oficina",
    deducibleIRPF: "100%",
    deducibleIVA: "100%",
    nota: "Si trabajas en local exclusivamente profesional. El contrato de arrendamiento debe ser a nombre de la actividad.",
    icono: "🏢",
  },
  {
    categoria: "Parte del hogar (oficina en casa)",
    deducibleIRPF: "Proporcional",
    deducibleIVA: "Proporcional",
    nota: "Deduces el porcentaje del hogar destinado a la actividad. Ejemplo: si tu despacho ocupa el 20% de la vivienda, deduces el 20% de alquiler, luz, internet...",
    icono: "🏠",
  },
  {
    categoria: "Suministros (luz, internet, teléfono)",
    deducibleIRPF: "30% del % profesional",
    deducibleIVA: "Proporcional",
    nota: "Si tienes oficina en casa, solo el 30% de la parte proporcional al uso profesional es deducible en IRPF. El IVA según uso real.",
    icono: "⚡",
  },
  {
    categoria: "Vehículo — autónomos de transporte, taxi, mensajería",
    deducibleIRPF: "100%",
    deducibleIVA: "100%",
    nota: "Solo si el vehículo es de uso exclusivo profesional y así queda justificado. Aplica a transportistas, mensajeros, agentes comerciales.",
    icono: "🚗",
  },
  {
    categoria: "Vehículo — uso mixto (resto de actividades)",
    deducibleIRPF: "50% (presunción, difícil de acreditar al 100%)",
    deducibleIVA: "50%",
    nota: "Para la mayoría de autónomos, Hacienda presume el 50% de uso profesional. Ir más allá es posible pero requiere registro de kilometraje y justificación.",
    icono: "🚘",
  },
  {
    categoria: "Software y suscripciones profesionales",
    deducibleIRPF: "100%",
    deducibleIVA: "100%",
    nota: "Adobe, Microsoft 365, Slack, CRMs, herramientas de diseño, contabilidad... si son para la actividad, son 100% deducibles.",
    icono: "💻",
  },
  {
    categoria: "Material de oficina",
    deducibleIRPF: "100%",
    deducibleIVA: "100%",
    nota: "Papel, tóner, cartuchos, bolígrafos, archivadores... siempre que sea para la actividad y tengas factura.",
    icono: "📋",
  },
  {
    categoria: "Formación y cursos",
    deducibleIRPF: "100%",
    deducibleIVA: "100%",
    nota: "Cursos, libros, suscripciones a plataformas de formación relacionadas con tu actividad. Máster o postgrado: si está directamente relacionado con tu actividad, también.",
    icono: "📚",
  },
  {
    categoria: "Dietas y gastos de manutención",
    deducibleIRPF: "Límite diario",
    deducibleIVA: "No (salvo factura)",
    nota: "Máximo 26,67 €/día en España (53,34 € si pernoctas). 48,08 €/día en extranjero (91,35 € con pernoctación). Solo si el desplazamiento está justificado.",
    icono: "🍽️",
  },
  {
    categoria: "Seguros vinculados a la actividad",
    deducibleIRPF: "100%",
    deducibleIVA: "No (los seguros están exentos de IVA)",
    nota: "Seguro de responsabilidad civil profesional, seguro de accidentes si actúas como autónomo. El seguro de salud privado tiene un límite de 500 € (1.500 € para discapacitados).",
    icono: "🛡️",
  },
  {
    categoria: "Gestoría y servicios profesionales",
    deducibleIRPF: "100%",
    deducibleIVA: "100%",
    nota: "Tu gestor, asesor fiscal, abogado cuando es por asuntos de la actividad. También el contable.",
    icono: "🤝",
  },
  {
    categoria: "Publicidad y marketing",
    deducibleIRPF: "100%",
    deducibleIVA: "100%",
    nota: "Anuncios en Google o Meta, diseño de webs, copywriting, fotografía profesional, tarjetas de visita...",
    icono: "📣",
  },
  {
    categoria: "Amortización de equipos (ordenador, cámara...)",
    deducibleIRPF: "Por amortización anual",
    deducibleIVA: "100% el año de compra",
    nota: "Un ordenador de 1.200 € no se deduce en el IRPF de una sola vez. Se amortiza en varios años (el tipo máximo es 25%). El IVA sí lo deduces completo el año que lo compras.",
    icono: "🖥️",
  },
];

export default function GastosDeduciblesPage() {
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
          <span className="text-gray-600">Gastos deducibles del autónomo</span>
        </nav>

        {/* Meta badges */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
            Impuestos
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            14 min de lectura · Actualizado mayo 2025
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-5">
          Gastos deducibles del autónomo: la lista que tu gestor no te cuenta completa
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed mb-5">
          Hay autónomos que pagan a Hacienda el doble de lo que deberían. No por fraude —al
          revés— sino porque no saben qué gastos pueden deducir. Esta lista te va a dar más de una
          sorpresa.
        </p>

        {/* Impact box */}
        <div className="bg-[#4ECB71]/10 border border-[#4ECB71]/30 rounded-2xl p-6 mb-10">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-6 h-6 text-[#2A5AAE] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-gray-900 mb-1">¿Cuánto te puede ahorrar esto?</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Un autónomo con 40.000 € de ingresos anuales que aplica correctamente todos sus
                gastos deducibles puede reducir su base imponible entre 8.000 y 15.000 €, según su
                actividad. A un tipo marginal del 37%, eso son entre 2.960 € y 5.550 € menos en
                la declaración de renta.
              </p>
            </div>
          </div>
        </div>

        {/* Índice */}
        <nav className="bg-gray-50 rounded-2xl p-6 mb-12">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            En este artículo
          </p>
          <ol className="space-y-1.5 text-sm text-[#2A5AAE]">
            <li><a href="#condiciones" className="hover:underline">1. Qué condiciones debe cumplir un gasto para deducirse</a></li>
            <li><a href="#lista" className="hover:underline">2. La lista completa de gastos deducibles</a></li>
            <li><a href="#vehiculo" className="hover:underline">3. El vehículo: el más conflictivo</a></li>
            <li><a href="#oficina-en-casa" className="hover:underline">4. La oficina en casa: cómo funciona</a></li>
            <li><a href="#no-deducibles" className="hover:underline">5. Gastos que NO se pueden deducir</a></li>
            <li><a href="#justificar" className="hover:underline">6. Cómo justificar los gastos</a></li>
          </ol>
        </nav>

        {/* Condiciones */}
        <section id="condiciones" className="scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Qué tiene que cumplir un gasto para ser deducible
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Antes de la lista, la regla de oro. No todo gasto que haces como autónomo se puede
            deducir. Para que Hacienda lo acepte, el gasto tiene que cumplir tres condiciones:
          </p>
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="w-7 h-7 rounded-full bg-[#2A5AAE] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <p className="font-semibold text-gray-900 mb-1">
                  Vinculación con la actividad económica
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Tiene que estar relacionado con lo que haces para ganar dinero. Un electricista puede
                  deducir herramientas; un consultor puede deducir software de gestión. Si la relación
                  no es clara, Hacienda puede rechazarlo.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="w-7 h-7 rounded-full bg-[#2A5AAE] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <p className="font-semibold text-gray-900 mb-1">
                  Justificación documental
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Necesitas factura completa (no ticket) que incluya tus datos. Sin factura, no hay
                  deducción posible en caso de inspección. El extracto bancario por sí solo no vale.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="w-7 h-7 rounded-full bg-[#2A5AAE] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <p className="font-semibold text-gray-900 mb-1">
                  Registro contable
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  El gasto tiene que estar anotado en tu libro de gastos (o en tu software de
                  contabilidad). Si aparece en la declaración pero no en los libros, hay un problema.
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* Lista completa */}
        <section id="lista" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            La lista completa de gastos deducibles para autónomos en 2025
          </h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            Columnas: deducción en IRPF (en el beneficio del negocio) y en IVA (recuperas el IVA
            pagado). Son dos conceptos distintos —un gasto puede ser 100% deducible en IRPF pero
            tener reglas distintas para el IVA.
          </p>

          <div className="space-y-4">
            {gastosCategorizados.map((g) => (
              <div key={g.categoria} className="border border-gray-100 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{g.icono}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 mb-2 leading-snug">{g.categoria}</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-[#2A5AAE]/10 text-[#2A5AAE] font-medium">
                        IRPF: {g.deducibleIRPF}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-[#4ECB71]/20 text-emerald-700 font-medium">
                        IVA: {g.deducibleIVA}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{g.nota}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <InlineCTA />

        {/* Vehículo */}
        <section id="vehiculo" className="mt-4 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            El vehículo: el gasto más conflictivo y más mal aplicado
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Ningún otro gasto genera tantos problemas en inspecciones como el vehículo. La razón es
            simple: Hacienda asume que el coche tiene uso mixto (personal y profesional) y la carga
            de demostrar lo contrario recae en ti.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            La presunción legal para autónomos de actividades que no son transporte es que el 50%
            del uso del vehículo es profesional. Eso significa que puedes deducir el 50% de:
          </p>
          <ul className="space-y-2 text-sm text-gray-600 ml-4 mb-4">
            {[
              "Amortización del vehículo o renting",
              "Seguro del vehículo",
              "Gasolina",
              "Reparaciones y mantenimiento",
              "Parkings y peajes (con factura)",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#4ECB71] shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <Callout type="warning">
            Si quieres deducir más del 50%, necesitas demostrar un porcentaje mayor de uso
            profesional. La mejor forma es llevar un registro de kilometraje detallado: origen,
            destino, km recorridos y motivo de cada desplazamiento. Sin ese registro, es difícil
            defender más del 50% ante Hacienda.
          </Callout>
        </section>

        {/* Oficina en casa */}
        <section id="oficina-en-casa" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            La oficina en casa: cómo calcular lo que te puedes deducir
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Si trabajas desde casa y declaras un porcentaje de tu vivienda como espacio de trabajo,
            puedes deducir una parte de los gastos del hogar. El cálculo funciona así:
          </p>

          <div className="bg-gray-50 rounded-xl p-6 my-6">
            <p className="text-sm font-bold text-gray-900 mb-4">Ejemplo: Piso de 80 m² con despacho de 16 m²</p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Porcentaje profesional (16/80)</span>
                <span className="font-semibold">20%</span>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <p className="font-semibold text-gray-700 mb-2">Gastos anuales del hogar:</p>
                <div className="space-y-1">
                  {[
                    { concepto: "Alquiler mensual × 12", total: "12.000 €", pct: "20%", deducible: "2.400 €" },
                    { concepto: "Luz + gas anuales", total: "1.800 €", pct: "20% × 30% IRPF", deducible: "108 €" },
                    { concepto: "Internet + teléfono", total: "600 €", pct: "20% × 30% IRPF", deducible: "36 €" },
                  ].map((r) => (
                    <div key={r.concepto} className="flex justify-between text-gray-600">
                      <span>{r.concepto} ({r.pct})</span>
                      <span className="font-medium text-emerald-700">{r.deducible}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold text-gray-900">
                  <span>Total deducible IRPF/año</span>
                  <span className="text-[#2A5AAE]">2.544 €</span>
                </div>
              </div>
            </div>
          </div>

          <Callout type="tip">
            Para aplicar la deducción de la vivienda habitual, debes comunicárselo a la AEAT
            mediante la declaración censal (Modelo 036/037) indicando el porcentaje de la vivienda
            destinado a la actividad.
          </Callout>
        </section>

        {/* No deducibles */}
        <section id="no-deducibles" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Gastos que NO puedes deducir (aunque lo parezca)
          </h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Tan importante como saber qué deducir es saber qué no. Incluir estos gastos en tu
            declaración puede generar una liquidación complementaria con recargos e intereses.
          </p>
          <div className="space-y-3">
            {[
              {
                gasto: "Ropa y calzado",
                excepcion: "Excepto si es equipamiento específico de trabajo como uniforme, EPI o ropa laboral con logotipo.",
              },
              {
                gasto: "Comidas con familia y amigos",
                excepcion: "Las comidas de negocios con clientes son deducibles si tienes factura y puedes justificar la relación comercial.",
              },
              {
                gasto: "Multas de tráfico",
                excepcion: "Ninguna excepción. Las sanciones administrativas no son deducibles.",
              },
              {
                gasto: "Gastos del ejercicio anterior no declarados en su momento",
                excepcion: "En general, los gastos se deducen en el período en que se producen. Hay excepciones técnicas pero son complejas.",
              },
              {
                gasto: "Donaciones y liberalidades (regalos sin contraprestación)",
                excepcion: "Los regalos a clientes con publicidad del negocio tienen un tratamiento especial: deducibles hasta el 1% del volumen de negocio.",
              },
            ].map((item) => (
              <div key={item.gasto} className="flex gap-3 border border-red-100 rounded-xl p-4 bg-red-50/30">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">{item.gasto}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.excepcion}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Justificar */}
        <section id="justificar" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Cómo justificar los gastos correctamente
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Tener el gasto no es suficiente. Tienes que poder demostrarlo. Esto es lo que necesitas
            para cada gasto deducible:
          </p>
          <ul className="space-y-3 text-sm text-gray-600">
            {[
              "Factura completa (no ticket) con tus datos: nombre, NIF y dirección",
              "El gasto registrado en tu libro de gastos o en tu software contable",
              "Para gastos mixtos (vehículo, hogar): documentación adicional que justifique el porcentaje profesional",
              "Para dietas: comprobantes del viaje (billetes, reservas de hotel) y propósito del desplazamiento",
              "Para formación: el justificante de inscripción y que tiene relación con tu actividad",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-[#4ECB71] shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Callout type="tip">
            Hacienda puede pedir facturas de hasta cuatro años atrás. Guárdalas en la nube, no solo
            en un cajón. Un PDF en Google Drive con el nombre del proveedor y la fecha es suficiente.
          </Callout>
        </section>

        {/* Final CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-br from-[#2A5AAE] to-[#1a3d7c] p-8 text-white text-center">
          <h3 className="text-xl font-bold mb-3">
            Para de pagar más impuestos de los que debes
          </h3>
          <p className="text-white/80 text-sm leading-relaxed mb-6 max-w-md mx-auto">
            Kuentas conecta tu banco, identifica automáticamente tus gastos deducibles y te
            muestra cuánto te ahorras en cada trimestre. Sin gestores, sin hojas de Excel, sin
            sustos al final del año.
          </p>
          <Link
            href="https://app.kuentas.eu/registro"
            className="inline-flex items-center gap-2 bg-[#4ECB71] text-gray-900 font-bold px-6 py-3 rounded-xl hover:opacity-90 transition"
          >
            Empezar a ahorrar impuestos <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Preguntas frecuentes sobre gastos deducibles
          </h2>
          <div className="space-y-5">
            {[
              {
                q: "¿Puedo deducir gastos del año anterior que no incluí en su momento?",
                a: "En principio no: los gastos se deducen en el período impositivo en que se producen. Existe la posibilidad de presentar una declaración complementaria o solicitar rectificación, pero es un proceso más complejo. Consulta con un asesor si el importe es relevante.",
              },
              {
                q: "¿Cuál es la diferencia entre deducir en IRPF y deducir el IVA?",
                a: "Son dos cosas distintas. Deducir en IRPF reduce tu beneficio neto y por tanto los impuestos que pagas sobre él. Deducir el IVA significa recuperar el IVA que pagaste a tu proveedor. Puedes deducir un gasto en IRPF sin poder deducir el IVA (ejemplo: seguros) y viceversa (ejemplo: equipos con IVA deducible pero amortización en IRPF).",
              },
              {
                q: "¿La cuota de autónomos es deducible en el IRPF?",
                a: "Sí, íntegramente. Las cotizaciones a la Seguridad Social del autónomo son un gasto deducible en el rendimiento de actividades económicas. Es uno de los más olvidados en las declaraciones hechas sin asesoramiento.",
              },
              {
                q: "¿Puedo deducir el seguro médico privado?",
                a: "Sí, pero con límites. Puedes deducir las primas de seguro de salud del autónomo, su cónyuge y los hijos menores de 25 años, hasta un máximo de 500 € por persona (1.500 € si hay discapacidad reconocida).",
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
            href="/blog/como-hacer-factura-correcta-espana"
            className="flex-1 border border-gray-100 rounded-xl p-4 hover:border-[#2A5AAE]/30 transition text-sm"
          >
            <p className="text-xs text-gray-400 mb-1">También te interesa</p>
            <p className="font-semibold text-gray-900">← Cómo hacer una factura correcta</p>
          </Link>
          <Link
            href="/blog/modelo-303-autonomos-guia-completa"
            className="flex-1 border border-gray-100 rounded-xl p-4 hover:border-[#2A5AAE]/30 transition text-sm text-right"
          >
            <p className="text-xs text-gray-400 mb-1">También te interesa</p>
            <p className="font-semibold text-gray-900">Modelo 303: guía completa →</p>
          </Link>
        </div>
      </article>
    </>
  );
}
