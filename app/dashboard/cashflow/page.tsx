"use client";

import { useMemo, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, Loader2, Info } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useTransactions } from "@/lib/hooks/useTransactions";

type Scenario = "conservador" | "base" | "optimista";

const SCENARIO_CONFIG: Record<Scenario, { label: string; color: string; incomeMultiplier: number; expenseMultiplier: number; description: string }> = {
  conservador: {
    label: "Conservador",
    color: "bg-brand-warning/10 text-brand-warning border-brand-warning/30",
    incomeMultiplier: 0.80,
    expenseMultiplier: 1.05,
    description: "Ingresos −20%, gastos +5%",
  },
  base: {
    label: "Base",
    color: "bg-brand-blue/10 text-brand-blue border-brand-blue/30",
    incomeMultiplier: 1.0,
    expenseMultiplier: 1.0,
    description: "Tendencia actual",
  },
  optimista: {
    label: "Optimista",
    color: "bg-brand-success/10 text-brand-success border-brand-success/30",
    incomeMultiplier: 1.20,
    expenseMultiplier: 0.90,
    description: "Ingresos +20%, gastos −10%",
  },
};

export default function CashFlowPage() {
  const { transactions, loading } = useTransactions();
  const [scenario, setScenario] = useState<Scenario>("base");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const { incomeMultiplier, expenseMultiplier } = SCENARIO_CONFIG[scenario];

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
      const ingresos = monthTx.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
      const gastos = monthTx.filter((t) => t.type === "gasto").reduce((s, t) => s + t.amount, 0);
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
    const last3 = monthlyData.slice(-3);
    const avgIngresos = last3.length ? last3.reduce((s, m) => s + m.ingresos, 0) / last3.length : 0;
    const avgGastos = last3.length ? last3.reduce((s, m) => s + m.gastos, 0) / last3.length : 0;

    const projIngresos = Math.round(avgIngresos * incomeMultiplier);
    const projGastos = Math.round(avgGastos * expenseMultiplier);

    const projectedMonths = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(currentYear, currentMonth + i, 1);
      projectedMonths.push({
        month: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
        ingresos: projIngresos,
        gastos: projGastos,
        projected: true,
        saldo: projIngresos - projGastos,
      });
    }

    return [...monthlyData, ...projectedMonths];
  }, [monthlyData, currentYear, currentMonth, incomeMultiplier, expenseMultiplier]);

  const avgIngresos = monthlyData.length > 0 ? monthlyData.reduce((s, m) => s + m.ingresos, 0) / monthlyData.length : 0;
  const avgGastos = monthlyData.length > 0 ? monthlyData.reduce((s, m) => s + m.gastos, 0) / monthlyData.length : 0;
  const trend = avgIngresos >= avgGastos ? "positiva" : "negativa";

  const futureMonths = projection.filter((p) => p.projected);
  const hasNegative = futureMonths.some((p) => p.saldo < 0);
  const firstProjectedMonth = projection.find((p) => p.projected)?.month;

  // Business scenarios comparison
  const scenarioResults = useMemo(() => {
    const last3 = monthlyData.slice(-3);
    const avgI = last3.length ? last3.reduce((s, m) => s + m.ingresos, 0) / last3.length : 0;
    const avgG = last3.length ? last3.reduce((s, m) => s + m.gastos, 0) / last3.length : 0;
    return (["conservador", "base", "optimista"] as Scenario[]).map((s) => {
      const cfg = SCENARIO_CONFIG[s];
      const projI = avgI * cfg.incomeMultiplier;
      const projG = avgG * cfg.expenseMultiplier;
      return {
        scenario: s,
        label: cfg.label,
        ingresosMensual: projI,
        gastosMensual: projG,
        beneficioMensual: projI - projG,
        beneficioAnual: (projI - projG) * 12,
      };
    });
  }, [monthlyData]);

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
        <p className="text-brand-muted text-sm mt-1">Proyección de flujo de caja y simulación de escenarios de negocio</p>
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
              En el escenario <strong>{SCENARIO_CONFIG[scenario].label}</strong> se predice un saldo negativo en los próximos meses. Considera reducir gastos o asegurar nuevos clientes.
            </p>
          </div>
        </div>
      )}

      {/* Scenario selector */}
      <div className="bg-white rounded-xl p-5 border border-brand-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-brand-blue" />
          <h3 className="font-semibold text-brand-text">Escenario de proyección</h3>
          <span className="ml-auto flex items-center gap-1 text-xs text-brand-muted">
            <Info className="w-3.5 h-3.5" /> Basado en tus últimos 3 meses
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["conservador", "base", "optimista"] as Scenario[]).map((s) => {
            const cfg = SCENARIO_CONFIG[s];
            const active = scenario === s;
            return (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`p-4 rounded-xl border text-left transition ${
                  active
                    ? cfg.color + " shadow-sm font-semibold"
                    : "border-brand-border hover:bg-brand-gray/50 text-brand-muted"
                }`}
              >
                <p className="text-sm font-semibold">{cfg.label}</p>
                <p className="text-xs mt-0.5 opacity-80">{cfg.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-brand-blue" />
          <h3 className="font-semibold text-brand-text">
            Proyección Cash Flow — escenario {SCENARIO_CONFIG[scenario].label}
          </h3>
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

      {/* Business projections comparison */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-brand-border">
          <h3 className="font-semibold text-brand-text">Proyecciones de negocio — comparativa de escenarios</h3>
          <p className="text-xs text-brand-muted mt-1">Estimación mensual y anual según distintas hipótesis de crecimiento</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-gray">
              <tr>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Escenario</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Ingresos/mes</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Gastos/mes</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Beneficio/mes</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Beneficio anual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50">
              {scenarioResults.map((r) => {
                const cfg = SCENARIO_CONFIG[r.scenario];
                return (
                  <tr
                    key={r.scenario}
                    onClick={() => setScenario(r.scenario)}
                    className={`cursor-pointer transition ${scenario === r.scenario ? "bg-brand-blue/5" : "hover:bg-brand-gray/50"}`}
                  >
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                        {r.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-brand-success font-medium">{formatCurrency(r.ingresosMensual)}</td>
                    <td className="px-6 py-4 text-right text-brand-danger font-medium">{formatCurrency(r.gastosMensual)}</td>
                    <td className={`px-6 py-4 text-right font-semibold ${r.beneficioMensual >= 0 ? "text-brand-success" : "text-brand-danger"}`}>
                      {formatCurrency(r.beneficioMensual)}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold text-base ${r.beneficioAnual >= 0 ? "text-brand-success" : "text-brand-danger"}`}>
                      {formatCurrency(r.beneficioAnual)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Projection detail table */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-brand-border">
          <h3 className="font-semibold text-brand-text">Detalle mes a mes — {SCENARIO_CONFIG[scenario].label}</h3>
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
                  <td className={`px-6 py-3 text-right font-semibold ${p.saldo >= 0 ? "text-brand-success" : "text-brand-danger"}`}>
                    {formatCurrency(p.saldo)}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {p.projected ? (
                      <span className="text-xs bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full font-medium">
                        Predicción IA
                      </span>
                    ) : (
                      <span className="text-xs bg-brand-gray text-brand-muted px-2 py-0.5 rounded-full">Real</span>
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
