"use client";

import { useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, Loader2 } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useTransactions } from "@/lib/hooks/useTransactions";

export default function CashFlowPage() {
  const { transactions, loading } = useTransactions();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const yr = d.getFullYear();
      const mn = d.getMonth();
      const monthTx = transactions.filter((tx) => {
        const td = new Date(tx.date);
        return td.getFullYear() === yr && td.getMonth() === mn;
      });
      const ingresos = monthTx
        .filter((t) => t.type === "ingreso")
        .reduce((s, t) => s + t.amount, 0);
      const gastos = monthTx
        .filter((t) => t.type === "gasto")
        .reduce((s, t) => s + t.amount, 0);
      months.push({
        month: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
        ingresos,
        gastos,
        projected: false,
        saldo: ingresos - gastos,
      });
    }
    return months;
  }, [transactions, currentYear, currentMonth]);

  const projection = useMemo(() => {
    // Average last 3 months for projection
    const last3 = monthlyData.slice(-3);
    const avgIngresos = last3.length
      ? last3.reduce((s, m) => s + m.ingresos, 0) / last3.length
      : 0;
    const avgGastos = last3.length
      ? last3.reduce((s, m) => s + m.gastos, 0) / last3.length
      : 0;

    const projectedMonths = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(currentYear, currentMonth + i, 1);
      projectedMonths.push({
        month: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
        ingresos: Math.round(avgIngresos),
        gastos: Math.round(avgGastos),
        projected: true,
        saldo: Math.round(avgIngresos - avgGastos),
      });
    }

    return [...monthlyData, ...projectedMonths];
  }, [monthlyData, currentYear, currentMonth]);

  const avgIngresos =
    monthlyData.length > 0
      ? monthlyData.reduce((s, m) => s + m.ingresos, 0) / monthlyData.length
      : 0;
  const avgGastos =
    monthlyData.length > 0
      ? monthlyData.reduce((s, m) => s + m.gastos, 0) / monthlyData.length
      : 0;
  const trend = avgIngresos >= avgGastos ? "positiva" : "negativa";

  const futureMonths = projection.filter((p) => p.projected);
  const hasNegative = futureMonths.some((p) => p.saldo < 0);
  const firstProjectedMonth = projection.find((p) => p.projected)?.month;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Cash Flow</h1>
        <p className="text-brand-muted text-sm mt-1">Predicción de flujo de caja para los próximos 3 meses</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Media ingresos/mes</p>
          <p className="text-3xl font-bold text-brand-success">{formatCurrency(avgIngresos)}</p>
          <p className="text-xs text-brand-muted mt-1">últimos 6 meses</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Media gastos/mes</p>
          <p className="text-3xl font-bold text-brand-danger">{formatCurrency(avgGastos)}</p>
          <p className="text-xs text-brand-muted mt-1">últimos 6 meses</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Tendencia</p>
          <div className="flex items-center gap-2">
            {trend === "positiva" ? (
              <TrendingUp className="w-6 h-6 text-brand-success" />
            ) : (
              <TrendingDown className="w-6 h-6 text-brand-danger" />
            )}
            <p className={`text-2xl font-bold ${trend === "positiva" ? "text-brand-success" : "text-brand-danger"}`}>
              {trend === "positiva" ? "Positiva" : "Negativa"}
            </p>
          </div>
          <p className="text-xs text-brand-muted mt-1">
            Beneficio medio: {formatCurrency(avgIngresos - avgGastos)}/mes
          </p>
        </div>
      </div>

      {/* Alert */}
      {hasNegative && (
        <div className="bg-brand-danger/5 border border-brand-danger/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-brand-danger mt-0.5" />
          <div>
            <p className="font-semibold text-brand-text">Alerta de cash flow</p>
            <p className="text-sm text-brand-muted">
              Se predice un saldo negativo en los próximos meses. Considera reducir gastos o asegurar nuevos clientes.
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-brand-blue" />
          <h3 className="font-semibold text-brand-text">Proyección Cash Flow (6 meses + 3 predicción)</h3>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projection}>
              <defs>
                <linearGradient id="ingresos-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ECB71" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4ECB71" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gastos-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: unknown) => formatCurrency(Number(value))}
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Legend />
              {firstProjectedMonth && (
                <ReferenceLine
                  x={firstProjectedMonth}
                  stroke="#2A5AAE"
                  strokeDasharray="5 5"
                  label={{ value: "Predicción", fill: "#2A5AAE", fontSize: 11 }}
                />
              )}
              <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#4ECB71" fill="url(#ingresos-grad)" strokeWidth={2} />
              <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#ef4444" fill="url(#gastos-grad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Projection table */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-brand-border">
          <h3 className="font-semibold text-brand-text">Detalle de proyección</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-gray">
              <tr>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Mes</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Ingresos</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Gastos</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Balance</th>
                <th className="text-center px-6 py-3 text-brand-muted font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50">
              {projection.map((p, i) => (
                <tr key={i} className={p.projected ? "bg-brand-blue/5" : "hover:bg-brand-gray/50"}>
                  <td className="px-6 py-3 font-medium">{p.month}</td>
                  <td className="px-6 py-3 text-right text-brand-success">{formatCurrency(p.ingresos)}</td>
                  <td className="px-6 py-3 text-right text-brand-danger">{formatCurrency(p.gastos)}</td>
                  <td className={`px-6 py-3 text-right font-semibold ${p.ingresos - p.gastos >= 0 ? "text-brand-success" : "text-brand-danger"}`}>
                    {formatCurrency(p.ingresos - p.gastos)}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {p.projected ? (
                      <span className="text-xs bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full font-medium">
                        Predicción IA
                      </span>
                    ) : (
                      <span className="text-xs bg-brand-gray text-brand-muted px-2 py-0.5 rounded-full">
                        Real
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
