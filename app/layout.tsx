import type { Metadata } from "next";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";
import GoogleAdsTag from "@/components/GoogleAdsTag";

const BASE_URL = "https://app.kuentas.eu";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  icons: {
    icon: [{ url: "/favicon-large.png", type: "image/png" }],
    apple: "/favicon-large.png",
  },
  title: {
    default: "KUENTAS.EU — App Gestión Financiera para Autónomos con IA",
    template: "%s | KUENTAS.EU",
  },
  description:
    "App con IA para autónomos españoles. Calcula IVA y IRPF en tiempo real, crea facturas legales, importa tus movimientos por CSV y predice tu cash flow. Plan gratuito; de pago desde 9,99 €/mes.",
  keywords: [
    "app autónomos",
    "gestión financiera autónomos",
    "calculadora IVA autónomos",
    "modelo 303",
    "IRPF autónomos",
    "factura autónomo",
    "programa contabilidad autónomos",
    "gastos deducibles autónomos",
    "software autónomos España",
    "gestoría online autónomos",
  ],
  authors: [{ name: "KUENTAS.EU", url: BASE_URL }],
  creator: "KUENTAS.EU",
  publisher: "MercadonetGlobal",
  category: "Finance",
  alternates: {
    canonical: BASE_URL,
    languages: { "es-ES": BASE_URL },
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    title: "KUENTAS.EU — App Gestión Financiera para Autónomos con IA",
    description:
      "Calcula IVA y IRPF en tiempo real, crea facturas legales e importa tus movimientos por CSV. La app financiera pensada para autónomos españoles. Plan gratuito disponible.",
    siteName: "KUENTAS.EU",
    locale: "es_ES",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "KUENTAS.EU — Gestión Financiera con IA para Autónomos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KUENTAS.EU — App Gestión Financiera para Autónomos",
    description:
      "Calcula IVA y IRPF en tiempo real, crea facturas legales e importa tus movimientos por CSV. Plan gratuito disponible.",
    images: ["/opengraph-image.png"],
    creator: "@kuentas_eu",
    site: "@kuentas_eu",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // google: "TU_CÓDIGO_VERIFICACIÓN_SEARCH_CONSOLE",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <GoogleAdsTag />
        {children}
        <CookieConsent />
        <script src="/iavoz-widget.js" defer></script>
      </body>
    </html>
  );
}
