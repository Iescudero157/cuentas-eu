"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Brain, Plus, Search, X, Download, CheckCircle, Clock, Upload } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useTransactions } from "@/lib/hooks/useTransactions";
import TransactionModal from "@/components/TransactionModal";

const CATEGORY_COLORS: Record<string, string> = {
  software: "#635bff", hardware: "#2A5AAE", coworking: "#4ECB71",
  transporte: "#f59e0b", comida: "#ef4444", marketing: "#ec4899",
  telefono: "#06b6d4", formacion: "#8b5cf6", seguros: "#6b7280",
  material: "#14b8a6", servicios: "#f97316", otros: "#9ca3af",
};
const CATEGORY_LABELS: Record<string, string> = {
  software: "Software", hardware: "Hardware", coworking: "Coworking",
  transporte: "Transporte", comida: "Comida", marketing: "Marketing",
  telefono: "Teléfono", formacion: "Formación", seguros: "Seguros",
  material: "Material", servicios: "Servicios", otros: "Otros",
};

// LocalStorage key for tracking paid expense IDs
const PAID_EXPENSES_KEY = "kuentas_gastos_pagados";

function loadPaidIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PAID_EXPENSES_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function savePaidIds(ids: Set<string>) {
  try {
    localStorage.setItem(PAID_EXPENSES_KEY, JSON.stringify([...ids]));
  } catch { /* noop */ }
}

export default function GastosPage() {
  const { transactions, addTransaction } = useTransactions({ type: "gasto" });
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pendiente" | "pagada">("all");

  // Paid status tracked locally (would ideally be persisted in DB; here localStorage)
  const [paidIds, setPaidIds] = useState<Set<string>>(() => loadPaidIds());

  const togglePaid = useCallback((id: string) => {
    setPaidIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      savePaidIds(next);
      return next;
    });
  }, []);

  let filtered = transactions.filter((t) =>
    t.description.toLowerCase().includes(search.toLowerCase())
  );
  if (categoryFilter) {
    filtered = filtered.filter((t) => t.category === categoryFilter);
  }
  if (statusFilter === "pagada") {
    filtered = filtered.filter((t) => paidIds.has(t.id));
  } else if (statusFilter === "pendiente") {
    filtered = filtered.filter((t) => !paidIds.has(t.id));
  }

  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const aiCategorized = filtered.filter((t) => t.aiCategorized).length;
  const totalPendiente = transactions.filter((t) => !paidIds.has(t.id)).reduce((s, t) => s + t.amount, 0);
  const totalPagado = transactions.filter((t) => paidIds.has(t.id)).reduce((s, t) => s + t.amount, 0);

  const byCategory = filtered.reduce<Record<string, number>>((acc, t) => {
    const cat = t.category || "otros";
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {});

  const pieData = Object.entries(byCategory)
    .map(([cat, amount]) => ({
      name: CATEGORY_LABELS[cat] || cat,
      value: amount,
      color: CATEGORY_COLORS[cat] || "#999",
      key: cat,
    }))
    .sort((a, b) => b.value - a.value);

  function exportCSV() {
    const header = "Fecha,Descripcion,Categoria,Estado,Importe,IVA\n";
    const rows = filtered.map((tx) =>
      `${tx.date},"${tx.description}",${CATEGORY_LABELS[tx.category || "otros"]},${paidIds.has(tx.id) ? "Pagado" : "Pendiente"},${tx.amount},${tx.iva}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Gastos</h1>
          <p className="text-brand-muted text-sm mt-1">Gastos categorizados con IA</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            className="border border-brand-border text-brand-muted font-medium px-3 py-2 rounded-lg hover:bg-brand-gray transition flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <Link
            href="/dashboard/importar?tipo=gasto"
            className="border border-brand-border text-brand-muted font-medium px-3 py-2 rounded-lg hover:bg-brand-gray transition flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" /> Importar gastos
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="bg-brand-danger text-white font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Nuevo gasto
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Total gastos</p>
          <p className="text-3xl font-bold text-brand-danger">{formatCurrency(total)}</p>
          <p className="text-xs text-brand-muted mt-1">{filtered.length} transacciones</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Pendiente de pago</p>
          <p className="text-3xl font-bold text-brand-warning">{formatCurrency(totalPendiente)}</p>
          <p className="text-xs text-brand-muted mt-1">{transactions.filter((t) => !paidIds.has(t.id)).length} gastos</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Pagado</p>
          <p className="text-3xl font-bold text-brand-success">{formatCurrency(totalPagado)}</p>
          <p className="text-xs text-brand-muted mt-1">{transactions.filter((t) => paidIds.has(t.id)).length} gastos</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
            <Brain className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-brand-muted">Categorizados IA</p>
            <p className="text-2xl font-bold text-brand-text">{aiCategorized}/{filtered.length}</p>
          </div>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {(["all", "pendiente", "pagada"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              statusFilter === f ? "bg-brand-blue text-white" : "bg-white border border-brand-border text-brand-muted hover:bg-brand-gray"
            }`}
          >
            {f === "all" ? "Todos" : f === "pendiente" ? "Pendiente de pago" : "Pagados"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie chart */}
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <h3 className="font-semibold text-brand-text mb-4">Por categoría</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {pieData.slice(0, 5).map((d) => (
              <button
                key={d.name}
                onClick={() => setCategoryFilter(categoryFilter === d.key ? "" : d.key)}
                className={`flex items-center justify-between text-sm w-full hover:bg-brand-gray/50 rounded-lg px-2 py-1 transition ${categoryFilter === d.key ? "bg-brand-blue/5" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-brand-muted">{d.name}</span>
                </div>
                <span className="font-medium">{formatCurrency(d.value)}</span>
              </button>
            ))}
            {categoryFilter && (
              <button onClick={() => setCategoryFilter("")} className="text-xs text-brand-blue hover:underline w-full text-center mt-2">
                Quitar filtro
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-brand-border flex items-center justify-between">
            <h3 className="font-semibold text-brand-text">Todos los gastos</h3>
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-1.5 border border-brand-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-brand-muted" />
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-gray">
                <tr>
                  <th className="text-left px-6 py-3 text-brand-muted font-medium">Fecha</th>
                  <th className="text-left px-6 py-3 text-brand-muted font-medium">Descripción</th>
                  <th className="text-left px-6 py-3 text-brand-muted font-medium">Categoría</th>
                  <th className="text-right px-6 py-3 text-brand-muted font-medium">Importe</th>
                  <th className="text-center px-4 py-3 text-brand-muted font-medium">Pagado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {filtered.map((tx) => {
                  const isPaid = paidIds.has(tx.id);
                  return (
                    <tr key={tx.id} className={`hover:bg-brand-gray/50 transition ${isPaid ? "opacity-60" : ""}`}>
                      <td className="px-6 py-3 text-brand-muted">{formatDate(tx.date)}</td>
                      <td className="px-6 py-3 font-medium text-brand-text">{tx.description}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs font-medium px-2 py-1 rounded-full"
                            style={{
                              backgroundColor: (CATEGORY_COLORS[tx.category || "otros"] || "#999") + "15",
                              color: CATEGORY_COLORS[tx.category || "otros"] || "#999",
                            }}
                          >
                            {CATEGORY_LABELS[tx.category || "otros"]}
                          </span>
                          {tx.aiCategorized && (
                            <span className="text-[10px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">IA</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-brand-danger">
                        -{formatCurrency(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => togglePaid(tx.id)}
                          title={isPaid ? "Marcar como pendiente" : "Marcar como pagado"}
                          className={`p-1.5 rounded-lg transition ${
                            isPaid
                              ? "text-brand-success hover:bg-brand-success/10"
                              : "text-brand-muted hover:bg-brand-gray"
                          }`}
                        >
                          {isPaid ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-brand-muted">
                      {search || categoryFilter ? "No se encontraron gastos" : "Aún no tienes gastos registrados"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <TransactionModal
          type="gasto"
          onSave={addTransaction}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
