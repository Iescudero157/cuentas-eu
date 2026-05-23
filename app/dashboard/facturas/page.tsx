"use client";

import Link from "next/link";
import { Plus, FileText, CheckCircle, Mail, Download, MoreHorizontal, Clock, AlertTriangle, ChevronDown, X, CalendarCheck } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useInvoices } from "@/lib/hooks/useInvoices";
import { useAuth } from "@/lib/hooks/useAuth";
import type { Invoice, PaymentMethod } from "@/lib/types";
import PlanLimitBanner from "@/components/PlanLimitBanner";

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
  const { invoices, loading, updateInvoiceStatus } = useInvoices();
  const { user, isDemo, profile } = useAuth();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [monthlyInvoiceCount, setMonthlyInvoiceCount] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailSentIds, setEmailSentIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pendiente" | "cobrada" | "vencida">("all");

  // Payment date modal
  const [cobradaModal, setCobradaModal] = useState<Invoice | null>(null);
  const [cobradaDate, setCobradaDate] = useState(today());

  // Export dropdown
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const totalFacturado = invoices.reduce((s, i) => s + i.total, 0);
  const pendiente = invoices.filter((i) => i.status === "pendiente").reduce((s, i) => s + i.total, 0);
  const cobrado = invoices.filter((i) => i.status === "cobrada").reduce((s, i) => s + i.total, 0);
  const vencidas = invoices.filter((i) => i.status === "vencida").length;

  const filtered = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  useEffect(() => {
    if (!invoices.length || profile?.plan !== "gratis") return;
    const now = new Date();
    const thisMonth = now.getFullYear() * 100 + now.getMonth();
    const count = invoices.filter(inv => {
      const d = new Date(inv.date);
      return d.getFullYear() * 100 + d.getMonth() === thisMonth;
    }).length;
    setMonthlyInvoiceCount(count);
  }, [invoices, profile?.plan]);

  // Close export dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  // Issuer profile (simple fallback)
  const issuer = { name: "Tu empresa", nif: "", address: "" };

  return (
    <div className="space-y-6">
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
              className="flex items-center gap-2 border border-brand-border text-brand-muted px-4 py-2 rounded-lg hover:bg-brand-gray transition text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Exportar <ChevronDown className="w-3 h-3" />
            </button>
            {showExport && (
              <div className="absolute right-0 top-10 z-50 bg-white border border-brand-border rounded-xl shadow-lg w-52 py-1">
                <p className="px-4 py-2 text-xs text-brand-muted font-medium uppercase tracking-wide">Formato</p>
                {[
                  { label: "CSV genérico", fn: () => exportGenericCSV(invoices) },
                  { label: "Sage / ContaPlus", fn: () => exportSageCSV(invoices) },
                  { label: "ContaPlus / A3", fn: () => exportContaplusCSV(invoices) },
                  { label: "A3 / AccountExpert", fn: () => exportA3CSV(invoices) },
                ].map(({ label, fn }) => (
                  <button
                    key={label}
                    onClick={() => { fn(); setShowExport(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-brand-text hover:bg-brand-gray transition"
                  >
                    {label}
                  </button>
                ))}
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
                ({invoices.filter((i) => i.status === f).length})
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
                  return (
                    <tr key={inv.id} className="hover:bg-brand-gray/30 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-brand-muted flex-shrink-0" />
                          <span className="font-medium text-brand-blue">{inv.number}</span>
                        </div>
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
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
                          {status.icon}{status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-brand-text whitespace-nowrap">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1 relative">
                          {/* Quick mark as paid — opens modal */}
                          {inv.status === "pendiente" && (
                            <button
                              onClick={() => handleMarkCobradaClick(inv)}
                              disabled={isMarking}
                              title="Marcar como cobrada"
                              className="p-1.5 rounded-lg text-brand-success hover:bg-brand-success/10 transition disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {inv.status === "cobrada" && (
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
                          {/* More menu */}
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                              className="p-1.5 rounded-lg text-brand-muted hover:bg-brand-gray transition"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {openMenuId === inv.id && (
                              <div className="absolute right-0 top-8 z-50 bg-white border border-brand-border rounded-xl shadow-lg w-44 py-1">
                                <InvoicePDFButton
                                  invoice={inv}
                                  issuerName={issuer.name}
                                  issuerNif={issuer.nif}
                                  issuerAddress={issuer.address}
                                  compact
                                />
                                {inv.status !== "cobrada" && (
                                  <button
                                    onClick={() => handleMarkCobradaClick(inv)}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-brand-gray transition text-brand-success"
                                  >
                                    Marcar cobrada
                                  </button>
                                )}
                                {inv.status !== "pendiente" && (
                                  <button
                                    onClick={() => handleMarkPendiente(inv)}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-brand-gray transition text-brand-muted"
                                  >
                                    Marcar pendiente
                                  </button>
                                )}
                                {inv.status !== "vencida" && (
                                  <button
                                    onClick={async () => { await updateInvoiceStatus(inv.id, "vencida"); setOpenMenuId(null); }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-brand-gray transition text-brand-danger"
                                  >
                                    Marcar vencida
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
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
