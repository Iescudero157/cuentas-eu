"use client";

import { User, Building2, CreditCard, Bell, Shield } from "lucide-react";
import { demoUser } from "@/lib/demo-data";
import { useState, useEffect } from "react";

const STORAGE_KEY = "kuentas_ajustes";

interface AjustesData {
  name: string;
  nif: string;
  email: string;
  address: string;
  activity: string;
  epigrafe: string;
  tipoIva: number;
  retencionIrpf: number;
  notifFiscales: boolean;
  notifFacturas: boolean;
  notifResumen: boolean;
  notifTips: boolean;
}

const defaultData: AjustesData = {
  name: demoUser.name,
  nif: demoUser.nif,
  email: demoUser.email,
  address: demoUser.address,
  activity: demoUser.activity,
  epigrafe: "831 - Servicios tecnicos",
  tipoIva: 21,
  retencionIrpf: 15,
  notifFiscales: true,
  notifFacturas: true,
  notifResumen: false,
  notifTips: true,
};

export default function AjustesPage() {
  const [data, setData] = useState<AjustesData>(defaultData);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setData(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Ajustes</h1>
        <p className="text-brand-muted text-sm mt-1">Configura tu cuenta y preferencias</p>
      </div>

      {saved && (
        <div className="bg-brand-success/10 border border-brand-success/20 rounded-xl p-4 text-brand-success text-sm font-medium flex items-center gap-2">
          <Shield className="w-4 h-4" /> Cambios guardados correctamente
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal info */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5 text-brand-blue" />
              <h3 className="font-semibold text-brand-text">Datos personales</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Nombre completo</label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">NIF</label>
              <input
                type="text"
                value={data.nif}
                onChange={(e) => setData({ ...data, nif: e.target.value })}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Email</label>
              <input
                type="email"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Direccion fiscal</label>
              <input
                type="text"
                value={data.address}
                onChange={(e) => setData({ ...data, address: e.target.value })}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <button
              type="submit"
              className="gradient-brand text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
            >
              Guardar cambios
            </button>
          </div>

          {/* Business info */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-brand-blue" />
              <h3 className="font-semibold text-brand-text">Datos de actividad</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Actividad profesional</label>
              <input
                type="text"
                value={data.activity}
                onChange={(e) => setData({ ...data, activity: e.target.value })}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Epigrafe IAE</label>
              <input
                type="text"
                value={data.epigrafe}
                onChange={(e) => setData({ ...data, epigrafe: e.target.value })}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Tipo IVA por defecto</label>
              <select
                value={data.tipoIva}
                onChange={(e) => setData({ ...data, tipoIva: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                <option value={21}>21% (General)</option>
                <option value={10}>10% (Reducido)</option>
                <option value={4}>4% (Super reducido)</option>
                <option value={0}>0% (Exento)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Retencion IRPF facturas</label>
              <select
                value={data.retencionIrpf}
                onChange={(e) => setData({ ...data, retencionIrpf: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                <option value={15}>15% (General)</option>
                <option value={7}>7% (Primeros 3 anos)</option>
              </select>
            </div>
          </div>

          {/* Plan */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-brand-blue" />
              <h3 className="font-semibold text-brand-text">Tu plan</h3>
            </div>
            <div className="bg-brand-blue/5 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-brand-text">Plan Autonomo</p>
                <p className="text-sm text-brand-muted">9,99 EUR/mes</p>
              </div>
              <span className="text-xs bg-brand-success/10 text-brand-success px-3 py-1 rounded-full font-medium">
                Activo
              </span>
            </div>
            <button className="mt-4 w-full border border-brand-blue text-brand-blue text-sm font-semibold py-2 rounded-lg hover:bg-brand-blue/5 transition">
              Cambiar plan
            </button>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-brand-blue" />
              <h3 className="font-semibold text-brand-text">Notificaciones</h3>
            </div>
            <div className="space-y-4">
              {[
                { key: "notifFiscales" as const, label: "Alertas fiscales", desc: "Fechas de presentacion de modelos" },
                { key: "notifFacturas" as const, label: "Facturas pendientes", desc: "Recordatorios de cobro" },
                { key: "notifResumen" as const, label: "Resumen semanal", desc: "Informe de ingresos y gastos" },
                { key: "notifTips" as const, label: "Tips de ahorro fiscal", desc: "La IA encuentra deducciones" },
              ].map((n) => (
                <label key={n.key} className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-brand-text">{n.label}</p>
                    <p className="text-xs text-brand-muted">{n.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={data[n.key]}
                    onChange={(e) => setData({ ...data, [n.key]: e.target.checked })}
                    className="w-5 h-5 rounded accent-brand-blue"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
