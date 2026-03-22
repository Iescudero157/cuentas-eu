"use client";

import { TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { demoTransactions } from "@/lib/demo-data";

const SOURCE_COLORS: Record<string, string> = {
  stripe: "#635bff",
  paypal: "#003087",
  transferencia: "#2A5AAE",
  wise: "#9fe870",
  efectivo: "#6b7280",
  banco: "#1a1a2e",
};

const SOURCE_LABELS: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  transferencia: "Transferencia",
  wise: "Wise",
  efectivo: "Efectivo",
  banco: "Banco",
};

export default function IngresosPage() {
  const ingresos = demoTransactions
    .filter((t) => t.type === "ingreso")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const total = ingresos.reduce((s, t) => s + t.amount, 0);

  const bySource = ingresos.reduce<Record<string, number>>((acc, t) => {
    acc[t.source] = (acc[t.source] || 0) + t.amount;
    return acc;
  }, {});

  const pieData = Object.entries(bySource).map(([source, amount]) => ({
    name: SOURCE_LABELS[source] || source,
    value: amount,
    color: SOURCE_COLORS[source] || "#999",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Ingresos</h1>
        <p className="text-brand-muted text-sm mt-1">Tracking de todos tus ingresos por fuente</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total */}
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Total ingresos</p>
          <p className="text-3xl font-bold text-brand-success">{formatCurrency(total)}</p>
          <p className="text-xs text-brand-muted mt-1">{ingresos.length} transacciones</p>
        </div>

        {/* Pie chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <h3 className="font-semibold text-brand-text mb-4">Ingresos por fuente</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={((props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(0)}%`) as any}>
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
              {ingresos.map((tx) => (
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
