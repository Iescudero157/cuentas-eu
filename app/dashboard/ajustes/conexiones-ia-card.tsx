"use client";

// Ajustes → Conexiones con IA (27-nov-2026): asistentes conectados por MCP (o tokens de la API v1),
// sus permisos, último uso y el botón para revocarlos. La conexión está incluida en todos los planes.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plug } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";

interface Conexion {
  id: string;
  nombre: string;
  origen: "manual" | "mcp";
  prefijo: string;
  permisos: string[];
  creado_at: string;
  ultimo_uso_at: string | null;
  revocado_at: string | null;
}

const fecha = (v: string | null) => (v ? new Date(v).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "nunca");

export default function ConexionesIaCard() {
  const { user, isDemo } = useAuth();
  const [conexiones, setConexiones] = useState<Conexion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [revocando, setRevocando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (isDemo || !user) {
      setCargando(false);
      return;
    }
    fetch("/api/conexiones-ia")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConexiones(Array.isArray(d?.conexiones) ? d.conexiones : []))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [user, isDemo]);
  useEffect(cargar, [cargar]);

  async function revocar(id: string) {
    if (!window.confirm("¿Revocar esta conexión? El asistente dejará de acceder a tu Kuentas. Para volver, tendrás que conectarlo otra vez.")) return;
    setRevocando(id);
    await fetch("/api/conexiones-ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
    setRevocando(null);
    cargar();
  }

  const activas = conexiones.filter((c) => !c.revocado_at);
  return (
    <div className="bg-white rounded-xl border border-brand-border p-6">
      <h2 className="text-lg font-semibold text-brand-text flex items-center gap-2">
        <Plug className="w-5 h-5" /> Conexiones con IA
      </h2>
      <p className="text-sm text-brand-muted mt-1">
        Asistentes de IA (Claude, ChatGPT y otros compatibles con MCP) conectados a tu Kuentas. Incluido en todos los planes.
        La IA puede consultar tus datos y, si lo permitiste, preparar borradores; nunca emite facturas.{" "}
        <a href="https://kuentas.eu/conectar-ia/" className="text-brand-blue hover:underline">Cómo conectar</a>
      </p>
      {cargando ? (
        <p className="mt-4 text-sm text-brand-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
      ) : activas.length === 0 ? (
        <p className="mt-4 text-sm text-brand-muted">No tienes ningún asistente conectado.</p>
      ) : (
        <ul className="mt-4 divide-y divide-brand-border">
          {activas.map((c) => (
            <li key={c.id} className="py-3 flex items-start justify-between gap-4 text-sm">
              <div>
                <p className="font-medium text-brand-text">{c.nombre}</p>
                <p className="text-brand-muted">
                  {c.permisos.includes("kuentas:borradores") ? "Leer y preparar borradores" : "Solo leer"} · conectado {fecha(c.creado_at)} ·
                  último uso {fecha(c.ultimo_uso_at)}
                </p>
              </div>
              <button
                onClick={() => revocar(c.id)}
                disabled={revocando === c.id}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {revocando === c.id ? "Revocando…" : "Revocar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
