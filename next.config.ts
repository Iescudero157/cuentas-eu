import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
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
