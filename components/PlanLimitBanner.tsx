"use client";

import Link from "next/link";
import { AlertTriangle, X, Sparkles } from "lucide-react";
import { useState } from "react";

interface PlanLimitBannerProps {
  /** How many invoices they've used this month */
  used: number;
  /** The limit (5 for gratis) */
  limit: number;
  /** Show as modal overlay (true) or inline banner (false) */
  modal?: boolean;
  /** Called when modal is dismissed */
  onDismiss?: () => void;
}

export default function PlanLimitBanner({ used, limit, modal = false, onDismiss }: PlanLimitBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  if (dismissed && !modal) return null;

  const isAtLimit = used >= limit;
  const isNearLimit = used >= limit - 1 && !isAtLimit;

  const content = (
    <div className={`relative rounded-2xl p-6 border-2 ${
      isAtLimit
        ? "bg-brand-danger/5 border-brand-danger/30"
        : "bg-brand-warning/5 border-brand-warning/30"
    }`}>
      {!modal && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-brand-muted hover:text-brand-text transition"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          isAtLimit ? "bg-brand-danger/15" : "bg-brand-warning/15"
        }`}>
          <AlertTriangle className={`w-5 h-5 ${isAtLimit ? "text-brand-danger" : "text-brand-warning"}`} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-brand-text text-base">
            {isAtLimit
              ? "Has alcanzado el límite del plan Gratis"
              : `Te queda ${limit - used} factura${limit - used > 1 ? "s" : ""} este mes`
            }
          </h3>
          <p className="text-sm text-brand-muted mt-1">
            {isAtLimit
              ? `Has creado las ${limit} facturas incluidas en el plan Gratis. Actualiza al plan Autónomo para crear facturas ilimitadas, activar la IA y mucho más.`
              : `El plan Gratis incluye ${limit} facturas/mes. Has usado ${used}. Actualiza ahora para disfrutar de facturas ilimitadas.`
            }
          </p>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <Link
              href="/precios"
              className="inline-flex items-center gap-2 bg-brand-blue text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition"
            >
              <Sparkles className="w-4 h-4" />
              Ver planes — desde 9,99€/mes
            </Link>
            {!modal && !isAtLimit && (
              <button
                onClick={handleDismiss}
                className="text-sm text-brand-muted hover:text-brand-text transition"
              >
                Recordar más tarde
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 ml-14">
        <div className="flex justify-between text-xs text-brand-muted mb-1">
          <span>{used} de {limit} facturas usadas este mes</span>
          <span>{Math.round((used / limit) * 100)}%</span>
        </div>
        <div className="h-2 bg-brand-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAtLimit ? "bg-brand-danger" : "bg-brand-warning"
            }`}
            style={{ width: `${Math.min((used / limit) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );

  if (modal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="max-w-md w-full">
          {content}
          <button
            onClick={handleDismiss}
            className="mt-3 w-full text-center text-sm text-white/70 hover:text-white transition"
          >
            Cerrar y seguir con plan Gratis
          </button>
        </div>
      </div>
    );
  }

  return content;
}
