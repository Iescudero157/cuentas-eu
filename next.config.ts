import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // V24 · Cabeceras de seguridad globales. CSP queda pendiente a propósito
  // (exige inventariar inline scripts/styles de Next; ver docs/verifactu/SEGURIDAD.md).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
  // MANTENIMIENTO (7-sep-2026): altas suspendidas hasta completar el modulo
  // Verifactu. Revertir: eliminar este bloque redirects().
  async redirects() {
    return [
      {
        source: "/registro",
        destination: "https://kuentas.eu/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
