import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculadora de IVA para Autónomos — Gratis Online 2025",
  description:
    "Calcula el IVA de tus facturas al instante: base imponible, cuota de IVA (21%, 10%, 4%) y retención IRPF. Gratis, sin registro, sin instalación.",
  keywords: [
    "calculadora iva autonomos",
    "calcular iva factura",
    "calculadora iva españa",
    "iva 21 calculadora",
    "base imponible calculadora",
    "cuota iva factura autonomo",
  ],
  alternates: { canonical: "https://app.kuentas.eu/herramientas/calculadora-iva" },
  openGraph: {
    title: "Calculadora de IVA para Autónomos — Gratis",
    description: "Calcula base imponible, IVA y retención IRPF de tus facturas en segundos.",
  },
};

export default function CalculadoraIVALayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
