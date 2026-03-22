"use client";

import { TrendingUp, TrendingDown, Wallet, Calculator, AlertTriangle, Clock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCurrentMonthStats, getMonthlyData, demoTransactions } from "@/lib/demo-data";
import { getFiscalAlerts } from "@/lib/tax-calculator";

export default function DashboardPage() {
  const stats = getCurrentMonthStats();
  const monthlyData = getMonthlyData();
  const alerts = getFiscalAlerts();
  const recentTx = [...demoTransactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const kpis = [
    {
      label: "Ingresos este mes",
      value: formatCurrency(stats.ingresos),
      icon: TrendingUp,
      color: "text-brand-success",
      bg: "bg-brand-success/10",
    },
    {
      label: "Gastos este mes",
      value: formatCurrency(stats.gastos),
      icon: TrendingDown,
      color: "text-brand-danger",
      bg: "bg-brand-danger/10",
    },
    {
      label: "Beneficio neto",
      value: formatCurrency(stats.beneficio),
      icon: Wallet,
      color: "text-brand-blue",
      bg: "bg-brand-blue/10",
    },
    {
      label: "Impuestos estimados",
      value: formatCurrency(stats.impuestosEstimados),
      icon: Calculator,
      color: "text-brand-warning",
      bg: "bg-brand-warning/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Dashboard</h1>
        <p className="text-brand-muted text-sm mt-1">Resumen de tus finanzas en tiempo real</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-brand-muted">{kpi.label}</span>
              <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-brand-text">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-brand-warning/5 border border-brand-warning/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-brand-warning" />
            <h3 className="font-semibold text-brand-text">Proximas obligaciones fiscales</h3>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between text-sm p-2 rounded-lg ${
                  alert.urgent ? "bg-brand-danger/5" : "bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${alert.urgent ? "text-brand-danger" : "text-brand-muted"}`} />
                  <span className="font-medium">{alert.modelo}</span>
                  <span className="text-brand-muted">- {alert.description}</span>
                </div>
                <span className={`font-medium ${alert.urgent ? "text-brand-danger" : "text-brand-muted"}`}>
                  {alert.daysLeft === 0 ? "HOY" : `${alert.daysLeft} dias`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <h3 className="font-semibold text-brand-text mb-4">Ingresos vs Gastos (6 meses)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: unknown) => formatCurrency(Number(value))}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Legend />
                <Bar dataKey="ingresos" name="Ingresos" fill="#2A5AAE" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tax Reserve */}
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <h3 className="font-semibold text-brand-text mb-4">Guardar para impuestos</h3>
          <div className="space-y-4">
            <div className="text-center p-4 rounded-xl bg-brand-warning/5">
              <p className="text-sm text-brand-muted mb-1">Deberias reservar</p>
              <p className="text-3xl font-bold text-brand-warning">
                {formatCurrency(stats.impuestosEstimados)}
              </p>
              <p className="text-xs text-brand-muted mt-1">este trimestre</p>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-brand-muted">IVA (Modelo 303)</span>
                <span className="font-medium">{formatCurrency(stats.impuestosEstimados * 0.6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-brand-muted">IRPF (Modelo 130)</span>
                <span className="font-medium">{formatCurrency(stats.impuestosEstimados * 0.4)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm">
        <div className="p-6 border-b border-brand-border">
          <h3 className="font-semibold text-brand-text">Ultimas transacciones</h3>
        </div>
        <div className="divide-y divide-brand-border/50">
          {recentTx.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-6 py-3.5">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    tx.type === "ingreso" ? "bg-brand-success/10" : "bg-brand-danger/10"
                  }`}
                >
                  {tx.type === "ingreso" ? (
                    <TrendingUp className="w-4 h-4 text-brand-success" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-brand-danger" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-text">{tx.description}</p>
                  <p className="text-xs text-brand-muted">{formatDate(tx.date)}{tx.client ? ` - ${tx.client}` : ""}</p>
                </div>
              </div>
              <span
                className={`text-sm font-semibold ${
                  tx.type === "ingreso" ? "text-brand-success" : "text-brand-danger"
                }`}
              >
                {tx.type === "ingreso" ? "+" : "-"}{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
