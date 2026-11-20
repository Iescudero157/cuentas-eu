"use client";

import Link from "next/link";
import { Plus, FileText, CheckCircle, Mail, Download, MoreHorizontal, Clock, AlertTriangle, ChevronDown, X, CalendarCheck, FilePenLine, Ban, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useState, useCallback, useEffect, useRef, type MouseEvent } from "react";
import dynamic from "next/dynamic";
import { useInvoices } from "@/lib/hooks/useInvoices";
import { useAuth } from "@/lib/hooks/useAuth";
import type { Invoice, PaymentMethod } from "@/lib/types";
import PlanLimitBanner from "@/components/PlanLimitBanner";
import { TIPOS_RECTIFICATIVA } from "@/lib/verifactu/factura-fiscal";

/** Longitud máxima del motivo de una rectificativa (la misma que valida el servidor). */
const MAX_MOTIVO = 300;

function redondear(valor: number): number {
  return Math.round((valor + Math.sign(valor) * Number.EPSILON) * 100) / 100;
}

const InvoicePDFButton = dynamic(() => import("@/components/InvoicePDF"), { ssr: false });

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  cobrada: { bg: "bg-brand-success/10", text: "text-brand-success", label: "Cobrada", icon: <CheckCircle className="w-3 h-3" /> },
  pendiente: { bg: "bg-brand-warning/10", text: "text-brand-warning", label: "Pendiente", icon: <Clock className="w-3 h-3" /> },
  vencida: { bg: "bg-brand-danger/10", text: "text-brand-danger", label: "Vencida", icon: <AlertTriangle className="w-3 h-3" /> },
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  domiciliacion: "Domiciliación",
  cheque: "Cheque",
  otro: "Otro",
};

// ─── Accounting export formats ────────────────────────────────────────────────

function exportGenericCSV(invoices: Invoice[]) {
  const rows = [
    ["Número", "Cliente", "NIF", "Fecha", "Vencimiento", "Fecha cobro", "Forma cobro", "Estado", "Subtotal", "IVA", "IRPF", "Total"],
    ...invoices.map((i) => [
      i.number, i.clientName, i.clientNif || "", i.date, i.dueDate,
      i.paymentDate || "", i.paymentMethod || "", i.status,
      i.subtotal.toFixed(2), i.iva.toFixed(2), i.irpf.toFixed(2), i.total.toFixed(2),
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  downloadFile("﻿" + csv, `facturas_${today()}.csv`, "text/csv;charset=utf-8;");
}

function exportSageCSV(invoices: Invoice[]) {
  // Sage / ContaPlus compatible: FECHA;ASIENTO;SUBCUENTA;CONCEPTO;DEBE;HABER;IVA;REFERENCIA
  const header = "FECHA;ASIENTO;SUBCUENTA;CONCEPTO;DEBE;HABER;IVA;REFERENCIA\n";
  const rows = invoices.map((i, idx) => {
    const asiento = String(idx + 1).padStart(5, "0");
    const fecha = i.date.replace(/-/g, "/");
    return [
      fecha, asiento, "70000000",
      `Factura ${i.number} ${i.clientName}`,
      "", i.total.toFixed(2), i.iva.toFixed(2), i.number,
    ].join(";");
  }).join("\n");
  downloadFile(header + rows, `sage_facturas_${today()}.csv`, "text/csv;charset=utf-8;");
}

function exportContaplusCSV(invoices: Invoice[]) {
  // ContaPlus / A3 Soc compatible
  const header = "CUENTA;FECHA;DOCUMENTO;CONCEPTO;DEBE;HABER;IVA_BASE;CUOTA_IVA;TIPO_IVA\n";
  const rows = invoices.map((i) => {
    const fecha = i.date.replace(/-/g, "");
    return [
      "700", fecha, i.number,
      `Venta ${i.clientName}`,
      "", i.subtotal.toFixed(2), i.subtotal.toFixed(2), i.iva.toFixed(2), i.ivaRate,
    ].join(";");
  }).join("\n");
  downloadFile(header + rows, `contaplus_facturas_${today()}.csv`, "text/csv;charset=utf-8;");
}

function exportA3CSV(invoices: Invoice[]) {
  // A3 / AccountExpert simplified format
  const header = "Tipo;Fecha;Serie;Numero;CIF_Cliente;Cliente;Base;IVA%;Cuota_IVA;IRPF%;Retencion;Total;Estado\n";
  const rows = invoices.map((i) =>
    ["F", i.date, "A", i.number, i.clientNif || "", i.clientName,
     i.subtotal.toFixed(2), i.ivaRate, i.iva.toFixed(2),
     i.irpfRate, i.irpf.toFixed(2), i.total.toFixed(2), i.status].join(";")
  ).join("\n");
  downloadFile(header + rows, `a3_facturas_${today()}.csv`, "text/csv;charset=utf-8;");
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FacturasPage() {
  const {
    invoices, loading, error: invoiceError, updateInvoiceStatus, rectificarInvoice, anularInvoice,
  } = useInvoices();
  const { isDemo, profile } = useAuth();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [monthlyInvoiceCount, setMonthlyInvoiceCount] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailSentIds, setEmailSentIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "pendiente" | "cobrada" | "vencida">("all");

  // Payment date modal
  const [cobradaModal, setCobradaModal] = useState<Invoice | null>(null);
  const [cobradaDate, setCobradaDate] = useState(today());

  // Export dropdown
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Export ClassicConta (AIG) — V22, plan Business (ZIP de servidor: diario
  // 869 c/registro + subcuentas 444 según el protocolo Conta6 de AIG)
  const [ccModal, setCcModal] = useState(false);
  const [ccDesde, setCcDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [ccHasta, setCcHasta] = useState(today());
  const [ccAsiento, setCcAsiento] = useState("1");
  const [ccLoading, setCcLoading] = useState(false);
  const [ccError, setCcError] = useState<string | null>(null);
  const isBusiness = profile?.plan === "business";

  // Rectificativa (art. 15 RD 1619/2012) y anulación (art. 11 RD 1007/2023)
  const [rectModal, setRectModal] = useState<Invoice | null>(null);
  const [rectModo, setRectModo] = useState<"total" | "importe">("total");
  const [rectBase, setRectBase] = useState("");
  const [rectTipo, setRectTipo] = useState("");
  const [rectMotivo, setRectMotivo] = useState("");
  const [rectLoading, setRectLoading] = useState(false);
  const [rectError, setRectError] = useState<string | null>(null);
  const [anularModal, setAnularModal] = useState<Invoice | null>(null);
  const [anularConfirmado, setAnularConfirmado] = useState(false);
  const [anularLoading, setAnularLoading] = useState(false);
  const [anularError, setAnularError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Una factura anulada no tiene efectos: no cuenta en los totales ni se
  // exporta a contabilidad. Las rectificativas sí cuentan, con su signo.
  const vigentes = invoices.filter((i) => i.verifactuEstado !== "anulada");
  const totalFacturado = vigentes.reduce((s, i) => s + i.total, 0);
  const pendiente = vigentes.filter((i) => i.status === "pendiente").reduce((s, i) => s + i.total, 0);
  const cobrado = vigentes.filter((i) => i.status === "cobrada").reduce((s, i) => s + i.total, 0);
  const vencidas = vigentes.filter((i) => i.status === "vencida").length;

  // Las anuladas solo se listan en «Todas»: ya no tienen estado de cobro.
  const filtered = filter === "all" ? invoices : vigentes.filter((i) => i.status === filter);

  useEffect(() => {
    if (!invoices.length || profile?.plan !== "gratis") return;
    const now = new Date();
    const thisMonth = now.getFullYear() * 100 + now.getMonth();
    // Las rectificativas no consumen cupo del plan (igual que en el servidor).
    const count = invoices.filter(inv => {
      const d = new Date(inv.date);
      return !inv.rectificaInvoiceId && d.getFullYear() * 100 + d.getMonth() === thisMonth;
    }).length;
    setMonthlyInvoiceCount(count);
  }, [invoices, profile?.plan]);

  // Close export dropdown on outside click
  useEffect(() => {
    function handler(e: globalThis.MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close row menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    function handler() {
      setOpenMenuId(null);
      setMenuPos(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  // Quick cobrada click → open modal to pick payment date
  const handleMarkCobradaClick = useCallback((inv: Invoice) => {
    setCobradaDate(today());
    setCobradaModal(inv);
    setOpenMenuId(null);
  }, []);

  const handleConfirmCobrada = useCallback(async () => {
    if (!cobradaModal) return;
    setMarkingId(cobradaModal.id);
    await updateInvoiceStatus(cobradaModal.id, "cobrada", cobradaDate);
    setMarkingId(null);
    setCobradaModal(null);
  }, [cobradaModal, cobradaDate, updateInvoiceStatus]);

  const handleMarkPendiente = useCallback(async (inv: Invoice) => {
    setMarkingId(inv.id);
    await updateInvoiceStatus(inv.id, "pendiente");
    setMarkingId(null);
    setOpenMenuId(null);
  }, [updateInvoiceStatus]);

  const handleSendEmail = useCallback(async (inv: Invoice) => {
    if (!inv.clientEmail) return;
    setSendingEmailId(inv.id);
    try {
      await fetch(`/api/invoices/${inv.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: inv.clientEmail }),
      });
      setEmailSentIds((prev) => new Set([...prev, inv.id]));
    } catch { /* noop */ }
    setSendingEmailId(null);
    setOpenMenuId(null);
  }, []);

  const handleExportClassicConta = useCallback(async () => {
    setCcError(null);
    setCcLoading(true);
    try {
      const params = new URLSearchParams();
      if (ccDesde) params.set("desde", ccDesde);
      if (ccHasta) params.set("hasta", ccHasta);
      params.set("asiento", ccAsiento || "1");
      const res = await fetch(`/api/invoices/export-classicconta?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setCcError(body?.message ?? "No se pudo generar el export");
        return;
      }
      const blob = await res.blob();
      const nombre =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `kuentas-classicconta-${today()}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nombre; a.click();
      URL.revokeObjectURL(url);
      setCcModal(false);
    } catch {
      setCcError("Error de red generando el export");
    } finally {
      setCcLoading(false);
    }
  }, [ccDesde, ccHasta, ccAsiento]);

  // ─── Rectificativa y anulación ─────────────────────────────────────────────

  const cerrarMenu = useCallback(() => {
    setOpenMenuId(null);
    setMenuPos(null);
  }, []);

  const abrirRectificativa = useCallback((inv: Invoice) => {
    setRectModo("total");
    setRectBase("");
    setRectTipo("");
    setRectMotivo("");
    setRectError(null);
    setAnularModal(null);
    setRectModal(inv);
    cerrarMenu();
  }, [cerrarMenu]);

  const abrirAnulacion = useCallback((inv: Invoice) => {
    setAnularConfirmado(false);
    setAnularError(null);
    setAnularModal(inv);
    cerrarMenu();
  }, [cerrarMenu]);

  // Importes que siguen vigentes de la factura que se rectifica: los suyos más
  // las rectificativas ya emitidas sobre ella (el servidor hace la misma cuenta).
  const rectPrevias = rectModal
    ? invoices.filter((i) => i.rectificaInvoiceId === rectModal.id && i.verifactuEstado !== "anulada")
    : [];
  const rectVigente = rectModal
    ? {
        subtotal: redondear(rectModal.subtotal + rectPrevias.reduce((s, i) => s + i.subtotal, 0)),
        iva: redondear(rectModal.iva + rectPrevias.reduce((s, i) => s + i.iva, 0)),
        irpf: redondear(rectModal.irpf + rectPrevias.reduce((s, i) => s + i.irpf, 0)),
      }
    : { subtotal: 0, iva: 0, irpf: 0 };
  const rectEsSimplificada = rectModal?.tipoFactura === "F2" || rectModal?.tipoFactura === "R5";
  const rectBaseNum = rectModo === "total" ? 0 : Number(rectBase.replace(",", "."));
  const rectBaseValida = rectModo === "total" || (rectBase.trim() !== "" && Number.isFinite(rectBaseNum) && rectBaseNum >= 0);
  const rectDif = rectModal && rectBaseValida
    ? {
        subtotal: redondear(rectBaseNum - rectVigente.subtotal),
        iva: redondear(redondear((rectBaseNum * rectModal.ivaRate) / 100) - rectVigente.iva),
        irpf: redondear(redondear((rectBaseNum * rectModal.irpfRate) / 100) - rectVigente.irpf),
      }
    : null;
  const rectSinDiferencias = rectDif !== null && rectDif.subtotal === 0 && rectDif.iva === 0 && rectDif.irpf === 0;
  const rectListo =
    rectDif !== null &&
    !rectSinDiferencias &&
    rectMotivo.trim().length >= 5 &&
    (rectEsSimplificada || rectTipo !== "");

  const handleEmitirRectificativa = useCallback(async () => {
    if (!rectModal) return;
    setRectLoading(true);
    setRectError(null);
    const res = await rectificarInvoice(rectModal.id, {
      modo: rectModo,
      baseCorrecta: rectModo === "importe" ? Number(rectBase.replace(",", ".")) : undefined,
      motivo: rectMotivo.trim(),
      tipoFactura: rectTipo || undefined,
    });
    setRectLoading(false);
    if (!res.ok) {
      setRectError(res.error ?? "No se pudo emitir la factura rectificativa");
      return;
    }
    setAviso(
      `Factura rectificativa ${res.numero ?? ""} emitida. Rectifica a ${rectModal.number}, que queda como rectificada.`
    );
    setRectModal(null);
  }, [rectModal, rectModo, rectBase, rectMotivo, rectTipo, rectificarInvoice]);

  const handleAnular = useCallback(async () => {
    if (!anularModal) return;
    setAnularLoading(true);
    setAnularError(null);
    const res = await anularInvoice(anularModal.id);
    setAnularLoading(false);
    if (!res.ok) {
      setAnularError(res.error ?? "No se pudo anular la factura");
      return;
    }
    setAviso(`Factura ${anularModal.number} anulada. Su registro de anulación queda en cola para la AEAT.`);
    setAnularModal(null);
  }, [anularModal, anularInvoice]);

  // Issuer profile (simple fallback)
  const issuer = { name: "Tu empresa", nif: "", address: "" };

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {invoiceError && (
        <div className="bg-brand-danger/10 border border-brand-danger/30 text-brand-danger rounded-xl px-4 py-3 text-sm font-medium">
          ⚠️ {invoiceError}
        </div>
      )}
      {/* Resultado de una rectificativa o de una anulación */}
      {aviso && (
        <div className="bg-brand-success/10 border border-brand-success/30 text-brand-text rounded-xl px-4 py-3 text-sm flex items-start justify-between gap-3">
          <span className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-brand-success shrink-0 mt-0.5" />
            {aviso}
          </span>
          <button onClick={() => setAviso(null)} className="text-brand-muted hover:text-brand-text" aria-label="Cerrar aviso">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Facturas</h1>
          <p className="text-brand-muted text-sm mt-1">Gestiona y emite facturas legales</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center gap-2 border border-brand-border text-brand-text px-4 py-2 rounded-lg hover:bg-brand-gray transition text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Exportar a contabilidad <ChevronDown className="w-3 h-3" />
            </button>
            {showExport && (
              <div className="absolute right-0 top-10 z-50 bg-white border border-brand-border rounded-xl shadow-lg w-52 py-1">
                <p className="px-4 py-2 text-xs text-brand-muted font-medium uppercase tracking-wide">Formato</p>
                {[
                  { label: "CSV genérico", fn: () => exportGenericCSV(vigentes) },
                  { label: "Sage / ContaPlus", fn: () => exportSageCSV(vigentes) },
                  { label: "ContaPlus / A3", fn: () => exportContaplusCSV(vigentes) },
                  { label: "A3 / AccountExpert", fn: () => exportA3CSV(vigentes) },
                ].map(({ label, fn }) => (
                  <button
                    key={label}
                    onClick={() => { fn(); setShowExport(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-brand-text hover:bg-brand-gray transition"
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => { setShowExport(false); setCcError(null); setCcModal(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-brand-text hover:bg-brand-gray transition border-t border-brand-border/50 flex items-center justify-between gap-2"
                >
                  <span>ClassicConta (AIG)</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue">
                    Business
                  </span>
                </button>
              </div>
            )}
          </div>
          <Link
            href="/dashboard/facturas/nueva"
            className="bg-brand-blue text-white font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Nueva factura
          </Link>
        </div>
      </div>

      {/* Plan limit banner */}
      {profile?.plan === "gratis" && monthlyInvoiceCount >= 4 && (
        <PlanLimitBanner used={monthlyInvoiceCount} limit={5} />
      )}
      {showLimitModal && (
        <PlanLimitBanner used={5} limit={5} modal onDismiss={() => setShowLimitModal(false)} />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-1 uppercase tracking-wide">Total facturado</p>
          <p className="text-2xl font-bold text-brand-text">{formatCurrency(totalFacturado)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-1 uppercase tracking-wide">Cobrado</p>
          <p className="text-2xl font-bold text-brand-success">{formatCurrency(cobrado)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-1 uppercase tracking-wide">Pendiente</p>
          <p className="text-2xl font-bold text-brand-warning">{formatCurrency(pendiente)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
          <p className="text-xs text-brand-muted mb-1 uppercase tracking-wide">Vencidas</p>
          <p className="text-2xl font-bold text-brand-danger">{vencidas}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "pendiente", "cobrada", "vencida"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filter === f ? "bg-brand-blue text-white" : "bg-white border border-brand-border text-brand-muted hover:bg-brand-gray"
            }`}
          >
            {f === "all" ? "Todas" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({vigentes.filter((i) => i.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-brand-muted text-sm">Cargando facturas…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-brand-border mx-auto mb-3" />
            <p className="text-brand-muted text-sm">No hay facturas {filter !== "all" ? `con estado "${filter}"` : "todavía"}</p>
            <Link href="/dashboard/facturas/nueva" className="mt-3 inline-block text-sm text-brand-blue font-medium hover:underline">
              Crear primera factura →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-gray">
                <tr>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Número</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Vto.</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Cobro</th>
                  <th className="text-left px-5 py-3 text-brand-muted font-medium">Estado</th>
                  <th className="text-right px-5 py-3 text-brand-muted font-medium">Total</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {filtered.map((inv) => {
                  const status = STATUS_STYLES[inv.status] ?? STATUS_STYLES.pendiente;
                  const isMarking = markingId === inv.id;
                  const isSending = sendingEmailId === inv.id;
                  const sentEmail = emailSentIds.has(inv.id);
                  const anulada = inv.verifactuEstado === "anulada";
                  const esRectificativa = Boolean(inv.rectificaInvoiceId) || (inv.tipoFactura ?? "").startsWith("R");
                  const rectificada = inv.rectificaInvoiceId
                    ? invoices.find((i) => i.id === inv.rectificaInvoiceId)
                    : undefined;
                  return (
                    <tr key={inv.id} className="hover:bg-brand-gray/30 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-brand-muted flex-shrink-0" />
                          <span className="font-medium text-brand-blue">{inv.number}</span>
                          {(inv.verifactuEstado === "emitida" || inv.verifactuEstado === "rectificada") && (
                            <span
                              title="Factura emitida bajo VERI*FACTU: su contenido es inmutable (art. 8.2 RD 1007/2023). Para corregirla, emite una rectificativa o anúlala."
                              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue whitespace-nowrap"
                            >
                              VERI*FACTU
                            </span>
                          )}
                          {inv.verifactuEstado === "anulada" && (
                            <span
                              title="Factura anulada mediante registro de anulación Verifactu (art. 11 RD 1007/2023)"
                              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-danger/10 text-brand-danger whitespace-nowrap"
                            >
                              Anulada
                            </span>
                          )}
                          {inv.tipoFactura === "F2" && (
                            <span
                              title="Factura simplificada (sin NIF del cliente): se numera en su propia serie, separada de las facturas completas (art. 7.1 RD 1619/2012)."
                              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-gray text-brand-muted whitespace-nowrap"
                            >
                              Simplificada
                            </span>
                          )}
                          {esRectificativa && (
                            <span
                              title={`Factura rectificativa${rectificada ? ` de ${rectificada.number}` : ""} (art. 15 RD 1619/2012), en la serie de rectificativas.`}
                              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-warning/10 text-brand-warning whitespace-nowrap"
                            >
                              Rectificativa
                            </span>
                          )}
                          {inv.verifactuEstado === "rectificada" && (
                            <span
                              title="Esta factura tiene al menos una factura rectificativa emitida."
                              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-gray text-brand-muted whitespace-nowrap"
                            >
                              Rectificada
                            </span>
                          )}
                        </div>
                        {rectificada && (
                          <p className="text-[11px] text-brand-muted mt-0.5 ml-6">Rectifica a {rectificada.number}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-brand-text">{inv.clientName}</p>
                        {inv.clientNif && <p className="text-xs text-brand-muted">{inv.clientNif}</p>}
                      </td>
                      <td className="px-5 py-4 text-brand-muted whitespace-nowrap">{formatDate(inv.date)}</td>
                      <td className="px-5 py-4 text-brand-muted whitespace-nowrap">{formatDate(inv.dueDate)}</td>
                      <td className="px-5 py-4 text-xs text-brand-muted">
                        <div>{inv.paymentMethod ? PAYMENT_LABELS[inv.paymentMethod] : "—"}</div>
                        {inv.paymentDate && (
                          <div className="text-brand-success text-xs mt-0.5">{formatDate(inv.paymentDate)}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {anulada ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-brand-gray text-brand-muted">
                            Sin efectos
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
                            {status.icon}{status.label}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-brand-text whitespace-nowrap">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick mark as paid — opens modal */}
                          {!anulada && inv.status === "pendiente" && (
                            <button
                              onClick={() => handleMarkCobradaClick(inv)}
                              disabled={isMarking}
                              title="Marcar como cobrada"
                              className="p-1.5 rounded-lg text-brand-success hover:bg-brand-success/10 transition disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {!anulada && inv.status === "cobrada" && (
                            <button
                              onClick={() => handleMarkPendiente(inv)}
                              disabled={isMarking}
                              title="Revertir a pendiente"
                              className="p-1.5 rounded-lg text-brand-muted hover:bg-brand-gray transition disabled:opacity-50"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          )}
                          {/* Send email */}
                          {inv.clientEmail && !sentEmail && (
                            <button
                              onClick={() => handleSendEmail(inv)}
                              disabled={isSending}
                              title={`Enviar a ${inv.clientEmail}`}
                              className="p-1.5 rounded-lg text-brand-blue hover:bg-brand-blue/10 transition disabled:opacity-50"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          )}
                          {sentEmail && (
                            <span title="Email enviado">
                              <CheckCircle className="w-4 h-4 text-brand-success" />
                            </span>
                          )}
                          {/* More menu — button only; dropdown rendered via portal below */}
                          <button
                            onClick={(e: MouseEvent<HTMLButtonElement>) => {
                              if (openMenuId === inv.id) {
                                setOpenMenuId(null);
                                setMenuPos(null);
                              } else {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setMenuPos({
                                  top: rect.bottom + window.scrollY + 4,
                                  right: window.innerWidth - rect.right,
                                });
                                setOpenMenuId(inv.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-brand-muted hover:bg-brand-gray transition"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Row action menu (fixed position to avoid overflow-hidden clipping) */}
      {openMenuId && menuPos && (() => {
        const inv = filtered.find((i) => i.id === openMenuId);
        if (!inv) return null;
        return (
          <div
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bg-white border border-brand-border rounded-xl shadow-lg w-52 py-1">
              {(inv.verifactuEstado === "emitida" || inv.verifactuEstado === "rectificada") && (
                <p className="px-4 py-2 text-[11px] leading-snug text-brand-muted border-b border-brand-border/50">
                  Emitida bajo VERI*FACTU: contenido inmutable. Corrección solo por
                  rectificativa o anulación.
                </p>
              )}
              {(inv.verifactuEstado === "emitida" || inv.verifactuEstado === "rectificada") && (
                <button
                  onClick={() => abrirRectificativa(inv)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-brand-gray transition flex items-center gap-2 text-brand-text"
                >
                  <FilePenLine className="w-4 h-4 text-brand-muted" />
                  Emitir rectificativa
                </button>
              )}
              {inv.verifactuEstado === "emitida" && (
                <button
                  onClick={() => abrirAnulacion(inv)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-brand-gray transition flex items-center gap-2 text-brand-danger"
                >
                  <Ban className="w-4 h-4" />
                  Anular factura
                </button>
              )}
              <InvoicePDFButton
                invoice={inv}
                issuerName={issuer.name}
                issuerNif={issuer.nif}
                issuerAddress={issuer.address}
                compact
              />
              {inv.verifactuEstado !== "anulada" && inv.status !== "cobrada" && (
                <button
                  onClick={() => handleMarkCobradaClick(inv)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-brand-gray transition text-brand-success"
                >
                  Marcar cobrada
                </button>
              )}
              {inv.verifactuEstado !== "anulada" && inv.status !== "pendiente" && (
                <button
                  onClick={() => handleMarkPendiente(inv)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-brand-gray transition text-brand-muted"
                >
                  Marcar pendiente
                </button>
              )}
              {inv.verifactuEstado !== "anulada" && inv.status !== "vencida" && (
                <button
                  onClick={async () => {
                    await updateInvoiceStatus(inv.id, "vencida");
                    setOpenMenuId(null);
                    setMenuPos(null);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-brand-gray transition text-brand-danger"
                >
                  Marcar vencida
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── ClassicConta (AIG) export modal ───────────────────────────────── */}
      {ccModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-brand-blue" />
                <h3 className="font-semibold text-brand-text">Exportar a ClassicConta (AIG)</h3>
              </div>
              <button onClick={() => setCcModal(false)} className="text-brand-muted hover:text-brand-text">
                <X className="w-4 h-4" />
              </button>
            </div>

            {isDemo || !isBusiness ? (
              <>
                <p className="text-sm text-brand-muted">
                  {isDemo
                    ? "El export ClassicConta (AIG) requiere una cuenta real con plan Business."
                    : "La exportación a ClassicConta (AIG) es una función del plan Business: genera el diario y las subcuentas en el formato oficial del Importador de Asientos de ClassicConta, listos para tu gestoría."}
                </p>
                <Link
                  href="/precios"
                  className="block text-center bg-brand-blue text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition text-sm"
                >
                  Ver planes
                </Link>
              </>
            ) : (
              <>
                <p className="text-xs text-brand-muted">
                  ZIP con CC_subcuentas.txt y CC_diario.txt (formato oficial AIG/Conta6) e instrucciones
                  de importación. Importa primero las subcuentas y después el diario.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-brand-text mb-1">Desde</label>
                    <input
                      type="date"
                      value={ccDesde}
                      onChange={(e) => setCcDesde(e.target.value)}
                      className="w-full px-3 py-2.5 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-text mb-1">Hasta</label>
                    <input
                      type="date"
                      value={ccHasta}
                      onChange={(e) => setCcHasta(e.target.value)}
                      className="w-full px-3 py-2.5 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-text mb-1">Primer asiento</label>
                  <input
                    type="number"
                    min={1}
                    max={999999}
                    value={ccAsiento}
                    onChange={(e) => setCcAsiento(e.target.value)}
                    className="w-full px-3 py-2.5 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                  />
                  <p className="text-xs text-brand-muted mt-1.5">
                    Número del primer asiento en el ejercicio destino de ClassicConta (numeración correlativa).
                  </p>
                </div>
                {ccError && (
                  <div className="bg-brand-danger/10 border border-brand-danger/30 text-brand-danger rounded-xl px-3 py-2 text-xs font-medium">
                    {ccError}
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleExportClassicConta}
                    disabled={ccLoading}
                    className="flex-1 bg-brand-blue text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    {ccLoading ? "Generando…" : "Descargar ZIP"}
                  </button>
                  <button
                    onClick={() => setCcModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:bg-brand-gray text-sm transition"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Factura rectificativa (art. 15 RD 1619/2012) ───────────────────── */}
      {rectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FilePenLine className="w-5 h-5 text-brand-blue" />
                <h3 className="font-semibold text-brand-text">Emitir factura rectificativa</h3>
              </div>
              <button onClick={() => setRectModal(null)} className="text-brand-muted hover:text-brand-text" aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-brand-gray rounded-xl p-4 text-sm">
              <p className="font-medium text-brand-text">
                {rectModal.number} · {formatDate(rectModal.date)}
              </p>
              <p className="text-brand-muted mt-0.5">{rectModal.clientName}</p>
              <p className="text-xs text-brand-muted mt-2">
                Base {formatCurrency(rectModal.subtotal)} ·{" "}
                {rectModal.operacionExenta ? "IVA exento" : `IVA ${rectModal.ivaRate} %: ${formatCurrency(rectModal.iva)}`}
                {rectModal.irpfRate > 0 && ` · IRPF ${rectModal.irpfRate} %: -${formatCurrency(rectModal.irpf)}`} ·{" "}
                Total {formatCurrency(rectModal.total)}
              </p>
              {rectPrevias.length > 0 && (
                <p className="text-xs text-brand-text mt-2">
                  Ya rectificada por {rectPrevias.map((p) => p.number).join(", ")}. Base que sigue vigente:{" "}
                  <strong>{formatCurrency(rectVigente.subtotal)}</strong>.
                </p>
              )}
            </div>

            <p className="text-xs text-brand-muted leading-relaxed">
              Se emite una factura nueva, con fecha de hoy y numeración propia en la serie de rectificativas
              ({rectEsSimplificada ? "RS" : "R"}), que identifica a la factura rectificada y recoge solo la diferencia.
              La factura original no se modifica. Su registro se envía a la AEAT como el de cualquier factura.
            </p>

            <div className="space-y-2">
              <p className="text-sm font-medium text-brand-text">¿Qué hay que corregir?</p>
              <label className="flex items-start gap-2 text-sm text-brand-text cursor-pointer">
                <input
                  type="radio"
                  name="rect-modo"
                  checked={rectModo === "total"}
                  onChange={() => setRectModo("total")}
                  className="mt-1"
                />
                <span>
                  Dejar sin efecto todo el importe
                  <span className="block text-xs text-brand-muted">
                    Por ejemplo, la operación quedó sin efecto después de facturarla o se devolvió por completo.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-brand-text cursor-pointer">
                <input
                  type="radio"
                  name="rect-modo"
                  checked={rectModo === "importe"}
                  onChange={() => setRectModo("importe")}
                  className="mt-1"
                />
                <span>
                  Corregir el importe
                  <span className="block text-xs text-brand-muted">
                    Indica la base imponible que debería tener la operación (sin IVA).
                  </span>
                </span>
              </label>
              {rectModo === "importe" && (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={rectBase}
                  onChange={(e) => setRectBase(e.target.value)}
                  placeholder="Base imponible correcta"
                  className="w-full px-3 py-2.5 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              )}
            </div>

            {rectDif && !rectSinDiferencias && (
              <div className="border border-brand-border rounded-xl p-3 text-xs text-brand-text space-y-1">
                <p className="font-medium">Importes de la rectificativa</p>
                <div className="flex justify-between"><span className="text-brand-muted">Base imponible</span><span>{formatCurrency(rectDif.subtotal)}</span></div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">{rectModal.operacionExenta ? "IVA (exento)" : `IVA (${rectModal.ivaRate} %)`}</span>
                  <span>{formatCurrency(rectDif.iva)}</span>
                </div>
                {rectModal.irpfRate > 0 && (
                  <div className="flex justify-between"><span className="text-brand-muted">IRPF ({rectModal.irpfRate} %)</span><span>{formatCurrency(-rectDif.irpf)}</span></div>
                )}
                <div className="flex justify-between font-semibold border-t border-brand-border/60 pt-1">
                  <span>Total</span><span>{formatCurrency(redondear(rectDif.subtotal + rectDif.iva - rectDif.irpf))}</span>
                </div>
              </div>
            )}
            {rectSinDiferencias && (
              <p className="text-xs text-brand-warning">
                {rectModo === "total"
                  ? "La factura ya no tiene importe vigente que dejar sin efecto."
                  : "Esa base es la que ya está vigente: no hay nada que rectificar."}
              </p>
            )}

            {rectEsSimplificada ? (
              <p className="text-xs text-brand-muted">
                La factura rectificada es simplificada: su rectificativa se registra como «factura rectificativa en
                facturas simplificadas» (tipo R5).
              </p>
            ) : (
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">Tipo de rectificativa</label>
                <select
                  value={rectTipo}
                  onChange={(e) => setRectTipo(e.target.value)}
                  className="w-full px-3 py-2.5 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                >
                  <option value="">Elige la causa…</option>
                  {TIPOS_RECTIFICATIVA.map((t) => (
                    <option key={t.clave} value={t.clave}>
                      {t.clave} · {t.descripcionOficial}
                    </option>
                  ))}
                </select>
                {rectTipo && (
                  <p className="text-xs text-brand-muted mt-1.5">
                    {TIPOS_RECTIFICATIVA.find((t) => t.clave === rectTipo)?.ayuda}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Qué se rectifica y por qué</label>
              <textarea
                value={rectMotivo}
                onChange={(e) => setRectMotivo(e.target.value.slice(0, MAX_MOTIVO))}
                rows={2}
                placeholder="Se imprime en la factura rectificativa"
                className="w-full px-3 py-2.5 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue resize-none"
              />
            </div>

            {rectError && (
              <div className="bg-brand-danger/10 border border-brand-danger/30 text-brand-danger rounded-xl px-3 py-2 text-xs font-medium">
                {rectError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleEmitirRectificativa}
                disabled={!rectListo || rectLoading}
                className="flex-1 bg-brand-blue text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {rectLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {rectLoading ? "Emitiendo…" : "Emitir rectificativa"}
              </button>
              <button
                onClick={() => setRectModal(null)}
                className="px-4 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:bg-brand-gray text-sm transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Anulación (art. 11 RD 1007/2023) ───────────────────────────────── */}
      {anularModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-brand-danger" />
                <h3 className="font-semibold text-brand-text">Anular factura</h3>
              </div>
              <button onClick={() => setAnularModal(null)} className="text-brand-muted hover:text-brand-text" aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-brand-gray rounded-xl p-4 text-sm">
              <p className="font-medium text-brand-text">
                {anularModal.number} · {formatDate(anularModal.date)}
              </p>
              <p className="text-brand-muted mt-0.5">{anularModal.clientName}</p>
              <p className="text-brand-blue font-semibold mt-1">{formatCurrency(anularModal.total)}</p>
            </div>

            <div className="text-xs text-brand-text leading-relaxed space-y-2">
              <p>
                La anulación es para una factura <strong>emitida por error</strong>: por ejemplo, la de una operación
                que no se ha realizado o una factura de prueba. Genera un registro de anulación que se envía a la
                AEAT; la factura no se borra, queda marcada como anulada y deja de tener efectos.
              </p>
              <p>
                Si la operación es real y lo que hay que corregir es el importe, el IVA o los datos, lo que procede
                es una <strong>factura rectificativa</strong>, no la anulación.
              </p>
              <p className="text-brand-danger font-medium">Anular no se puede deshacer.</p>
            </div>

            <label className="flex items-start gap-2 text-sm text-brand-text cursor-pointer">
              <input
                type="checkbox"
                checked={anularConfirmado}
                onChange={(e) => setAnularConfirmado(e.target.checked)}
                className="mt-1"
              />
              <span>Esta factura se emitió por error y no corresponde a una operación realizada.</span>
            </label>

            {anularError && (
              <div className="bg-brand-danger/10 border border-brand-danger/30 text-brand-danger rounded-xl px-3 py-2 text-xs font-medium">
                {anularError}
              </div>
            )}

            <div className="flex gap-3 pt-1 flex-wrap">
              <button
                onClick={handleAnular}
                disabled={!anularConfirmado || anularLoading}
                className="flex-1 bg-brand-danger text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {anularLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {anularLoading ? "Anulando…" : "Anular factura"}
              </button>
              <button
                onClick={() => abrirRectificativa(anularModal)}
                className="px-4 py-2.5 rounded-xl border border-brand-border text-brand-text hover:bg-brand-gray text-sm transition"
              >
                Mejor rectificar
              </button>
              <button
                onClick={() => setAnularModal(null)}
                className="px-4 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:bg-brand-gray text-sm transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment date modal ─────────────────────────────────────────────── */}
      {cobradaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-brand-success" />
                <h3 className="font-semibold text-brand-text">Confirmar cobro</h3>
              </div>
              <button onClick={() => setCobradaModal(null)} className="text-brand-muted hover:text-brand-text">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-brand-gray rounded-xl p-4 text-sm">
              <p className="font-medium text-brand-text">{cobradaModal.number}</p>
              <p className="text-brand-muted mt-0.5">{cobradaModal.clientName}</p>
              <p className="text-brand-blue font-semibold mt-1">{formatCurrency(cobradaModal.total)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Fecha de cobro</label>
              <input
                type="date"
                value={cobradaDate}
                onChange={(e) => setCobradaDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
              <p className="text-xs text-brand-muted mt-1.5">
                Se registrará automáticamente como ingreso en el Cash Flow
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleConfirmCobrada}
                disabled={markingId === cobradaModal.id}
                className="flex-1 bg-brand-success text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Confirmar cobro
              </button>
              <button
                onClick={() => setCobradaModal(null)}
                className="px-4 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:bg-brand-gray text-sm transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
