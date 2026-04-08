import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KUENTAS.EU - Gestion Financiera IA para Autonomos",
  description:
    "App con IA que unifica todas las finanzas de autonomos, freelancers y creadores. Ingresos, gastos, impuestos, facturacion y cash flow en una sola plataforma.",
  keywords: "autonomos, freelancers, creadores, gestion financiera, IVA, IRPF, facturacion, Espana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
