"use client";

import { useMemo, useCallback } from "react";
import { Calculator, CalendarDays, AlertTriangle, Loader2, Download, FileDown, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { useAuth } from "@/lib/hooks/useAuth";
import { calculateQuarterlyTax, getCurrentQuarter, getFiscalAlerts } from "@/lib/tax-calculator";

// ─── PDF-style printable HTML for Modelo 303 ────────────────────────────────
function buildModelo303HTML(q: ReturnType<typeof calculateQuarterlyTax>, quarter: string, year: number, profile: { name?: string | null; nif?: string | null } | null): string {
  const name = profile?.name ?? "—";
  const nif = profile?.nif ?? "—";
  const today = new Date().toLocaleDateString("es-ES");
  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Modelo 303 — ${quarter} ${year}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:24px;color:#1a1a2e}
  .header{background:#2A5AAE;color:#fff;padding:24px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center}
  .header h1{margin:0;font-size:22px}
  .sub{color:rgba(255,255,255,.8);font-size:13px;margin-top:4px}
  .body{border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;padding:24px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .row:last-child{border-bottom:none}
  .label{color:#555}
  .val{font-weight:600;color:#1a1a2e}
  .total-row{background:#f0f4ff;margin-top:12px;border-radius:8px;padding:14px 16px;display:flex;justify-content:space-between;font-size:18px;font-weight:700}
  .total-row .val{color:#2A5AAE;font-size:22px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;background:#f8f9fb;border-radius:8px;padding:16px;font-size:13px}
  .meta span{color:#888}
  .meta strong{display:block;color:#1a1a2e}
  .aeat-note{margin-top:24px;padding:12px 16px;background:#fff9e6;border-left:4px solid #f59e0b;border-radius:4px;font-size:12px;color:#666}
  .footer{text-align:center;margin-top:32px;font-size:11px;color:#aaa}
  @media print{body{margin:0}}
</style>
</head><body>
<div class="header">
  <div><h1>Previsión 303 — IVA Trimestral (orientativo)</h1><div class="sub">${quarter} ${year}</div></div>
  <div style="text-align:right"><div style="font-size:20px;font-weight:900">KUENTAS.EU</div><div class="sub">Gestoría IA</div></div>
</div>
<div class="body">
  <div class="meta">
    <div><span>Contribuyente</span><strong>${name}</strong></div>
    <div><span>NIF</span><strong>${nif}</strong></div>
    <div><span>Período</span><strong>${quarter} ${year}</strong></div>
    <div><span>Fecha impresión</span><strong>${today}</strong></div>
  </div>
  <div class="row"><span class="label">[01] Base imponible IVA repercutido (21%)</span><span class="val">${q.ingresosBrutos.toFixed(2)} €</span></div>
  <div class="row"><span class="label">[03] Cuota IVA repercutido</span><span class="val">+${q.ivaRepercutido.toFixed(2)} €</span></div>
  <div class="row"><span class="label">[28] Base imponible IVA soportado deducible</span><span class="val">${q.gastosDeducibles.toFixed(2)} €</span></div>
  <div class="row"><span class="label">[29] Cuota IVA soportado deducible</span><span class="val">-${q.ivaSoportado.toFixed(2)} €</span></div>
  <div class="total-row"><span>RESULTADO A INGRESAR / DEVOLVER [46]</span><span class="val">${q.ivaAPagar.toFixed(2)} €</span></div>
  <div class="aeat-note">
    ⚠️ <strong>Importante:</strong> Este documento es orientativo y ha sido generado por KUENTAS.EU con los datos introducidos.
    Para presentar el Modelo 303 oficial debes acceder a la <strong>Sede Electrónica de la AEAT</strong> en
    <a href="https://sede.agenciatributaria.gob.es" target="_blank">sede.agenciatributaria.gob.es</a>
    e iniciar sesión con Cl@ve o certificado digital.
  </div>
</div>
<div class="footer">Generado por KUENTAS.EU — Gestoría con IA para autónomos</div>
</body></html>`;
}

function buildModelo130HTML(q: ReturnType<typeof calculateQuarterlyTax>, quarter: string, year: number, profile: { name?: string | null; nif?: string | null } | null): string {
  const name = profile?.name ?? "—";
  const nif = profile?.nif ?? "—";
  const today = new Date().toLocaleDateString("es-ES");
  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Modelo 130 — ${quarter} ${year}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:24px;color:#1a1a2e}
  .header{background:#16a34a;color:#fff;padding:24px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center}
  .header h1{margin:0;font-size:22px}
  .sub{color:rgba(255,255,255,.8);font-size:13px;margin-top:4px}
  .body{border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;padding:24px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .row:last-child{border-bottom:none}
  .label{color:#555}
  .val{font-weight:600}
  .total-row{background:#f0fdf4;margin-top:12px;border-radius:8px;padding:14px 16px;display:flex;justify-content:space-between;font-size:18px;font-weight:700}
  .total-row .val{color:#16a34a;font-size:22px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;background:#f8f9fb;border-radius:8px;padding:16px;font-size:13px}
  .meta span{color:#888}
  .meta strong{display:block;color:#1a1a2e}
  .aeat-note{margin-top:24px;padding:12px 16px;background:#fff9e6;border-left:4px solid #f59e0b;border-radius:4px;font-size:12px;color:#666}
  .footer{text-align:center;margin-top:32px;font-size:11px;color:#aaa}
  @media print{body{margin:0}}
</style>
</head><body>
<div class="header">
  <div><h1>Previsión 130 — IRPF Trimestral (orientativo)</h1><div class="sub">${quarter} ${year}</div></div>
  <div style="text-align:right"><div style="font-size:20px;font-weight:900">KUENTAS.EU</div><div class="sub">Gestoría IA</div></div>
</div>
<div class="body">
  <div class="meta">
    <div><span>Contribuyente</span><strong>${name}</strong></div>
    <div><span>NIF</span><strong>${nif}</strong></div>
    <div><span>Período</span><strong>${quarter} ${year}</strong></div>
    <div><span>Fecha impresión</span><strong>${today}</strong></div>
  </div>
  <div class="row"><span class="label">[01] Ingresos computables del trimestre</span><span class="val">${q.ingresosBrutos.toFixed(2)} €</span></div>
  <div class="row"><span class="label">[02] Gastos fiscalmente deducibles</span><span class="val">-${q.gastosDeducibles.toFixed(2)} €</span></div>
  <div class="row"><span class="label">[03] Rendimiento neto (01 - 02)</span><span class="val">${q.beneficioNeto.toFixed(2)} €</span></div>
  <div class="row"><span class="label">[05] Rendimiento neto acumulado ejercicio</span><span class="val">${q.beneficioNeto.toFixed(2)} €</span></div>
  <div class="row"><span class="label">[07] Cuota a ingresar (20% × rendimiento)</span><span class="val">${q.irpfAPagar.toFixed(2)} €</span></div>
  <div class="total-row"><span>RESULTADO A INGRESAR [20]</span><span class="val">${q.irpfAPagar.toFixed(2)} €</span></div>
  <div class="aeat-note">
    ⚠️ <strong>Importante:</strong> Este documento es orientativo. Para presentar el Modelo 130 oficial accede a
    <a href="https://sede.agenciatributaria.gob.es" target="_blank">sede.agenciatributaria.gob.es</a>
    con Cl@ve PIN o certificado digital.
  </div>
</div>
<div class="footer">Generado por KUENTAS.EU — Gestoría con IA para autónomos</div>
</body></html>`;
}

function buildModelo100HTML(annualData: { ingresos: number; gastos: number; beneficio: number; irpf: number }, year: number, profile: { name?: string | null; nif?: string | null } | null): string {
  const name = profile?.name ?? "—";
  const nif = profile?.nif ?? "—";
  const today = new Date().toLocaleDateString("es-ES");
  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Modelo 100 — Renta ${year}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:24px;color:#1a1a2e}
  .header{background:#7c3aed;color:#fff;padding:24px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center}
  .header h1{margin:0;font-size:22px}
  .sub{color:rgba(255,255,255,.8);font-size:13px;margin-top:4px}
  .body{border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;padding:24px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .row:last-child{border-bottom:none}
  .label{color:#555}
  .val{font-weight:600}
  .total-row{background:#f5f3ff;margin-top:12px;border-radius:8px;padding:14px 16px;display:flex;justify-content:space-between;font-size:18px;font-weight:700}
  .total-row .val{color:#7c3aed;font-size:22px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;background:#f8f9fb;border-radius:8px;padding:16px;font-size:13px}
  .meta span{color:#888}
  .meta strong{display:block;color:#1a1a2e}
  .aeat-note{margin-top:24px;padding:12px 16px;background:#fff9e6;border-left:4px solid #f59e0b;border-radius:4px;font-size:12px;color:#666}
  .footer{text-align:center;margin-top:32px;font-size:11px;color:#aaa}
  @media print{body{margin:0}}
</style>
</head><body>
<div class="header">
  <div><h1>Previsión 100 — Declaración de Renta</h1><div class="sub">Ejercicio ${year} · datos orientativos, no oficial</div></div>
  <div style="text-align:right"><div style="font-size:20px;font-weight:900">KUENTAS.EU</div><div class="sub">Gestoría IA</div></div>
</div>
<div class="body">
  <div class="meta">
    <div><span>Contribuyente</span><strong>${name}</strong></div>
    <div><span>NIF</span><strong>${nif}</strong></div>
    <div><span>Ejercicio</span><strong>${year}</strong></div>
    <div><span>Fecha impresión</span><strong>${today}</strong></div>
  </div>
  <div class="row"><span class="label">Rendimiento neto actividad económica</span><span class="val">${annualData.beneficio.toFixed(2)} €</span></div>
  <div class="row"><span class="label">Ingresos brutos (facturas emitidas)</span><span class="val">${annualData.ingresos.toFixed(2)} €</span></div>
  <div class="row"><span class="label">Gastos deducibles</span><span class="val">-${annualData.gastos.toFixed(2)} €</span></div>
  <div class="row"><span class="label">Retenciones IRPF practicadas (estimado)</span><span class="val">${(annualData.ingresos * 0.15).toFixed(2)} €</span></div>
  <div class="total-row"><span>ESTIMACIÓN IRPF ANUAL (tipo medio 20%)</span><span class="val">${annualData.irpf.toFixed(2)} €</span></div>
  <div class="aeat-note">
    ⚠️ <strong>Datos orientativos.</strong> La declaración de Renta (Modelo 100) se presenta en abril–junio del año siguiente.
    Accede al borrador oficial en <a href="https://sede.agenciatributaria.gob.es" target="_blank">sede.agenciatributaria.gob.es</a>
    con Cl@ve, certificado digital o número de referencia.
  </div>
</div>
<div class="footer">Generado por KUENTAS.EU — Gestoría con IA para autónomos</div>
</body></html>`;
}

function openPrintWindow(html: string) {
  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  // Give the window time to render then trigger print
  setTimeout(() => w.print(), 600);
}

export default function ImpuestosPage() {
  const { transactions, loading } = useTransactions();
  const { profile } = useAuth();
  const year = new Date().getFullYear();
  const currentQ = getCurrentQuarter();
  const alerts = getFiscalAlerts();

  const quarters = useMemo(
    () => [1, 2, 3, 4].map((q) => calculateQuarterlyTax(transactions, q, year)),
    [transactions, year]
  );

  const currentQuarterData = quarters[currentQ - 1];
  const annualTax = quarters.reduce((s, q) => s + q.totalImpuestos, 0);

  const annualData = useMemo(() => ({
    ingresos: quarters.reduce((s, q) => s + q.ingresosBrutos, 0),
    gastos: quarters.reduce((s, q) => s + q.gastosDeducibles, 0),
    beneficio: quarters.reduce((s, q) => s + q.beneficioNeto, 0),
    irpf: quarters.reduce((s, q) => s + q.irpfAPagar, 0),
  }), [quarters]);

  const handleDownload303 = useCallback(() => {
    const html = buildModelo303HTML(currentQuarterData, currentQuarterData.quarter, year, profile);
    openPrintWindow(html);
  }, [currentQuarterData, year, profile]);

  const handleDownload130 = useCallback(() => {
    const html = buildModelo130HTML(currentQuarterData, currentQuarterData.quarter, year, profile);
    openPrintWindow(html);
  }, [currentQuarterData, year, profile]);

  const handleDownload100 = useCallback(() => {
    const html = buildModelo100HTML(annualData, year, profile);
    openPrintWindow(html);
  }, [annualData, year, profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Impuestos</h1>
          <p className="text-brand-muted text-sm mt-1">Estimación de IVA e IRPF para autónomos en España</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleDownload303}
            className="flex flex-col items-start gap-0.5 border border-brand-border text-brand-text px-4 py-2 rounded-lg hover:bg-brand-gray text-sm font-medium transition"
          >
            <span className="flex items-center gap-2"><FileDown className="w-4 h-4" /> Previsión 303</span>
            <span className="text-[10px] text-brand-muted font-normal pl-6">Datos orientativos · IVA trimestral</span>
          </button>
          <button
            onClick={handleDownload130}
            className="flex flex-col items-start gap-0.5 border border-brand-border text-brand-text px-4 py-2 rounded-lg hover:bg-brand-gray text-sm font-medium transition"
          >
            <span className="flex items-center gap-2"><FileDown className="w-4 h-4" /> Previsión 130</span>
            <span className="text-[10px] text-brand-muted font-normal pl-6">Datos orientativos · IRPF trimestral</span>
          </button>
          <button
            onClick={handleDownload100}
            className="flex flex-col items-start gap-0.5 border border-brand-border text-brand-text px-4 py-2 rounded-lg hover:bg-brand-gray text-sm font-medium transition"
          >
            <span className="flex items-center gap-2"><FileDown className="w-4 h-4" /> Previsión 100</span>
            <span className="text-[10px] text-brand-muted font-normal pl-6">Datos orientativos · Renta anual</span>
          </button>
        </div>
      </div>

      {/* AEAT link */}
      <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4 flex items-center gap-3">
        <ExternalLink className="w-5 h-5 text-brand-blue shrink-0" />
        <p className="text-sm text-brand-text">
          Para presentar los modelos oficialmente, accede a la{" "}
          <a
            href="https://sede.agenciatributaria.gob.es"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-blue hover:underline"
          >
            Sede Electrónica de la AEAT
          </a>{" "}
          con Cl@ve PIN o certificado digital. Los botones de arriba generan un resumen imprimible con tus datos.
        </p>
      </div>

      {/* Current quarter highlight */}
      <div className="bg-brand-blue rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5" />
          <h3 className="font-semibold">Trimestre actual — {currentQuarterData.quarter}</h3>
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
        {/* Modelo 303 */}
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center">
                <span className="text-brand-blue font-bold text-sm">303</span>
              </div>
              <div>
                <h3 className="font-semibold text-brand-text">Previsión 303 — IVA Trimestral</h3>
                <p className="text-xs text-brand-muted">Datos orientativos · IVA repercutido − IVA soportado</p>
              </div>
            </div>
            <button
              onClick={handleDownload303}
              title="Descargar / imprimir Modelo 303"
              className="p-2 rounded-lg text-brand-muted hover:bg-brand-gray hover:text-brand-blue transition"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">IVA repercutido (cobrado)</span>
              <span className="font-medium text-brand-success">+{formatCurrency(currentQuarterData.ivaRepercutido)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">IVA soportado (pagado)</span>
              <span className="font-medium text-brand-danger">−{formatCurrency(currentQuarterData.ivaSoportado)}</span>
            </div>
            <div className="border-t border-brand-border pt-3 flex justify-between">
              <span className="font-semibold">A pagar a Hacienda</span>
              <span className="text-xl font-bold text-brand-blue">{formatCurrency(currentQuarterData.ivaAPagar)}</span>
            </div>
          </div>
        </div>

        {/* Modelo 130 */}
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-success/10 flex items-center justify-center">
                <span className="text-brand-success font-bold text-sm">130</span>
              </div>
              <div>
                <h3 className="font-semibold text-brand-text">Previsión 130 — IRPF Trimestral</h3>
                <p className="text-xs text-brand-muted">Datos orientativos · 20% del beneficio neto</p>
              </div>
            </div>
            <button
              onClick={handleDownload130}
              title="Descargar / imprimir Modelo 130"
              className="p-2 rounded-lg text-brand-muted hover:bg-brand-gray hover:text-brand-success transition"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Ingresos netos</span>
              <span className="font-medium">{formatCurrency(currentQuarterData.ingresosBrutos)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Gastos deducibles</span>
              <span className="font-medium text-brand-danger">−{formatCurrency(currentQuarterData.gastosDeducibles)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Beneficio neto</span>
              <span className="font-medium">{formatCurrency(currentQuarterData.beneficioNeto)}</span>
            </div>
            <div className="border-t border-brand-border pt-3 flex justify-between">
              <span className="font-semibold">IRPF a pagar (20%)</span>
              <span className="text-xl font-bold text-brand-success">{formatCurrency(currentQuarterData.irpfAPagar)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quarterly overview */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-brand-border flex items-center justify-between">
          <h3 className="font-semibold text-brand-text">Resumen anual {year}</h3>
          <button
            onClick={handleDownload100}
            className="flex items-center gap-2 text-sm text-brand-muted hover:text-brand-text transition"
          >
            <FileDown className="w-4 h-4" /> Previsión 100 (datos orientativos)
          </button>
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
                <th className="text-right px-6 py-3 text-brand-muted font-medium">Total</th>
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
                  <td className="px-6 py-3 text-right text-brand-success">{formatCurrency(q.irpfAPagar)}</td>
                  <td className="px-6 py-3 text-right font-semibold">{formatCurrency(q.totalImpuestos)}</td>
                </tr>
              ))}
              <tr className="bg-brand-gray font-bold">
                <td className="px-6 py-3">TOTAL ANUAL</td>
                <td className="px-6 py-3 text-right">{formatCurrency(annualData.ingresos)}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(annualData.gastos)}</td>
                <td className="px-6 py-3 text-right text-brand-blue">{formatCurrency(quarters.reduce((s, q) => s + q.ivaAPagar, 0))}</td>
                <td className="px-6 py-3 text-right text-brand-success">{formatCurrency(annualData.irpf)}</td>
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
                    {alert.daysLeft === 0 ? "HOY" : `${alert.daysLeft} días`}
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
