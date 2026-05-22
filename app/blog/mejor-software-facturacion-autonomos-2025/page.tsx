import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, X, Clock, Star } from "lucide-react";

export const metadata: Metadata = {
  title: "El mejor software de facturación para autónomos en 2025 (comparativa honesta)",
  description:
    "Comparativa real de los mejores programas de facturación para autónomos en España 2025: Kuentas, Holded, Billin, Contasimple y más. Precios, funciones y para quién es cada uno.",
  keywords: [
    "mejor software facturacion autonomos",
    "mejor programa facturacion autonomo 2025",
    "software facturacion autonomo españa",
    "comparativa software facturacion",
    "programa facturas autonomo gratis",
    "app facturacion autonomo",
    "herramienta facturacion autonomo",
  ],
  alternates: {
    canonical: "https://app.kuentas.eu/blog/mejor-software-facturacion-autonomos-2025",
  },
  openGraph: {
    title: "El mejor software de facturación para autónomos en 2025 (comparativa honesta)",
    description:
      "Comparativa de los mejores programas de facturación para autónomos en España: precios reales, funciones y para quién es cada uno.",
    type: "article",
    publishedTime: "2025-05-15T00:00:00Z",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mejor software de facturación para autónomos 2025",
    description:
      "Comparativa honesta: Kuentas, Holded, Billin, Contasimple y más. Precios, funciones y cuál elegir.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "El mejor software de facturación para autónomos en 2025 (comparativa honesta)",
  description:
    "Comparativa de los mejores programas de facturación para autónomos en España 2025.",
  datePublished: "2025-05-15",
  dateModified: "2025-05-15",
  author: { "@type": "Organization", name: "KUENTAS.EU", url: "https://app.kuentas.eu" },
  publisher: {
    "@type": "Organization",
    name: "KUENTAS.EU",
    logo: { "@type": "ImageObject", url: "https://app.kuentas.eu/logo.png" },
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://app.kuentas.eu/blog/mejor-software-facturacion-autonomos-2025",
  },
  keywords:
    "mejor software facturacion autonomos, comparativa, holded, billin, contasimple, kuentas",
};

function Callout({ type, children }: { type: "tip" | "warning"; children: React.ReactNode }) {
  return (
    <div
      className={`flex gap-3 rounded-xl p-4 my-6 ${
        type === "tip"
          ? "bg-blue-50 border border-blue-100"
          : "bg-amber-50 border border-amber-100"
      }`}
    >
      {type === "tip" ? (
        <CheckCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
      ) : (
        <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      )}
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

type CheckVal = true | false | "partial";

interface Software {
  nombre: string;
  precio: string;
  descripcion: string;
  ventaja: string;
  desventaja: string;
  paraquien: string;
  puntuacion: number;
  features: {
    facturacion: CheckVal;
    iva_automatico: CheckVal;
    irpf_automatico: CheckVal;
    conexion_banco: CheckVal;
    ia_categorizacion: CheckVal;
    alertas_fiscales: CheckVal;
    app_movil: CheckVal;
    soporte_espanol: CheckVal;
  };
}

const softwares: Software[] = [
  {
    nombre: "Kuentas.eu",
    precio: "Desde 9,99 €/mes",
    descripcion:
      "Diseñado exclusivamente para autónomos españoles. Conecta el banco, categoriza gastos con IA, calcula el IVA e IRPF en tiempo real y avisa antes de cada declaración trimestral.",
    ventaja: "IA integrada para categorización y alertas fiscales automáticas. El más centrado en autónomos unipersonales.",
    desventaja: "No tiene módulo de nóminas ni contabilidad avanzada para empresas.",
    paraquien: "Autónomos personas físicas que quieren control financiero sin tocar hojas de Excel.",
    puntuacion: 4.8,
    features: {
      facturacion: true,
      iva_automatico: true,
      irpf_automatico: true,
      conexion_banco: true,
      ia_categorizacion: true,
      alertas_fiscales: true,
      app_movil: true,
      soporte_espanol: true,
    },
  },
  {
    nombre: "Holded",
    precio: "Desde 14 €/mes",
    descripcion:
      "ERP completo para pymes y autónomos. Cubre facturación, contabilidad, CRM, inventario y proyectos. Muy completo pero más orientado a empresas que a freelancers.",
    ventaja: "Muy completo para negocios con empleados o inventario. Buena integración con bancos.",
    desventaja: "Precio más alto y curva de aprendizaje mayor. Excesivo para un autónomo unipersonal.",
    paraquien: "Pequeñas empresas o autónomos con equipo y necesidades contables avanzadas.",
    puntuacion: 4.3,
    features: {
      facturacion: true,
      iva_automatico: true,
      irpf_automatico: "partial",
      conexion_banco: true,
      ia_categorizacion: "partial",
      alertas_fiscales: "partial",
      app_movil: true,
      soporte_espanol: true,
    },
  },
  {
    nombre: "Billin",
    precio: "Gratis (limitado) / 9 €/mes",
    descripcion:
      "Uno de los programas de facturación más populares en España. Interfaz sencilla, plan gratuito con facturas ilimitadas y opciones básicas de control de gastos.",
    ventaja: "Plan gratuito generoso. Muy fácil de usar para empezar. Sin curva de aprendizaje.",
    desventaja: "Sin conexión bancaria real, sin cálculo automático de IVA ni alertas de Hacienda.",
    paraquien: "Autónomos que solo necesitan emitir facturas y llevar un registro básico.",
    puntuacion: 3.9,
    features: {
      facturacion: true,
      iva_automatico: false,
      irpf_automatico: false,
      conexion_banco: false,
      ia_categorizacion: false,
      alertas_fiscales: false,
      app_movil: true,
      soporte_espanol: true,
    },
  },
  {
    nombre: "Contasimple",
    precio: "Gratis (limitado) / 8,25 €/mes",
    descripcion:
      "Especialmente orientado a autónomos en régimen de estimación directa simplificada. Gestión de facturas, libros contables y modelos de Hacienda.",
    ventaja: "Incluye plantillas para modelos de Hacienda (303, 130, 111). Muy enfocado en lo fiscal.",
    desventaja: "Interfaz más antigua. Sin conexión bancaria automática ni IA de categorización.",
    paraquien: "Autónomos que buscan ayuda con los modelos de Hacienda a bajo precio.",
    puntuacion: 3.7,
    features: {
      facturacion: true,
      iva_automatico: "partial",
      irpf_automatico: "partial",
      conexion_banco: false,
      ia_categorizacion: false,
      alertas_fiscales: "partial",
      app_movil: false,
      soporte_espanol: true,
    },
  },
  {
    nombre: "Suma.es (antes Anfix)",
    precio: "Desde 19,90 €/mes",
    descripcion:
      "Software de contabilidad y facturación con asistencia de gestores. Combina herramienta digital con acceso a asesores que revisan la contabilidad.",
    ventaja: "Incluye soporte de gestores reales. Buena opción si quieres asesoría incluida.",
    desventaja: "Precio más alto. La parte de software es menos intuitiva que alternativas modernas.",
    paraquien: "Autónomos que quieren gestoría + software en un mismo servicio.",
    puntuacion: 3.8,
    features: {
      facturacion: true,
      iva_automatico: "partial",
      irpf_automatico: "partial",
      conexion_banco: "partial",
      ia_categorizacion: false,
      alertas_fiscales: true,
      app_movil: false,
      soporte_espanol: true,
    },
  },
];

const featureLabels: { key: keyof Software["features"]; label: string }[] = [
  { key: "facturacion", label: "Facturación ilimitada" },
  { key: "iva_automatico", label: "Cálculo IVA automático" },
  { key: "irpf_automatico", label: "Cálculo IRPF automático" },
  { key: "conexion_banco", label: "Conexión bancaria real" },
  { key: "ia_categorizacion", label: "IA categorización gastos" },
  { key: "alertas_fiscales", label: "Alertas plazos Hacienda" },
  { key: "app_movil", label: "App móvil" },
  { key: "soporte_espanol", label: "Soporte en español" },
];

function FeatureIcon({ val }: { val: CheckVal }) {
  if (val === true) return <CheckCircle className="w-4 h-4 text-[#4ECB71] mx-auto" />;
  if (val === "partial")
    return (
      <span className="text-amber-500 text-xs font-bold mx-auto block text-center">Parcial</span>
    );
  return <X className="w-4 h-4 text-gray-300 mx-auto" />;
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i <= Math.floor(n) ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"
          }`}
        />
      ))}
      <span className="text-xs font-semibold text-gray-700 ml-1">{n}</span>
    </div>
  );
}

export default function MejorSoftwarePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 mb-8 flex items-center gap-2" aria-label="Breadcrumb">
          <Link href="/blog" className="hover:text-[#2A5AAE] transition">
            Blog
          </Link>
          <span>/</span>
          <span className="text-gray-600">Mejor software de facturación 2025</span>
        </nav>

        {/* Meta badges */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
            Herramientas
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            11 min de lectura · Actualizado mayo 2025
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-5">
          El mejor software de facturación para autónomos en 2025 (comparativa honesta)
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed mb-10">
          Hay decenas de opciones, todas prometen lo mismo y los precios van desde cero hasta más
          de veinte euros al mes. He probado las principales. Aquí está lo que nadie te dice en los
          anuncios.
        </p>

        {/* Índice */}
        <nav className="bg-gray-50 rounded-2xl p-6 mb-12">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            En este artículo
          </p>
          <ol className="space-y-1.5 text-sm text-[#2A5AAE]">
            <li><a href="#que-necesitas" className="hover:underline">1. Qué debe tener un buen software para autónomos</a></li>
            <li><a href="#comparativa" className="hover:underline">2. Comparativa de los cinco principales</a></li>
            <li><a href="#tabla" className="hover:underline">3. Tabla de funciones comparada</a></li>
            <li><a href="#cual-elegir" className="hover:underline">4. Cuál elegir según tu situación</a></li>
            <li><a href="#kuentas" className="hover:underline">5. Por qué Kuentas es diferente</a></li>
          </ol>
        </nav>

        {/* Qué necesitas */}
        <section id="que-necesitas" className="scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Qué debe tener un software de facturación para autónomos en España
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            La mayoría de herramientas te venden «facturación». Pero un autónomo en España no solo
            necesita emitir facturas: necesita gestionar el IVA trimestral, calcular las retenciones
            de IRPF, controlar los gastos deducibles y saber cuánto guardar para Hacienda.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Antes de elegir, define qué necesitas realmente:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                titulo: "Solo emitir facturas",
                desc: "Cualquier opción básica o gratuita sirve. Prioriza la facilidad de uso.",
                color: "border-gray-200",
              },
              {
                titulo: "Facturar + controlar IVA",
                desc: "Necesitas que el software calcule el IVA automáticamente y te dé el resumen del 303.",
                color: "border-[#2A5AAE]/30",
              },
              {
                titulo: "Gestión financiera completa",
                desc: "Conexión bancaria, categorización de gastos, alertas de plazos. Aquí ya importa mucho más la herramienta.",
                color: "border-[#4ECB71]/50",
              },
              {
                titulo: "Empresa con equipo",
                desc: "Nóminas, multi-usuario, inventario. Las herramientas de este artículo no siempre cubren esto.",
                color: "border-purple-200",
              },
            ].map((item) => (
              <div key={item.titulo} className={`border rounded-xl p-4 ${item.color}`}>
                <p className="font-semibold text-gray-900 mb-1 text-sm">{item.titulo}</p>
                <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Comparativa individual */}
        <section id="comparativa" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Los cinco principales: análisis uno por uno
          </h2>

          <div className="space-y-8">
            {softwares.map((sw, idx) => (
              <div
                key={sw.nombre}
                className={`border rounded-2xl overflow-hidden ${
                  idx === 0 ? "border-[#2A5AAE]" : "border-gray-100"
                }`}
              >
                <div
                  className={`px-6 py-4 flex items-center justify-between ${
                    idx === 0 ? "bg-[#2A5AAE]" : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {idx === 0 && (
                      <span className="text-xs font-bold bg-[#4ECB71] text-gray-900 px-2.5 py-1 rounded-full">
                        NUESTRA ELECCIÓN
                      </span>
                    )}
                    <h3 className={`font-bold text-lg ${idx === 0 ? "text-white" : "text-gray-900"}`}>
                      {sw.nombre}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${idx === 0 ? "text-white" : "text-[#2A5AAE]"}`}>
                      {sw.precio}
                    </p>
                    <Stars n={sw.puntuacion} />
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{sw.descripcion}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="bg-[#4ECB71]/10 rounded-lg p-3">
                      <p className="font-semibold text-gray-900 mb-1 text-xs uppercase tracking-wide">
                        Ventaja principal
                      </p>
                      <p className="text-gray-700 text-xs leading-relaxed">{sw.ventaja}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="font-semibold text-gray-900 mb-1 text-xs uppercase tracking-wide">
                        Limitación
                      </p>
                      <p className="text-gray-700 text-xs leading-relaxed">{sw.desventaja}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-4 flex items-center gap-1.5">
                    <span className="font-semibold text-gray-700">Ideal para:</span>
                    {sw.paraquien}
                  </p>
                  {idx === 0 && (
                    <div className="mt-5">
                      <Link
                        href="https://app.kuentas.eu/registro"
                        className="inline-flex items-center gap-2 bg-[#2A5AAE] text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
                      >
                        Probar Kuentas gratis <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tabla comparativa */}
        <section id="tabla" className="mt-14 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Tabla comparativa de funciones
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Un vistazo rápido a las funciones que más importan para un autónomo en España.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-[#2A5AAE]/5">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-600 font-semibold min-w-[160px]">
                    Función
                  </th>
                  {softwares.map((sw) => (
                    <th
                      key={sw.nombre}
                      className="text-center py-3 px-3 text-gray-600 font-semibold min-w-[80px]"
                    >
                      {sw.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {featureLabels.map((f) => (
                  <tr key={f.key} className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-4 text-gray-700 font-medium">{f.label}</td>
                    {softwares.map((sw) => (
                      <td key={sw.nombre} className="py-2.5 px-3 text-center">
                        <FeatureIcon val={sw.features[f.key]} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-[#2A5AAE]/5">
                  <td className="py-3 px-4 font-bold text-gray-900">Precio/mes</td>
                  {softwares.map((sw) => (
                    <td key={sw.nombre} className="py-3 px-3 text-center font-semibold text-[#2A5AAE] text-xs">
                      {sw.precio}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <Callout type="tip">
            «Parcial» significa que la función existe pero con limitaciones: puede requerir
            configuración manual, no ser totalmente automática o estar disponible solo en planes
            superiores.
          </Callout>
        </section>

        {/* Cuál elegir */}
        <section id="cual-elegir" className="mt-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Cuál elegir según tu situación actual
          </h2>
          <div className="space-y-4">
            {[
              {
                situacion: "Acabo de darme de alta y quiero empezar sin gastar",
                recomendacion: "Billin (plan gratuito)",
                razon:
                  "El plan gratuito de Billin cubre la facturación básica sin coste. Para empezar está bien. Cuando empieces a tener más movimientos, necesitarás algo con más control fiscal.",
              },
              {
                situacion: "Tengo más de 10-15 facturas al mes y quiero controlar el IVA",
                recomendacion: "Kuentas.eu",
                razon:
                  "A partir de cierto volumen, el tiempo que pierdes calculando el IVA a mano supera el coste del software. Kuentas lo automatiza y además avisa antes de cada plazo.",
              },
              {
                situacion:
                  "Necesito ayuda también con los modelos de Hacienda (130, 111...)",
                recomendacion: "Contasimple o Kuentas.eu",
                razon:
                  "Contasimple tiene plantillas específicas para los modelos. Kuentas calcula en tiempo real lo que irá en cada modelo.",
              },
              {
                situacion: "Tengo empleados o una SL / SA",
                recomendacion: "Holded o Suma.es",
                razon:
                  "Las herramientas más simples no cubren nóminas ni contabilidad avanzada. Para eso necesitas un ERP como Holded o una gestoría integrada como Suma.",
              },
              {
                situacion:
                  "Quiero conectar el banco y tener todo automatizado sin tocar nada",
                recomendacion: "Kuentas.eu",
                razon:
                  "Es el único de esta lista diseñado específicamente para autónomos con IA de categorización de gastos, conexión bancaria real y alertas automáticas antes de cada trimestre.",
              },
            ].map((item) => (
              <div key={item.situacion} className="border border-gray-100 rounded-xl p-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Tu situación</p>
                <p className="font-semibold text-gray-900 mb-2 text-sm leading-snug">
                  {item.situacion}
                </p>
                <p className="text-xs text-[#2A5AAE] font-bold mb-1">
                  Recomendación: {item.recomendacion}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">{item.razon}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Por qué Kuentas */}
        <section id="kuentas" className="mt-14 scroll-mt-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Por qué Kuentas.eu es diferente al resto
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Seré directo: estoy hablando de nuestro propio producto, así que tómalo con la
            perspectiva que merece. Pero hay razones concretas por las que construimos Kuentas y
            no nos limitamos a copiar lo que ya existía.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            La mayoría de software de facturación está diseñado para registrar lo que ya ocurrió.
            Emites una factura, la guardas. Recibes una factura, la registras. Al final del
            trimestre, sumas y rezas.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Kuentas funciona al revés: conecta el banco desde el primer día y sabe en tiempo real
            cuánto debes a Hacienda. Antes de que llegue el día 20, ya sabes el número. Antes de
            presentar el 303, ya tienes el resumen preparado. No hay sorpresas.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">
            {[
              {
                titulo: "IVA en tiempo real",
                desc: "Sabes cada día cuánto debes a Hacienda este trimestre, no el día antes del plazo.",
                icono: "⚡",
              },
              {
                titulo: "IA que categoriza",
                desc: "Cada movimiento bancario queda clasificado automáticamente como ingreso, gasto deducible o personal.",
                icono: "🤖",
              },
              {
                titulo: "Alertas de plazos",
                desc: "Te avisa una semana antes de cada plazo: 303, 130, 111 y 180. Sin carreras de última hora.",
                icono: "🔔",
              },
            ].map((item) => (
              <div key={item.titulo} className="bg-[#2A5AAE]/5 rounded-xl p-5 text-center">
                <span className="text-3xl">{item.icono}</span>
                <p className="font-bold text-gray-900 mt-3 mb-2">{item.titulo}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <div className="mt-8 rounded-2xl bg-gradient-to-br from-[#2A5AAE] to-[#1a3d7c] p-8 text-white">
          <div className="text-center">
            <p className="text-sm font-semibold text-white/70 mb-2">KUENTAS.EU</p>
            <h3 className="text-2xl font-bold mb-3">
              Pruébalo sin compromiso
            </h3>
            <p className="text-white/80 text-sm leading-relaxed mb-6 max-w-md mx-auto">
              Catorce días gratis, sin tarjeta de crédito. Conecta el banco, crea tu primera
              factura y mira cómo el IVA se calcula solo. Si no te convence, no pagas nada.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="https://app.kuentas.eu/registro"
                className="inline-flex items-center justify-center gap-2 bg-[#4ECB71] text-gray-900 font-bold px-6 py-3 rounded-xl hover:opacity-90 transition"
              >
                Empezar prueba gratuita <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white font-semibold px-6 py-3 rounded-xl hover:border-white/60 transition"
              >
                Ver demo en vivo
              </Link>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Preguntas frecuentes sobre software de facturación
          </h2>
          <div className="space-y-5">
            {[
              {
                q: "¿Qué es el SII y me afecta como autónomo?",
                a: "El SII (Suministro Inmediato de Información) es un sistema de envío de facturas en tiempo real a la AEAT. Solo es obligatorio para grandes empresas (facturación > 6 millones €) y grupos de IVA. Como autónomo pequeño, no te afecta directamente.",
              },
              {
                q: "¿Tengo que usar un software homologado por Hacienda?",
                a: "No existe una «homologación» oficial de software de facturación para autónomos en estimación directa. Lo que sí existe es la obligación de que los sistemas de facturación cumplan los requisitos del Reglamento de Facturación, lo que cualquier software serio ya cumple.",
              },
              {
                q: "¿Puedo cambiar de software sin perder mis datos?",
                a: "Sí, en general. La mayoría de herramientas permiten exportar facturas en CSV o PDF. En Kuentas también puedes importar datos de facturas previas. El cambio puede ser manual si hay muchos registros, pero es factible.",
              },
              {
                q: "¿El software de facturación sustituye al gestor?",
                a: "Para la mayoría de autónomos unipersonales con actividad sencilla, sí: puedes gestionar el IVA, el IRPF y las facturas sin gestor. Si tienes actividades complejas, empleados o dudas fiscales específicas, un gestor sigue siendo útil aunque solo sea puntualmente.",
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
            <p className="text-xs text-gray-400 mb-1">También te interesa</p>
            <p className="font-semibold text-gray-900">Gastos deducibles: lista completa →</p>
          </Link>
        </div>
      </article>
    </>
  );
}
