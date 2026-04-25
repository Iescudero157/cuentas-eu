import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://app.kuentas.eu"),
  title: "KUENTAS.EU - Gestión Financiera con IA para Autónomos",
  description:
    "App con IA que unifica todas las finanzas de autónomos, freelancers y creadores. Ingresos, gastos, impuestos, facturación y cash flow en una sola plataforma.",
  keywords: "autónomos, freelancers, creadores, gestión financiera, IVA, IRPF, facturación, España",
  alternates: {
    canonical: "https://app.kuentas.eu",
  },
  openGraph: {
    type: "website",
    url: "https://app.kuentas.eu",
    title: "KUENTAS.EU - Gestión Financiera con IA para Autónomos",
    description:
      "App con IA que unifica todas las finanzas de autónomos, freelancers y creadores. Ingresos, gastos, impuestos, facturación y cash flow en una sola plataforma.",
    siteName: "KUENTAS.EU",
  },
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
