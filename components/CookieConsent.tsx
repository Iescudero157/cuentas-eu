"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

const COOKIE_KEY = "kuentas_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if consent was already given
    try {
      const consent = localStorage.getItem(COOKIE_KEY);
      if (!consent) {
        // Small delay so it doesn't flash on initial load
        const timer = setTimeout(() => setVisible(true), 1000);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore
    }
  }, []);

  function accept(type: "essential" | "all") {
    try {
      localStorage.setItem(COOKIE_KEY, JSON.stringify({
        essential: true,
        analytics: type === "all",
        marketing: false,
        timestamp: new Date().toISOString(),
      }));
    } catch {
      // Ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl border border-brand-border p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
            <Cookie className="w-5 h-5 text-brand-blue" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-brand-text text-sm">Cookies y privacidad</h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Usamos cookies esenciales para el funcionamiento de la app.
                  Puedes aceptar cookies analiticas opcionales para ayudarnos a mejorar.
                  Mas informacion en nuestra{" "}
                  <Link href="/privacidad" className="text-brand-blue hover:underline">politica de privacidad</Link>
                  {" "}y{" "}
                  <Link href="/terminos" className="text-brand-blue hover:underline">terminos de servicio</Link>.
                </p>
              </div>
              <button onClick={() => accept("essential")} className="shrink-0 text-brand-muted hover:text-brand-text">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => accept("essential")}
                className="px-4 py-2 border border-brand-border text-brand-text text-xs font-semibold rounded-lg hover:bg-brand-gray transition"
              >
                Solo esenciales
              </button>
              <button
                onClick={() => accept("all")}
                className="px-4 py-2 bg-brand-blue text-white text-xs font-semibold rounded-lg hover:opacity-90 transition"
              >
                Aceptar todas
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
