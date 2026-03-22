"use client";

import { TrendingDown, Brain } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { demoTransactions } from "@/lib/demo-data";

const CATEGORY_COLORS: Record<string, string> = {
  software: "#635bff",
  hardware: "#2A5AAE",
  coworking: "#4ECB71",
  transporte: "#f59e0b",
  comida: "#ef4444",
  marketing: "#ec4899",
  telefono: "#06b6d4",
  formacion: "#8b5cf6",
  seguros: "#6b7280",
  material: "#14b8a6",
  servicios: "#f97316",
  otros: "#9ca3af",
};

const CATEGORY_LABELS: Record<string, string> = {
  software: "Software",
  hardware: "Hardware",
  coworking: "Coworking",
  transporte: "Transporte",
  comida: "Comida",
  marketing: "Marketing",
  telefono: "Telefono",
  formacion: "Formacion",
  seguros: "Seguros",
  material: "Material",
  servicios: "Servicios",
  otros: "Otros",
};

export default function GastosPage() {
  const gastos = demoTransactions
    .filter((t) => t.type === "gasto")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const total = gastos.reduce((s, t) => s + t.amount, 0);
  const aiCategorized = gastos.filter((t) => t.aiCategorized).length;

  const byCategory = gastos.reduce<Record<string, number>>((acc, t) => {
    const cat = t.category || "otros";
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {});

  const pieData = Object.entries(byCategory)
    .map(([cat, amount]) => ({
      name: CATEGORY_LABELS[cat] || cat,
      value: amount,
      color: CATEGORY_COLORS[cat] || "#999",
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Gastos</h1>
        <p className="text-brand-muted text-sm mt-1">Gastos categorizados automaticamente con IA</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Total gastos</p>
          <p className="text-3xl font-bold text-brand-danger">{formatCurrency(total)}</p>
          <p className="text-xs text-brand-muted mt-1">{gastos.length} transacciones</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Gastos deducibles</p>
          <p className="text-3xl font-bold text-brand-blue">{formatCurrency(total * 0.85)}</p>
          <p className="text-xs text-brand-muted mt-1">~85% de tus gastos</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
            <Brain className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-brand-muted">Categorizados por IA</p>
            <p className="text-2xl font-bold text-brand-text">{aiCategorized}/{gastos.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie chart */}
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <h3 className="font-semibold text-brand-text mb-4">Por categoria</h3>
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
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-brand-muted">{d.name}</span>
                </div>
                <span className="font-medium">{formatCurrency(d.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-brand-border">
            <h3 className="font-semibold text-brand-text">Todos los gastos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-gray">
                <tr>
                  <th className="text-left px-6 py-3 text-brand-muted font-medium">Fecha</th>
                  <th className="text-left px-6 py-3 text-brand-muted font-medium">Descripcion</th>
                  <th className="text-left px-6 py-3 text-brand-muted font-medium">Categoria</th>
                  <th className="text-right px-6 py-3 text-brand-muted font-medium">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {gastos.map((tx) => (
                  <tr key={tx.id} className="hover:bg-brand-gray/50">
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
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                            IA
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-brand-danger">
                      -{formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
