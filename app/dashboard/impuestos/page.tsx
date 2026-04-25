"use client";

import { Calculator, CalendarDays, Wallet, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { demoTransactions } from "@/lib/demo-data";
import { calculateQuarterlyTax, getCurrentQuarter, getFiscalAlerts } from "@/lib/tax-calculator";

export default function ImpuestosPage() {
  const year = new Date().getFullYear();
  const currentQ = getCurrentQuarter();
  const alerts = getFiscalAlerts();

  const quarters = [1, 2, 3, 4].map((q) => calculateQuarterlyTax(demoTransactions, q, year));
  const currentQuarterData = quarters[currentQ - 1];

  const annualTax = quarters.reduce((s, q) => s + q.totalImpuestos, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Impuestos</h1>
        <p className="text-brand-muted text-sm mt-1">Estimación de IVA e IRPF para autónomos en España</p>
      </div>

      {/* Current quarter highlight */}
      <div className="bg-brand-blue rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5" />
          <h3 className="font-semibold">Trimestre actual - {currentQuarterData.quarter}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-white/70 text-sm">Ingresos brutos</p>
            <p className="text-2xl font-bold">{formatCurrency(currentQuarterData.ingresosBrutos)}</p>
          </div>
          <div>
            <p className="text-white/70 text-sm">Gastos deducibles</p>
            <p className="text-2xl font-bold">{formatCurrency(currentQuarterData.gastosDeducibles)}</p>
          </div>
          <div>
            <p className="text-white/70 text-sm">Beneficio neto</p>
            <p className="text-2xl font-bold">{formatCurrency(currentQuarterData.beneficioNeto)}</p>
          </div>
          <div>
            <p className="text-white/70 text-sm">Total impuestos</p>
            <p className="text-2xl font-bold">{formatCurrency(currentQuarterData.totalImpuestos)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Modelo 303 - IVA */}
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center">
              <span className="text-brand-blue font-bold text-sm">303</span>
            </div>
            <div>
              <h3 className="font-semibold text-brand-text">Modelo 303 - IVA Trimestral</h3>
              <p className="text-xs text-brand-muted">IVA repercutido - IVA soportado</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">IVA repercutido (cobrado)</span>
              <span className="font-medium text-brand-success">+{formatCurrency(currentQuarterData.ivaRepercutido)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">IVA soportado (pagado)</span>
              <span className="font-medium text-brand-danger">-{formatCurrency(currentQuarterData.ivaSoportado)}</span>
            </div>
            <div className="border-t border-brand-border pt-3 flex justify-between">
              <span className="font-semibold">A pagar a Hacienda</span>
              <span className="text-xl font-bold text-brand-blue">{formatCurrency(currentQuarterData.ivaAPagar)}</span>
            </div>
          </div>
        </div>

        {/* Modelo 130 - IRPF */}
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-brand-green/10 flex items-center justify-center">
              <span className="text-brand-green font-bold text-sm">130</span>
            </div>
            <div>
              <h3 className="font-semibold text-brand-text">Modelo 130 - IRPF Trimestral</h3>
              <p className="text-xs text-brand-muted">20% del beneficio neto</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Ingresos netos</span>
              <span className="font-medium">{formatCurrency(currentQuarterData.ingresosBrutos)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Gastos deducibles</span>
              <span className="font-medium text-brand-danger">-{formatCurrency(currentQuarterData.gastosDeducibles)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Beneficio neto</span>
              <span className="font-medium">{formatCurrency(currentQuarterData.beneficioNeto)}</span>
            </div>
            <div className="border-t border-brand-border pt-3 flex justify-between">
              <span className="font-semibold">IRPF a pagar (20%)</span>
              <span className="text-xl font-bold text-brand-green">{formatCurrency(currentQuarterData.irpfAPagar)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quarterly overview */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-brand-border">
          <h3 className="font-semibold text-brand-text">Resumen anual {year}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-gray">
              <tr>
                <th className="text-left px-6 py-3 text-brand-muted font-medium">Trimestre</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Ingresos</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Gastos</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">IVA (303)</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">IRPF (130)</th>
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Total impuestos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50">
              {quarters.map((q, i) => (
                <tr key={i} className={i === currentQ - 1 ? "bg-brand-blue/5" : "hover:bg-brand-gray/50"}>
                  <td className="px-6 py-3 font-medium">
                    {q.quarter}
                    {i === currentQ - 1 && (
                      <span className="ml-2 text-xs bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full">Actual</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">{formatCurrency(q.ingresosBrutos)}</td>
                  <td className="px-6 py-3 text-right">{formatCurrency(q.gastosDeducibles)}</td>
                  <td className="px-6 py-3 text-right text-brand-blue">{formatCurrency(q.ivaAPagar)}</td>
                  <td className="px-6 py-3 text-right text-brand-green">{formatCurrency(q.irpfAPagar)}</td>
                  <td className="px-6 py-3 text-right font-semibold">{formatCurrency(q.totalImpuestos)}</td>
                </tr>
              ))}
              <tr className="bg-brand-gray font-bold">
                <td className="px-6 py-3">TOTAL ANUAL</td>
                <td className="px-6 py-3 text-right">{formatCurrency(quarters.reduce((s, q) => s + q.ingresosBrutos, 0))}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(quarters.reduce((s, q) => s + q.gastosDeducibles, 0))}</td>
                <td className="px-6 py-3 text-right text-brand-blue">{formatCurrency(quarters.reduce((s, q) => s + q.ivaAPagar, 0))}</td>
                <td className="px-6 py-3 text-right text-brand-green">{formatCurrency(quarters.reduce((s, q) => s + q.irpfAPagar, 0))}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(annualTax)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Fiscal calendar */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-brand-blue" />
            <h3 className="font-semibold text-brand-text">Calendario fiscal</h3>
          </div>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  alert.urgent ? "border-brand-danger/30 bg-brand-danger/5" : "border-brand-border/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {alert.urgent && <AlertTriangle className="w-4 h-4 text-brand-danger" />}
                  <div>
                    <p className="text-sm font-medium text-brand-text">{alert.modelo}</p>
                    <p className="text-xs text-brand-muted">{alert.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${alert.urgent ? "text-brand-danger" : "text-brand-text"}`}>
                    {alert.daysLeft === 0 ? "HOY" : `${alert.daysLeft} dias`}
                  </p>
                  <p className="text-xs text-brand-muted">{alert.dueDate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
