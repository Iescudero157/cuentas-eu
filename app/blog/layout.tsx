import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: {
    default: "Blog para Autónomos — Guías de Impuestos, Facturas y Finanzas",
    template: "%s | Blog KUENTAS.EU",
  },
  description:
    "Guías prácticas sobre IVA, IRPF, gastos deducibles, facturas y gestión financiera para autónomos españoles. Sin tecnicismos, con ejemplos reales.",
  alternates: { canonical: "https://app.kuentas.eu/blog" },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Blog nav */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="KUENTAS.EU" width={30} height={30} />
            <span className="font-bold text-[#2A5AAE]">KUENTAS.EU</span>
            <span className="text-gray-300 mx-1">·</span>
            <span className="text-sm font-medium text-gray-500">Blog</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/blog" className="text-sm text-gray-500 hover:text-[#2A5AAE] transition">
              Todos los artículos
            </Link>
            <Link
              href="/registro"
              className="bg-[#2A5AAE] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
            >
              Prueba gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Blog footer CTA */}
      <section className="bg-[#2A5AAE] py-14 px-4 mt-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            Deja de calcular IVA a mano
          </h2>
          <p className="text-white/80 mb-6">
            KUENTAS.EU lo hace automáticamente. Conecta tu banco, categoriza gastos con IA y sabe
            cada día cuánto guardar para Hacienda.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard"
              className="bg-white text-[#2A5AAE] font-bold px-6 py-3 rounded-xl hover:bg-white/90 transition"
            >
              Probar demo gratis →
            </Link>
            <Link
              href="/registro"
              className="border-2 border-white/40 text-white font-semibold px-6 py-3 rounded-xl hover:border-white/70 transition"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-8 px-4 text-center text-sm">
        <p>
          © {new Date().getFullYear()} KUENTAS.EU ·{" "}
          <Link href="/privacidad" className="hover:text-white transition">Privacidad</Link>
          {" · "}
          <Link href="/terminos" className="hover:text-white transition">Términos</Link>
          {" · "}
          <a href="mailto:hola@kuentas.eu" className="hover:text-white transition">hola@kuentas.eu</a>
        </p>
      </footer>
    </div>
  );
}
