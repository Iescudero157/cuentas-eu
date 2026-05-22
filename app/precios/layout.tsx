import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Precios — Planes para Autónomos desde 0€",
  description:
    "Elige el plan que mejor se adapta a tu negocio. Empieza gratis y desbloquea conexión bancaria, IA y más desde 9,99€/mes. Sin permanencia.",
  alternates: { canonical: "https://app.kuentas.eu/precios" },
  openGraph: {
    title: "Precios KUENTAS.EU — Desde 0€/mes para Autónomos",
    description:
      "Plan Gratis, Autónomo (9,99€), Creator (19,99€) y Business (29,99€). Todos con prueba gratuita. Sin permanencia.",
  },
};

export default function PreciosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
