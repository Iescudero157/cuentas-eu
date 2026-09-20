"use client";

// V13 · Panel Verifactu: estado de configuración del SIF (NIF, certificado,
// modalidad), listado de registros de facturación con su estado de remisión y
// CSV de la AEAT, reenvío/subsanación de los que fallaron (V12) y eventos del
// sistema. Solo muestra datos reales de las tablas sif_* del usuario; la
// activación del módulo (sif_config.activo) la gestiona Kuentas, no esta UI.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle,
  Clock,
  Download,
  FileKey2,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Tipos de las respuestas de /api/verifactu/* ─────────────────────────────

interface PanelConfig {
  nif_obligado: string;
  nombre_razon: string;
  modalidad: "verifactu" | "no_verifactu";
  entorno_aeat: "pruebas" | "produccion";
  activo: boolean;
  fecha_inicio_verifactu: string | null;
  fecha_fin_verifactu: string | null;
}

interface PanelCadena {
  correlativo_ultimo: number;
  ultima_huella: string | null;
  ultimo_num_serie_factura: string | null;
  ultima_fecha_expedicion: string | null;
  updated_at: string;
}

interface PanelCertificado {
  tipo: "obligado" | "representante" | "sello";
  subjectCn: string;
  nifCertificado: string | null;
  validoHasta: string;
  caducidad: { estado: "valido" | "caduca_pronto" | "caducado"; diasRestantes: number };
}

interface PanelData {
  config: PanelConfig | null;
  cadena: PanelCadena | null;
  registros: Record<string, number>;
  outbox: Record<string, number>;
  certificado: PanelCertificado | null;
  custodiaConfigurada: boolean;
}

interface Registro {
  id: string;
  correlativo: number;
  tipo_registro: "alta" | "anulacion";
  invoice_id: string | null;
  num_serie_factura: string;
  fecha_expedicion: string;
  tipo_factura: string | null;
  importe_total: number | null;
  estado_remision: EstadoRemision;
  incidencia: boolean;
  subsanacion: boolean;
  rechazo_previo: string | null;
  csv_aeat: string | null;
  codigo_error_registro: string | null;
  descripcion_error: string | null;
  remitido_at: string | null;
  huella: string;
  generado_at: string;
}

interface Evento {
  id: string;
  correlativo: number;
  tipo_evento: string;
  datos: Record<string, unknown>;
  huella: string;
  fecha_hora_huso_gen: string;
  generado_at: string;
}

type EstadoRemision =
  | "generated"
  | "queued"
  | "sending"
  | "accepted"
  | "accepted_with_errors"
  | "rejected";

const ESTADO_STYLES: Record<
  EstadoRemision,
  { bg: string; text: string; label: string; icon: React.ReactNode }
> = {
  generated: { bg: "bg-brand-gray", text: "text-brand-muted", label: "Generado", icon: <Clock className="w-3 h-3" /> },
  queued: { bg: "bg-brand-blue/10", text: "text-brand-blue", label: "En cola", icon: <Clock className="w-3 h-3" /> },
  sending: { bg: "bg-brand-blue/10", text: "text-brand-blue", label: "Enviando", icon: <Send className="w-3 h-3" /> },
  accepted: { bg: "bg-brand-success/10", text: "text-brand-success", label: "Aceptado", icon: <CheckCircle className="w-3 h-3" /> },
  accepted_with_errors: { bg: "bg-brand-warning/10", text: "text-brand-warning", label: "Aceptado con errores", icon: <AlertTriangle className="w-3 h-3" /> },
  rejected: { bg: "bg-brand-danger/10", text: "text-brand-danger", label: "Rechazado", icon: <XCircle className="w-3 h-3" /> },
};

const FILTROS: { valor: EstadoRemision | "all"; label: string }[] = [
  { valor: "all", label: "Todos" },
  { valor: "queued", label: "En cola" },
  { valor: "accepted", label: "Aceptados" },
  { valor: "accepted_with_errors", label: "Con errores" },
  { valor: "rejected", label: "Rechazados" },
];

const EVENTO_LABELS: Record<string, string> = {
  inicio_no_verifactu: "Inicio modo no VERI*FACTU",
  fin_no_verifactu: "Fin modo no VERI*FACTU",
  deteccion_anomalias_registros: "Detección de anomalías en registros",
  anomalia_registro: "Anomalía en registro de facturación",
  deteccion_anomalias_eventos: "Detección de anomalías en eventos",
  anomalia_evento: "Anomalía en registro de eventos",
  restauracion_copia: "Restauración de copia de seguridad",
  export_registros: "Exportación de registros",
  export_eventos: "Exportación de eventos",
  resumen_periodico: "Resumen periódico",
};

const PAGE_SIZE = 25;

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function VerifactuPage() {
  const { user, isDemo } = useAuth();
  const [panel, setPanel] = useState<PanelData | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTabla, setLoadingTabla] = useState(false);
  const [filtro, setFiltro] = useState<EstadoRemision | "all">("all");
  const [pagina, setPagina] = useState(0);
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);
  const [exportDesde, setExportDesde] = useState("");
  const [exportHasta, setExportHasta] = useState("");
  const [exportando, setExportando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargarPanel = useCallback(async () => {
    const res = await fetch("/api/verifactu/panel");
    if (!res.ok) throw new Error("No se pudo cargar el estado del módulo");
    setPanel(await res.json());
  }, []);

  const cargarRegistros = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(pagina * PAGE_SIZE),
    });
    if (filtro !== "all") params.set("estado", filtro);
    const res = await fetch(`/api/verifactu/registros?${params.toString()}`);
    if (!res.ok) throw new Error("No se pudieron cargar los registros");
    const data = await res.json();
    setRegistros(data.registros ?? []);
    setTotalRegistros(data.total ?? 0);
  }, [filtro, pagina]);

  const cargarEventos = useCallback(async () => {
    const res = await fetch("/api/verifactu/eventos?limit=50");
    if (!res.ok) throw new Error("No se pudieron cargar los eventos");
    const data = await res.json();
    setEventos(data.eventos ?? []);
  }, []);

  useEffect(() => {
    if (!user || isDemo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([cargarPanel(), cargarRegistros(), cargarEventos()])
      .catch((e) => setError(e instanceof Error ? e.message : "Error cargando el panel"))
      .finally(() => setLoading(false));
    // Solo en el primer render con sesión: los cambios de filtro/página van aparte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isDemo]);

  useEffect(() => {
    if (!user || isDemo || loading) return;
    setLoadingTabla(true);
    cargarRegistros()
      .catch((e) => setError(e instanceof Error ? e.message : "Error cargando registros"))
      .finally(() => setLoadingTabla(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, pagina]);

  const handleReenviar = useCallback(
    async (reg: Registro) => {
      if (!reg.invoice_id) return;
      setReenviandoId(reg.id);
      setMensaje(null);
      try {
        const res = await fetch(`/api/invoices/${reg.invoice_id}/subsanar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detalle =
            data.message || data.error || "No se pudo reenviar el registro";
          setMensaje({ tipo: "error", texto: `Factura ${reg.num_serie_factura}: ${detalle}` });
        } else {
          setMensaje({
            tipo: "ok",
            texto: `Registro de ${reg.num_serie_factura} subsanado y encolado para reenvío a la AEAT`,
          });
          await Promise.all([cargarPanel(), cargarRegistros()]);
        }
      } catch {
        setMensaje({ tipo: "error", texto: "Error de conexión al reenviar" });
      } finally {
        setReenviandoId(null);
      }
    },
    [cargarPanel, cargarRegistros]
  );

  // V16 · Descarga del export de conservación (art. 8 Orden HAC/1177/2024):
  // ZIP con los lotes XML en formato oficial de remisión, manifiesto con
  // SHA-256 por fichero y volcado de eventos, verificado en el servidor.
  const handleExportar = useCallback(async () => {
    setExportando(true);
    setMensaje(null);
    try {
      const params = new URLSearchParams();
      if (exportDesde) params.set("desde", exportDesde);
      if (exportHasta) params.set("hasta", exportHasta);
      const qs = params.toString();
      const res = await fetch(`/api/verifactu/export${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMensaje({
          tipo: "error",
          texto:
            data.error === "sin_registros"
              ? "No hay registros de facturación en el período seleccionado"
              : data.message || "No se pudo generar la exportación",
        });
        return;
      }
      const nombre =
        /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ??
        "verifactu-export.zip";
      const integra = res.headers.get("X-Verifactu-Integra") !== "false";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      setMensaje(
        integra
          ? { tipo: "ok", texto: `Export ${nombre} descargado y verificado: cadena de huellas íntegra` }
          : { tipo: "error", texto: `Export ${nombre} descargado, pero la verificación detectó anomalías (ver manifest.json)` }
      );
      await cargarEventos(); // la exportación queda anotada como evento
    } catch {
      setMensaje({ tipo: "error", texto: "Error de conexión al exportar" });
    } finally {
      setExportando(false);
    }
  }, [exportDesde, exportHasta, cargarEventos]);

  // ─── Modo demo / sin sesión ─────────────────────────────────────────────────
  if (!user || isDemo) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Verifactu</h1>
          <p className="text-brand-muted text-sm mt-1">
            Registros de facturación y remisión a la AEAT (RD 1007/2023)
          </p>
        </div>
        <div className="bg-white rounded-xl p-8 border border-brand-border/50 shadow-sm text-center">
          <ShieldCheck className="w-12 h-12 text-brand-border mx-auto mb-3" />
          <p className="text-brand-text font-medium">Disponible con una cuenta real</p>
          <p className="text-sm text-brand-muted mt-1 max-w-md mx-auto">
            El panel Verifactu muestra los registros de facturación remitidos a la AEAT, su
            estado y el certificado digital. En modo demo no se generan registros fiscales.
          </p>
          <Link
            href="/registro"
            className="mt-4 inline-block bg-brand-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-blue mx-auto mb-3" />
          <p className="text-sm text-brand-muted">Cargando panel Verifactu…</p>
        </div>
      </div>
    );
  }

  const config = panel?.config ?? null;
  const cert = panel?.certificado ?? null;
  const cadena = panel?.cadena ?? null;
  const conteos = panel?.registros ?? {};
  const outbox = panel?.outbox ?? {};
  const pendientesCola = (outbox.pendiente ?? 0) + (outbox.en_envio ?? 0);
  const conErrores = (conteos.rejected ?? 0) + (conteos.accepted_with_errors ?? 0);
  const totalPaginas = Math.max(Math.ceil(totalRegistros / PAGE_SIZE), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Verifactu</h1>
          <p className="text-brand-muted text-sm mt-1">
            Registros de facturación y remisión a la AEAT (RD 1007/2023)
          </p>
        </div>
        <button
          onClick={() => {
            setLoadingTabla(true);
            Promise.all([cargarPanel(), cargarRegistros(), cargarEventos()])
              .catch(() => setMensaje({ tipo: "error", texto: "No se pudo actualizar el panel" }))
              .finally(() => setLoadingTabla(false));
          }}
          className="flex items-center gap-2 border border-brand-border text-brand-text px-4 py-2 rounded-lg hover:bg-brand-gray transition text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loadingTabla ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-brand-danger/10 border border-brand-danger/30 text-brand-danger rounded-xl px-4 py-3 text-sm font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* Estado de configuración */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estado del módulo */}
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-2 uppercase tracking-wide">Estado del módulo</p>
          {config?.activo ? (
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-success" />
              <p className="font-semibold text-brand-text">Activo</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-brand-muted" />
              <p className="font-semibold text-brand-text">{config ? "Configurado, inactivo" : "No activado"}</p>
            </div>
          )}
          <p className="text-xs text-brand-muted mt-2">
            {config?.activo
              ? `Emitiendo bajo VERI*FACTU${config.fecha_inicio_verifactu ? ` desde ${formatDate(config.fecha_inicio_verifactu)}` : ""}`
              : "La activación la realiza Kuentas al dar de alta el servicio"}
          </p>
        </div>

        {/* Obligado */}
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-2 uppercase tracking-wide">Obligado tributario</p>
          {config ? (
            <>
              <p className="font-semibold text-brand-text truncate" title={config.nombre_razon}>
                {config.nombre_razon}
              </p>
              <p className="text-xs text-brand-muted mt-2">NIF {config.nif_obligado}</p>
            </>
          ) : (
            <p className="text-sm text-brand-muted">Sin configurar</p>
          )}
        </div>

        {/* Modalidad y entorno */}
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-2 uppercase tracking-wide">Modalidad</p>
          {config ? (
            <>
              <p className="font-semibold text-brand-text">
                {config.modalidad === "verifactu" ? "VERI*FACTU" : "No VERI*FACTU"}
              </p>
              <p className="text-xs text-brand-muted mt-2">
                {config.modalidad === "verifactu" ? "Remisión continua a la AEAT" : "Conservación local de registros"}
                {" · Entorno "}
                {config.entorno_aeat === "produccion" ? "producción" : "de pruebas"}
              </p>
            </>
          ) : (
            <p className="text-sm text-brand-muted">Sin configurar</p>
          )}
        </div>

        {/* Certificado */}
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-2 uppercase tracking-wide">Certificado digital</p>
          {cert ? (
            <>
              <div className="flex items-center gap-2">
                {cert.caducidad.estado === "valido" ? (
                  <FileKey2 className="w-5 h-5 text-brand-success" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-brand-warning" />
                )}
                <p className="font-semibold text-brand-text truncate" title={cert.subjectCn}>
                  {cert.subjectCn}
                </p>
              </div>
              <p className="text-xs text-brand-muted mt-2">
                {cert.caducidad.estado === "caducado"
                  ? "Caducado — súbelo de nuevo en Ajustes"
                  : cert.caducidad.estado === "caduca_pronto"
                  ? `Caduca en ${cert.caducidad.diasRestantes} días`
                  : `Válido hasta ${formatDate(cert.validoHasta)}`}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-brand-warning" />
                <p className="font-semibold text-brand-text">Sin certificado</p>
              </div>
              <p className="text-xs text-brand-muted mt-2">
                Las facturas se registran pero no se remiten.{" "}
                <Link href="/dashboard/ajustes" className="text-brand-blue hover:underline">
                  Subir en Ajustes →
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Resumen de cadena y cola */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-1 uppercase tracking-wide">Registros en cadena</p>
          <p className="text-2xl font-bold text-brand-text">{cadena?.correlativo_ultimo ?? 0}</p>
          {cadena?.ultima_huella && (
            <p
              className="text-[10px] text-brand-muted mt-1 font-mono truncate flex items-center gap-1"
              title={`Última huella SHA-256: ${cadena.ultima_huella}`}
            >
              <Link2 className="w-3 h-3 shrink-0" /> {cadena.ultima_huella.slice(0, 16)}…
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-1 uppercase tracking-wide">Aceptados AEAT</p>
          <p className="text-2xl font-bold text-brand-success">{conteos.accepted ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-1 uppercase tracking-wide">Pendientes de envío</p>
          <p className="text-2xl font-bold text-brand-blue">{pendientesCola}</p>
          {(outbox.error ?? 0) > 0 && (
            <p className="text-xs text-brand-warning mt-1">{outbox.error} con reintento programado</p>
          )}
        </div>
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-1 uppercase tracking-wide">Con errores</p>
          <p className={`text-2xl font-bold ${conErrores > 0 ? "text-brand-danger" : "text-brand-text"}`}>
            {conErrores}
          </p>
          {conErrores > 0 && (
            <p className="text-xs text-brand-muted mt-1">Revísalos y reenvíalos abajo</p>
          )}
        </div>
      </div>

      {mensaje && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            mensaje.tipo === "ok"
              ? "bg-brand-success/10 border border-brand-success/30 text-brand-success"
              : "bg-brand-danger/10 border border-brand-danger/30 text-brand-danger"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            onClick={() => {
              setFiltro(f.valor);
              setPagina(0);
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filtro === f.valor
                ? "bg-brand-blue text-white"
                : "bg-white border border-brand-border text-brand-muted hover:bg-brand-gray"
            }`}
          >
            {f.label}
            {f.valor !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">({conteos[f.valor] ?? 0})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tabla de registros */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        {loadingTabla ? (
          <div className="p-12 text-center text-brand-muted text-sm">Cargando registros…</div>
        ) : registros.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-brand-border mx-auto mb-3" />
            <p className="text-brand-muted text-sm">
              {filtro === "all"
                ? "Todavía no hay registros de facturación Verifactu"
                : "No hay registros con este estado"}
            </p>
            {filtro === "all" && (
              <p className="text-xs text-brand-muted mt-1">
                Se generan automáticamente al emitir facturas con el módulo activo
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-gray">
                <tr>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Nº</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Tipo</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Factura</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Fecha</th>
                  <th className="text-right px-5 py-3 text-brand-muted font-medium">Importe</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Estado AEAT</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">CSV</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {registros.map((reg) => {
                  const estado = ESTADO_STYLES[reg.estado_remision] ?? ESTADO_STYLES.generated;
                  const reenviable =
                    (reg.estado_remision === "rejected" ||
                      reg.estado_remision === "accepted_with_errors") &&
                    Boolean(reg.invoice_id);
                  return (
                    <tr key={reg.id} className="hover:bg-brand-gray/30 transition align-top">
                      <td className="px-5 py-4 text-brand-muted font-mono text-xs">{reg.correlativo}</td>
                      <td className="px-5 py-4">
                        {reg.tipo_registro === "alta" ? (
                          <span className="text-brand-text">
                            Alta{reg.tipo_factura ? ` · ${reg.tipo_factura}` : ""}
                          </span>
                        ) : (
                          <span className="text-brand-danger">Anulación</span>
                        )}
                        {reg.subsanacion && (
                          <p className="text-[10px] text-brand-muted mt-0.5">Subsanación</p>
                        )}
                        {reg.rechazo_previo === "S" && (
                          <p className="text-[10px] text-brand-muted mt-0.5">Rechazo previo</p>
                        )}
                        {reg.incidencia && (
                          <p className="text-[10px] text-brand-warning mt-0.5">Incidencia</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-brand-blue">{reg.num_serie_factura}</p>
                        <p
                          className="text-[10px] text-brand-muted font-mono truncate max-w-[140px]"
                          title={`Huella SHA-256: ${reg.huella}`}
                        >
                          {reg.huella.slice(0, 12)}…
                        </p>
                      </td>
                      <td className="px-5 py-4 text-brand-muted whitespace-nowrap">
                        {formatDate(reg.fecha_expedicion)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-brand-text whitespace-nowrap">
                        {reg.importe_total !== null ? formatCurrency(Number(reg.importe_total)) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${estado.bg} ${estado.text}`}
                        >
                          {estado.icon}
                          {estado.label}
                        </span>
                        {(reg.codigo_error_registro || reg.descripcion_error) && (
                          <p
                            className="text-[11px] text-brand-danger mt-1 max-w-[220px] leading-snug"
                            title={reg.descripcion_error ?? undefined}
                          >
                            {reg.codigo_error_registro && (
                              <span className="font-mono">[{reg.codigo_error_registro}] </span>
                            )}
                            {reg.descripcion_error}
                          </p>
                        )}
                        {reg.remitido_at && (
                          <p className="text-[10px] text-brand-muted mt-1">
                            Remitido {formatDateTime(reg.remitido_at)}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {reg.csv_aeat ? (
                          <span
                            className="font-mono text-xs text-brand-text"
                            title="Código Seguro de Verificación devuelto por la AEAT"
                          >
                            {reg.csv_aeat}
                          </span>
                        ) : (
                          <span className="text-brand-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {reenviable && (
                          <button
                            onClick={() => handleReenviar(reg)}
                            disabled={reenviandoId !== null}
                            title={
                              reg.estado_remision === "rejected"
                                ? "Genera un registro subsanador con RechazoPrevio=S y lo encola de nuevo"
                                : "Genera un registro subsanador (Subsanacion=S) y lo encola de nuevo"
                            }
                            className="flex items-center gap-1.5 text-xs font-medium text-brand-blue border border-brand-blue/30 px-2.5 py-1.5 rounded-lg hover:bg-brand-blue/10 transition disabled:opacity-50 whitespace-nowrap"
                          >
                            {reenviandoId === reg.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            Subsanar y reenviar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalRegistros > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-brand-border/50 text-sm">
            <p className="text-brand-muted text-xs">
              {totalRegistros} registros · página {pagina + 1} de {totalPaginas}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(p - 1, 0))}
                disabled={pagina === 0 || loadingTabla}
                className="px-3 py-1.5 rounded-lg border border-brand-border text-brand-muted hover:bg-brand-gray transition disabled:opacity-40 text-xs font-medium"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas - 1))}
                disabled={pagina >= totalPaginas - 1 || loadingTabla}
                className="px-3 py-1.5 rounded-lg border border-brand-border text-brand-muted hover:bg-brand-gray transition disabled:opacity-40 text-xs font-medium"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Eventos del sistema */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border/50">
          <h2 className="font-semibold text-brand-text">Eventos del sistema</h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Incidencias e hitos del sistema informático de facturación (art. 9 Orden HAC/1177/2024)
          </p>
        </div>
        {eventos.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-8 h-8 text-brand-success/40 mx-auto mb-2" />
            <p className="text-sm text-brand-muted">Sin eventos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-gray">
                <tr>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Nº</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Evento</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Huella</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {eventos.map((ev) => (
                  <tr key={ev.id} className="hover:bg-brand-gray/30 transition">
                    <td className="px-5 py-3 text-brand-muted font-mono text-xs">{ev.correlativo}</td>
                    <td className="px-5 py-3 text-brand-text">
                      {EVENTO_LABELS[ev.tipo_evento] ?? ev.tipo_evento}
                    </td>
                    <td className="px-5 py-3 text-brand-muted whitespace-nowrap">
                      {formatDateTime(ev.generado_at)}
                    </td>
                    <td
                      className="px-5 py-3 text-brand-muted font-mono text-xs"
                      title={`Huella SHA-256: ${ev.huella}`}
                    >
                      {ev.huella.slice(0, 16)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Conservación y exportación (V16) */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border/50 flex items-center gap-2">
          <Archive className="w-4 h-4 text-brand-muted" />
          <div>
            <h2 className="font-semibold text-brand-text">Conservación y exportación</h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Copia de tus registros en el formato oficial de remisión, con verificación de la
              cadena de huellas (art. 8 Orden HAC/1177/2024)
            </p>
          </div>
        </div>
        <div className="px-5 py-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-brand-muted">
            Desde (fecha de generación)
            <input
              type="date"
              value={exportDesde}
              onChange={(e) => setExportDesde(e.target.value)}
              className="mt-1 block border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text"
            />
          </label>
          <label className="text-xs text-brand-muted">
            Hasta
            <input
              type="date"
              value={exportHasta}
              onChange={(e) => setExportHasta(e.target.value)}
              className="mt-1 block border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text"
            />
          </label>
          <button
            onClick={handleExportar}
            disabled={exportando || (cadena?.correlativo_ultimo ?? 0) === 0}
            title="ZIP con los registros en XML oficial (SuministroLR.xsd), manifiesto con SHA-256 por fichero y volcado de eventos"
            className="flex items-center gap-2 bg-brand-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportando ? "Generando…" : "Descargar export (ZIP)"}
          </button>
          <p className="text-xs text-brand-muted basis-full">
            Sin fechas se exporta la cadena completa. Los registros originales permanecen en
            Kuentas y se conservan hasta la prescripción fiscal aunque exportes una copia.
          </p>
        </div>
      </div>

      <p className="text-xs text-brand-muted">
        Los registros de facturación son inmutables (art. 8.2 RD 1007/2023): esta pantalla solo
        consulta su estado. Para corregir una factura emitida, usa una rectificativa o su
        anulación desde Facturas.
      </p>
    </div>
  );
}
