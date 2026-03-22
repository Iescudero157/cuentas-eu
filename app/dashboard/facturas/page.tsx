"use client";

import Link from "next/link";
import { Plus, FileText, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { demoInvoices } from "@/lib/demo-data";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  cobrada: { bg: "bg-brand-success/10", text: "text-brand-success", label: "Cobrada" },
  pendiente: { bg: "bg-brand-warning/10", text: "text-brand-warning", label: "Pendiente" },
  vencida: { bg: "bg-brand-danger/10", text: "text-brand-danger", label: "Vencida" },
};

export default function FacturasPage() {
  const invoices = [...demoInvoices].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const totalFacturado = invoices.reduce((s, i) => s + i.total, 0);
  const pendiente = invoices.filter((i) => i.status === "pendiente").reduce((s, i) => s + i.total, 0);
  const cobrado = invoices.filter((i) => i.status === "cobrada").reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Facturas</h1>
          <p className="text-brand-muted text-sm mt-1">Gestiona y crea facturas legales</p>
        </div>
        <Link
          href="/dashboard/facturas/nueva"
          className="gradient-brand text-white font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Nueva factura
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Total facturado</p>
          <p className="text-3xl font-bold text-brand-text">{formatCurrency(totalFacturado)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Cobrado</p>
          <p className="text-3xl font-bold text-brand-success">{formatCurrency(cobrado)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Pendiente de cobro</p>
          <p className="text-3xl font-bold text-brand-warning">{formatCurrency(pendiente)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-gray">
              <tr>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Numero</th>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Cliente</th>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Fecha</th>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Vencimiento</th>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Estado</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50">
              {invoices.map((inv) => {
                const status = STATUS_STYLES[inv.status];
                return (
                  <tr key={inv.id} className="hover:bg-brand-gray/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-brand-muted" />
                        <span className="font-medium text-brand-blue">{inv.number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-brand-text">{inv.clientName}</p>
                      <p className="text-xs text-brand-muted">{inv.clientNif}</p>
                    </td>
                    <td className="px-6 py-4 text-brand-muted">{formatDate(inv.date)}</td>
                    <td className="px-6 py-4 text-brand-muted">{formatDate(inv.dueDate)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-brand-text">
                      {formatCurrency(inv.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
