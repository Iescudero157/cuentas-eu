"use client";

import { useState } from "react";
import {
  Landmark, Link2, RefreshCw, CheckCircle, AlertTriangle, ArrowRight,
  ShieldCheck, Info, Download, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";

// Demo connected account
const DEMO_ACCOUNT = {
  bank: "BBVA",
  iban: "ES91 2100 0418 4502 0005 1332",
  balance: 8_342.15,
  lastSync: "Hoy, 09:14",
  transactions: [
    { date: "2026-05-22", description: "Transferencia cliente XYZ", amount: 1_210.00, type: "ingreso" },
    { date: "2026-05-21", description: "Alquiler oficina", amount: -450.00, type: "gasto" },
    { date: "2026-05-20", description: "Subscripción Adobe", amount: -54.99, type: "gasto" },
    { date: "2026-05-18", description: "Cobro factura FACT-2026-012", amount: 3_025.00, type: "ingreso" },
    { date: "2026-05-15", description: "Seguridad Social autónomo", amount: -310.00, type: "gasto" },
  ],
};

const SUPPORTED_BANKS = [
  { name: "Banco Santander", logo: "🏦" },
  { name: "BBVA", logo: "🏦" },
  { name: "CaixaBank", logo: "🏦" },
  { name: "Banco Sabadell", logo: "🏦" },
  { name: "Bankinter", logo: "🏦" },
  { name: "ING", logo: "🏦" },
  { name: "N26", logo: "🏦" },
  { name: "Revolut", logo: "🏦" },
  { name: "Wise", logo: "🏦" },
  { name: "+ 200 bancos europeos", logo: "🌍" },
];

export default function BancoPage() {
  const { isDemo } = useAuth();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(isDemo); // demo always shows connected state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<number | null>(null);

  async function handleConnect() {
    setConnecting(true);
    // Simulate OAuth redirect + connection
    await new Promise((r) => setTimeout(r, 2000));
    setConnecting(false);
    setConnected(true);
    setShowConnectModal(false);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    await new Promise((r) => setTimeout(r, 1500));
    setSyncing(false);
    setSyncResult(3);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Integración bancaria</h1>
        <p className="text-brand-muted text-sm mt-1">
          Conecta tu cuenta bancaria para importar y conciliar cobros y pagos automáticamente
        </p>
      </div>

      {/* PSD2 info banner */}
      <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-brand-text">Conexión segura Open Banking (PSD2)</p>
          <p className="text-xs text-brand-muted mt-1 leading-relaxed">
            KUENTAS.EU se conecta a tu banco mediante el protocolo europeo PSD2 / Open Banking a través de
            GoCardless Bank Account Data. Tus credenciales bancarias nunca se almacenan en nuestros servidores.
            La conexión es de <strong>solo lectura</strong> — nunca se realizan pagos ni transferencias.
          </p>
        </div>
      </div>

      {connected ? (
        <>
          {/* Connected account card */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center">
                  <Landmark className="w-6 h-6 text-brand-blue" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-brand-text">{DEMO_ACCOUNT.bank}</p>
                    <CheckCircle className="w-4 h-4 text-brand-success" />
                  </div>
                  <p className="text-xs text-brand-muted font-mono">{DEMO_ACCOUNT.iban}</p>
                  <p className="text-xs text-brand-muted mt-0.5">Última sincronización: {DEMO_ACCOUNT.lastSync}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-brand-muted">Saldo actual</p>
                  <p className="text-xl font-bold text-brand-success">{formatCurrency(DEMO_ACCOUNT.balance)}</p>
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 border border-brand-border text-brand-muted px-4 py-2 rounded-lg hover:bg-brand-gray text-sm font-medium transition disabled:opacity-60"
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncing ? "Sincronizando…" : "Sincronizar"}
                </button>
              </div>
            </div>
          </div>

          {syncResult !== null && (
            <div className="bg-brand-success/10 border border-brand-success/20 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-brand-success" />
              <p className="text-sm font-medium text-brand-success">
                {syncResult} nuevas transacciones importadas y añadidas a tus ingresos/gastos
              </p>
            </div>
          )}

          {/* Recent bank transactions */}
          <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-brand-border flex items-center justify-between">
              <h3 className="font-semibold text-brand-text">Movimientos recientes</h3>
              <button className="flex items-center gap-2 text-sm text-brand-blue font-medium hover:underline">
                <Download className="w-4 h-4" /> Importar todos
              </button>
            </div>
            <div className="divide-y divide-brand-border/50">
              {DEMO_ACCOUNT.transactions.map((tx, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-brand-gray/30 transition">
                  <div className="flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      tx.type === "ingreso" ? "bg-brand-success/10" : "bg-brand-danger/10"
                    }`}>
                      {tx.type === "ingreso"
                        ? <ArrowRight className="w-4 h-4 text-brand-success rotate-[-45deg]" />
                        : <ArrowRight className="w-4 h-4 text-brand-danger rotate-[135deg]" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-text">{tx.description}</p>
                      <p className="text-xs text-brand-muted">{tx.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${tx.amount > 0 ? "text-brand-success" : "text-brand-danger"}`}>
                      {tx.amount > 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                    </span>
                    <button className="text-xs text-brand-blue hover:underline font-medium">Importar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reconciliation tip */}
          <div className="bg-brand-gray rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-brand-muted shrink-0 mt-0.5" />
            <p className="text-sm text-brand-muted">
              La <strong>conciliación automática</strong> compara los movimientos bancarios con tus facturas
              cobradas y gastos registrados, y los marca automáticamente como pagados.
              Actívala desde <strong>Ajustes → Banco</strong>.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Not connected — connect CTA */}
          <div className="bg-white rounded-xl p-10 border border-brand-border/50 shadow-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 flex items-center justify-center mx-auto mb-4">
              <Landmark className="w-8 h-8 text-brand-blue" />
            </div>
            <h2 className="text-xl font-bold text-brand-text mb-2">Conecta tu banco</h2>
            <p className="text-brand-muted text-sm max-w-sm mx-auto mb-6 leading-relaxed">
              Importa automáticamente cobros y pagos desde tu cuenta bancaria española o europea.
              Sin introducir contraseñas. Conexión de solo lectura.
            </p>
            <button
              onClick={() => setShowConnectModal(true)}
              className="bg-brand-blue text-white font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition flex items-center gap-2 mx-auto"
            >
              <Link2 className="w-5 h-5" /> Conectar mi banco
            </button>
          </div>

          {/* Supported banks */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
            <h3 className="font-semibold text-brand-text mb-4">Bancos compatibles</h3>
            <div className="flex flex-wrap gap-3">
              {SUPPORTED_BANKS.map((b) => (
                <div key={b.name} className="flex items-center gap-2 bg-brand-gray px-4 py-2 rounded-xl text-sm text-brand-muted">
                  <span>{b.logo}</span> {b.name}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Connect modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Landmark className="w-6 h-6 text-brand-blue" />
              <h3 className="font-semibold text-brand-text text-lg">Conectar banco</h3>
            </div>
            <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4 text-sm text-brand-muted space-y-2">
              <p className="font-medium text-brand-text">¿Cómo funciona?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Selecciona tu banco en la lista</li>
                <li>Serás redirigido a la web oficial de tu banco (PSD2)</li>
                <li>Autoriza el acceso de solo lectura</li>
                <li>Vuelves a KUENTAS.EU con la conexión activa</li>
              </ol>
            </div>
            <div className="flex items-center gap-2 text-xs text-brand-muted bg-brand-gray rounded-lg p-3">
              <ShieldCheck className="w-4 h-4 text-brand-success shrink-0" />
              <span>Conexión cifrada · Solo lectura · Sin almacenamiento de contraseñas · Cumple RGPD</span>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-brand-text">Selecciona tu banco:</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {SUPPORTED_BANKS.filter((b) => !b.name.startsWith("+")).map((b) => (
                  <button
                    key={b.name}
                    onClick={handleConnect}
                    disabled={connecting}
                    className="flex items-center gap-2 p-3 rounded-xl border border-brand-border hover:bg-brand-gray text-sm text-brand-text transition disabled:opacity-60"
                  >
                    <span>{b.logo}</span> {b.name}
                  </button>
                ))}
              </div>
            </div>
            {connecting && (
              <div className="flex items-center gap-3 text-sm text-brand-muted">
                <Loader2 className="w-4 h-4 animate-spin text-brand-blue" />
                Conectando con tu banco de forma segura…
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowConnectModal(false)}
                className="flex-1 border border-brand-border text-brand-muted py-2.5 rounded-xl hover:bg-brand-gray text-sm transition"
              >
                Cancelar
              </button>
            </div>
            <p className="text-xs text-center text-brand-muted">
              La integración bancaria requiere el plan <strong>Autónomo</strong> o superior.{" "}
              <a href="/precios" className="text-brand-blue hover:underline">Ver planes →</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
