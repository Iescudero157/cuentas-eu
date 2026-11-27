"use client";

// Facturas: aviso con los borradores que ha preparado un asistente de IA (conector MCP / API v1).
// No son facturas: «Revisar» los carga en Nueva factura, donde el usuario los guarda o emite él.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";

interface BorradorIa {
  id: string;
  cliente: string;
  total: number;
  creado: string;
}

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" } as Intl.NumberFormatOptions);

export default function BorradoresIaAviso() {
  const { user, isDemo } = useAuth();
  const [borradores, setBorradores] = useState<BorradorIa[]>([]);

  useEffect(() => {
    if (isDemo || !user) return;
    fetch("/api/conexiones-ia")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBorradores(Array.isArray(d?.borradores) ? d.borradores : []))
      .catch(() => {});
  }, [user, isDemo]);

  async function descartar(id: string) {
    const r = await fetch(`/api/borradores-ia/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "descartado" }),
    });
    if (r.ok) setBorradores((b) => b.filter((x) => x.id !== id));
  }

  if (borradores.length === 0) return null;
  return (
    <div className="rounded-xl border border-brand-blue/30 bg-brand-blue/5 p-4">
      <p className="font-semibold text-brand-text flex items-center gap-2">
        <Sparkles className="w-4 h-4" /> Borradores preparados por tu asistente de IA ({borradores.length})
      </p>
      <p className="text-sm text-brand-muted mt-1">
        Todavía no son facturas. Revísalos y, si están bien, guárdalos desde Nueva factura.
      </p>
      <ul className="mt-3 divide-y divide-brand-blue/10">
        {borradores.map((b) => (
          <li key={b.id} className="py-2 flex items-center justify-between gap-3 text-sm">
            <span>
              {b.cliente || "Sin cliente"} · <strong>{euros(b.total)}</strong>
              <span className="text-brand-muted"> · {new Date(b.creado).toLocaleDateString("es-ES")}</span>
            </span>
            <span className="flex gap-3 shrink-0">
              <Link href={`/dashboard/facturas/nueva?borrador=${b.id}`} className="text-brand-blue font-semibold hover:underline">
                Revisar
              </Link>
              <button onClick={() => descartar(b.id)} className="text-brand-muted hover:underline">
                Descartar
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
