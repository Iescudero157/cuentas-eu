import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: {
    default: "Herramientas Gratuitas para Autónomos — Calculadoras IVA e IRPF",
    template: "%s | Herramientas KUENTAS.EU",
  },
  description:
    "Calculadoras gratuitas de IVA e IRPF para autónomos españoles. Calcula el IVA de tus facturas, estima tu IRPF trimestral y más — sin registro.",
  alternates: { canonical: "https://app.kuentas.eu/herramientas" },
};

export default function HerramientasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="KUENTAS.EU" width={30} height={30} />
            <span className="font-bold text-[#2A5AAE]">KUENTAS.EU</span>
            <span className="text-gray-300 mx-1">·</span>
            <span className="text-sm font-medium text-gray-500">Herramientas</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/herramientas" className="text-sm text-gray-500 hover:text-[#2A5AAE] transition hidden sm:block">
              Calculadoras
            </Link>
            <Link href="/blog" className="text-sm text-gray-500 hover:text-[#2A5AAE] transition hidden sm:block">
              Blog
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

      <footer className="bg-gray-900 text-gray-400 py-8 px-4 text-center text-sm mt-16">
        <p>
          © {new Date().getFullYear()} KUENTAS.EU ·{" "}
          <Link href="/privacidad" className="hover:text-white transition">Privacidad</Link>
          {" · "}
          <Link href="/blog" className="hover:text-white transition">Blog</Link>
          {" · "}
          <a href="mailto:hola@kuentas.eu" className="hover:text-white transition">hola@kuentas.eu</a>
        </p>
      </footer>
    </div>
  );
}
