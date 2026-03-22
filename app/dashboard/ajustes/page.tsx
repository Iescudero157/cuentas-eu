"use client";

import { User, Building2, CreditCard, Bell, Shield } from "lucide-react";
import { demoUser } from "@/lib/demo-data";

export default function AjustesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Ajustes</h1>
        <p className="text-brand-muted text-sm mt-1">Configura tu cuenta y preferencias</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal info */}
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-5 h-5 text-brand-blue" />
            <h3 className="font-semibold text-brand-text">Datos personales</h3>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text mb-1">Nombre completo</label>
            <input type="text" defaultValue={demoUser.name} className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text mb-1">NIF</label>
            <input type="text" defaultValue={demoUser.nif} className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text mb-1">Email</label>
            <input type="email" defaultValue={demoUser.email} className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text mb-1">Direccion fiscal</label>
            <input type="text" defaultValue={demoUser.address} className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm" />
          </div>
          <button className="gradient-brand text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition">
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
            <input type="text" defaultValue={demoUser.activity} className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text mb-1">Epigrafe IAE</label>
            <input type="text" defaultValue="831 - Servicios tecnicos" className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text mb-1">Tipo IVA por defecto</label>
            <select className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm">
              <option value={21}>21% (General)</option>
              <option value={10}>10% (Reducido)</option>
              <option value={4}>4% (Super reducido)</option>
              <option value={0}>0% (Exento)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text mb-1">Retencion IRPF facturas</label>
            <select className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm">
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
              { label: "Alertas fiscales", desc: "Fechas de presentacion de modelos", defaultChecked: true },
              { label: "Facturas pendientes", desc: "Recordatorios de cobro", defaultChecked: true },
              { label: "Resumen semanal", desc: "Informe de ingresos y gastos", defaultChecked: false },
              { label: "Tips de ahorro fiscal", desc: "La IA encuentra deducciones", defaultChecked: true },
            ].map((n) => (
              <label key={n.label} className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-brand-text">{n.label}</p>
                  <p className="text-xs text-brand-muted">{n.desc}</p>
                </div>
                <input type="checkbox" defaultChecked={n.defaultChecked} className="w-5 h-5 rounded accent-brand-blue" />
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
