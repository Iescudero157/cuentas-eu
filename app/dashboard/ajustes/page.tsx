"use client";

import { User, Building2, CreditCard, Bell, Shield, Loader2, ExternalLink, Star } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";

const PLAN_LABELS: Record<string, { label: string; price: string; color: string }> = {
  gratis: { label: "Plan Gratis", price: "0 EUR/mes", color: "text-brand-muted" },
  autonomo: { label: "Plan Autónomo", price: "9,99 EUR/mes", color: "text-brand-blue" },
  creator: { label: "Plan Creator", price: "19,99 EUR/mes", color: "text-brand-green" },
  business: { label: "Plan Business", price: "29,99 EUR/mes", color: "text-brand-blue" },
};

function PlanCard() {
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const currentPlan = profile?.plan || "gratis";
  const planInfo = PLAN_LABELS[currentPlan] ?? PLAN_LABELS.gratis;

  async function handleManageBilling() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Error accediendo al portal de facturación");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-brand-blue" />
        <h3 className="font-semibold text-brand-text">Tu plan</h3>
      </div>
      <div className="bg-brand-blue/5 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className={`font-semibold ${planInfo.color}`}>{planInfo.label}</p>
          <p className="text-sm text-brand-muted">{planInfo.price}</p>
        </div>
        <span className="text-xs bg-brand-success/10 text-brand-success px-3 py-1 rounded-full font-medium">
          {currentPlan === "gratis" ? "Gratuito" : "Activo"}
        </span>
      </div>
      <div className="mt-4 flex gap-3">
        {currentPlan === "gratis" ? (
          <Link
            href="/precios"
            className="flex-1 flex items-center justify-center gap-2 bg-brand-blue text-white text-sm font-semibold py-2 rounded-lg hover:opacity-90 transition"
          >
            <Star className="w-4 h-4" /> Mejorar plan
          </Link>
        ) : (
          <button
            onClick={handleManageBilling}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 border border-brand-blue text-brand-blue text-sm font-semibold py-2 rounded-lg hover:bg-brand-blue/5 transition disabled:opacity-60"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</>
            ) : (
              <><ExternalLink className="w-4 h-4" /> Gestionar suscripción</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

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
  name: "",
  nif: "",
  email: "",
  address: "",
  activity: "",
  epigrafe: "831 - Servicios técnicos",
  tipoIva: 21,
  retencionIrpf: 15,
  notifFiscales: true,
  notifFacturas: true,
  notifResumen: false,
  notifTips: true,
};

export default function AjustesPage() {
  const { user, profile, isDemo, refreshProfile } = useAuth();
  const [data, setData] = useState<AjustesData>(defaultData);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load data from profile (real user) or localStorage (demo)
  useEffect(() => {
    if (profile) {
      setData((prev) => ({
        ...prev,
        name: profile.name || "",
        nif: profile.nif || "",
        email: profile.email || user?.email || "",
        address: profile.address || "",
        activity: profile.activity || "",
        epigrafe: profile.epigrafe || prev.epigrafe,
        tipoIva: profile.tipo_iva ?? prev.tipoIva,
        retencionIrpf: profile.retencion_irpf ?? prev.retencionIrpf,
      }));
    } else {
      // Demo or no profile: try localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setData((prev) => ({ ...prev, ...JSON.parse(stored) }));
        }
      } catch {
        // ignore
      }
    }
  }, [profile, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (!isDemo && user) {
        // Real user: save to Supabase via API
        const res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            nif: data.nif,
            email: data.email,
            address: data.address,
            activity: data.activity,
            epigrafe: data.epigrafe,
            tipo_iva: data.tipoIva,
            retencion_irpf: data.retencionIrpf,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error guardando perfil");
        }

        // Refresh cached profile in context
        await refreshProfile();
      }

      // Always save to localStorage too (notifications + demo fallback)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error guardando cambios");
    } finally {
      setSaving(false);
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
              <label className="block text-sm font-medium text-brand-text mb-1">Dirección fiscal</label>
              <input
                type="text"
                value={data.address}
                onChange={(e) => setData({ ...data, address: e.target.value })}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-60 flex items-center gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : "Guardar cambios"}
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
              <label className="block text-sm font-medium text-brand-text mb-1">Epígrafe IAE</label>
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
                <option value={4}>4% (Superreducido)</option>
                <option value={0}>0% (Exento)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Retención IRPF facturas</label>
              <select
                value={data.retencionIrpf}
                onChange={(e) => setData({ ...data, retencionIrpf: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                <option value={15}>15% (General)</option>
                <option value={7}>7% (Primeros 3 años)</option>
              </select>
            </div>
          </div>

          {/* Plan */}
          <PlanCard />

          {/* Notifications */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-brand-blue" />
              <h3 className="font-semibold text-brand-text">Notificaciones</h3>
            </div>
            <div className="space-y-4">
              {[
                { key: "notifFiscales" as const, label: "Alertas fiscales", desc: "Fechas de presentación de modelos" },
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
