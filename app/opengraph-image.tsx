import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KUENTAS.EU — Gestión Financiera con IA para Autónomos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Background accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "480px",
            height: "630px",
            background: "linear-gradient(135deg, #2A5AAE 0%, #1a3d7c 100%)",
            borderRadius: "0 0 0 120px",
          }}
        />

        {/* Logo + brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "40px", position: "relative", zIndex: 1 }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              background: "#2A5AAE",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: "900",
              color: "#ffffff",
            }}
          >
            K
          </div>
          <span style={{ fontSize: "32px", fontWeight: "800", color: "#2A5AAE" }}>
            KUENTAS.EU
          </span>
        </div>

        {/* Main headline */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: "580px" }}>
          <h1
            style={{
              fontSize: "56px",
              fontWeight: "800",
              color: "#111827",
              lineHeight: 1.1,
              margin: 0,
              marginBottom: "20px",
            }}
          >
            Tu gestión financiera con IA.
          </h1>
          <p
            style={{
              fontSize: "24px",
              color: "#6b7280",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Facturas y estimación de IVA e IRPF en tiempo real, para autónomos españoles.
          </p>
        </div>

        {/* Features pills */}
        <div style={{ display: "flex", gap: "12px", marginTop: "40px", position: "relative", zIndex: 1, flexWrap: "wrap" }}>
          {["Importación CSV", "IA categorización", "Estimación 303", "Facturas legales"].map((f) => (
            <div
              key={f}
              style={{
                background: "#f0f4ff",
                color: "#2A5AAE",
                padding: "8px 18px",
                borderRadius: "999px",
                fontSize: "18px",
                fontWeight: "600",
              }}
            >
              {f}
            </div>
          ))}
        </div>

        {/* Right side stats */}
        <div
          style={{
            position: "absolute",
            right: "80px",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            zIndex: 1,
          }}
        >
          {[
            { label: "Desde", value: "9,99€/mes" },
            { label: "Plan gratuito", value: "0 €" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: "16px",
                padding: "20px 28px",
                textAlign: "center",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>
                {s.label}
              </div>
              <div style={{ color: "#ffffff", fontSize: "32px", fontWeight: "800" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
