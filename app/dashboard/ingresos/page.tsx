"use client";

import { useState } from "react";
import { TrendingUp, Plus, Search, X, Download } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useTransactions } from "@/lib/hooks/useTransactions";
import TransactionModal from "@/components/TransactionModal";

const SOURCE_COLORS: Record<string, string> = {
  stripe: "#635bff", paypal: "#003087", transferencia: "#2A5AAE",
  wise: "#9fe870", efectivo: "#6b7280", banco: "#1a1a2e",
};
const SOURCE_LABELS: Record<string, string> = {
  stripe: "Stripe", paypal: "PayPal", transferencia: "Transferencia",
  wise: "Wise", efectivo: "Efectivo", banco: "Banco",
};

export default function IngresosPage() {
  const { transactions, addTransaction } = useTransactions({ type: "ingreso" });
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const filtered = transactions.filter((t) =>
    `${t.description} ${t.client || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const total = filtered.reduce((s, t) => s + t.amount, 0);

  const bySource = filtered.reduce<Record<string, number>>((acc, t) => {
    acc[t.source] = (acc[t.source] || 0) + t.amount;
    return acc;
  }, {});

  const pieData = Object.entries(bySource).map(([source, amount]) => ({
    name: SOURCE_LABELS[source] || source,
    value: amount,
    color: SOURCE_COLORS[source] || "#999",
  }));

  function exportCSV() {
    const header = "Fecha,Descripcion,Cliente,Fuente,Importe,IVA\n";
    const rows = filtered.map((tx) =>
      `${tx.date},"${tx.description}","${tx.client || ""}",${SOURCE_LABELS[tx.source]},${tx.amount},${tx.iva}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ingresos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Ingresos</h1>
          <p className="text-brand-muted text-sm mt-1">Tracking de todos tus ingresos por fuente</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="border border-brand-border text-brand-muted font-medium px-3 py-2 rounded-lg hover:bg-brand-gray transition flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-brand-success text-white font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Nuevo ingreso
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Total ingresos</p>
          <p className="text-3xl font-bold text-brand-success">{formatCurrency(total)}</p>
          <p className="text-xs text-brand-muted mt-1">{filtered.length} transacciones</p>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <h3 className="font-semibold text-brand-text mb-4">Ingresos por fuente</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={((props: Record<string, unknown>) => `${props.name} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`) as unknown as boolean}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descripcion o cliente..."
          className="w-full pl-10 pr-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm bg-white"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-brand-border">
          <h3 className="font-semibold text-brand-text">Todos los ingresos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-gray">
              <tr>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Fecha</th>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Descripcion</th>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Cliente</th>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Fuente</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Importe</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">IVA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50">
              {filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-brand-gray/50">
                  <td className="px-6 py-3 text-brand-muted">{formatDate(tx.date)}</td>
                  <td className="px-6 py-3 font-medium text-brand-text">{tx.description}</td>
                  <td className="px-6 py-3 text-brand-muted">{tx.client || "-"}</td>
                  <td className="px-6 py-3">
                    <span
                      className="text-xs font-medium px-2 py-1 rounded-full"
                      style={{ backgroundColor: SOURCE_COLORS[tx.source] + "15", color: SOURCE_COLORS[tx.source] }}
                    >
                      {SOURCE_LABELS[tx.source]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-brand-success">
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="px-6 py-3 text-right text-brand-muted">{formatCurrency(tx.iva)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-brand-muted">
                    {search ? "No se encontraron ingresos" : "Aun no tienes ingresos registrados"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <TransactionModal
          type="ingreso"
          onSave={addTransaction}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
