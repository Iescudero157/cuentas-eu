"use client";

import { User, Building2, CreditCard, Bell, Shield, Loader2, ExternalLink, Star } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { estadoPlan, NOMBRE_PLAN } from "@/lib/plan";
import CertificadoCard from "./certificado-card";
import RenovarPlan from "./renovar-plan";

const PLAN_LABELS: Record<string, { label: string; price: string; color: string }> = {
  gratis: { label: "Plan Gratis", price: "0 EUR/mes", color: "text-brand-muted" },
  autonomo: { label: "Plan Autónomo", price: "9,99 EUR/mes", color: "text-brand-blue" },
  creator: { label: "Plan Creator", price: "19,99 EUR/mes", color: "text-brand-green" },
  business: { label: "Plan Business", price: "29,99 EUR/mes", color: "text-brand-blue" },
};

// Portal de Stripe DESACTIVADO (8-nov-2026): hoy se cobra con el TPV de BBVA (Redsys), que no crea cliente en
// Stripe, así que «Gestionar suscripción» siempre acababa en error. Se conserva para la fase 2 (Stripe de
// MILBROTES): para volver a mostrar el botón, poner esta constante a true (ruta /api/stripe/portal intacta).
const PORTAL_STRIPE_ACTIVO: boolean = false;

const MAILTO_PLAN = `mailto:kuentas@mercadonet.es?subject=${encodeURIComponent("Cambio de plan o baja en KUENTAS.EU")}`;

function fechaLarga(fecha: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

function PlanCard() {
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const currentPlan = profile?.plan || "gratis";
  const planInfo = PLAN_LABELS[currentPlan] ?? PLAN_LABELS.gratis;
  // Caducidad mensual (8-nov-2026): estado del plan pagado, que puede haber caducado aunque la app ya trate la
  // cuenta como Gratis (profile.plan es el plan efectivo; profile.plan_contratado, el pagado).
  const estado = estadoPlan({
    plan: profile?.plan_contratado ?? profile?.plan,
    plan_expires_at: profile?.plan_expires_at ?? null,
  });
  const nombrePagado = NOMBRE_PLAN[estado.contratado];
  const conCaducidad =
    estado.situacion === "vigente" || estado.situacion === "gracia" || estado.situacion === "caducado";

  // El enlace de los avisos por email lleva ?renovar=1: se baja hasta esta tarjeta.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("renovar")) {
      document.getElementById("tu-plan")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

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
    <div id="tu-plan" className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-brand-blue" />
        <h3 className="font-semibold text-brand-text">Tu plan</h3>
      </div>
      <div className="bg-brand-blue/5 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className={`font-semibold ${planInfo.color}`}>{planInfo.label}</p>
          <p className="text-sm text-brand-muted">{planInfo.price}</p>
        </div>
        {estado.situacion === "gracia" ? (
          <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-medium">Por renovar</span>
        ) : (
          <span className="text-xs bg-brand-success/10 text-brand-success px-3 py-1 rounded-full font-medium">
            {currentPlan === "gratis" ? "Gratuito" : "Activo"}
          </span>
        )}
      </div>
      {estado.situacion === "vigente" && estado.caducaEl && (
        <p className="mt-3 text-sm text-brand-muted">
          Pagado hasta el {fechaLarga(estado.caducaEl)}. Cada pago cubre un mes y no hay cargos automáticos: antes de
          que caduque te avisamos por email con el enlace para renovar.
        </p>
      )}
      {estado.situacion === "gracia" && estado.caducaEl && estado.finGracia && (
        <p className="mt-3 text-sm text-amber-800">
          Tu plan {nombrePagado} caducó el {fechaLarga(estado.caducaEl)}. Lo mantienes hasta el{" "}
          {fechaLarga(estado.finGracia)}; si no lo renuevas, después tu cuenta pasará al plan Gratis. Tus datos no se
          borran.
        </p>
      )}
      {estado.situacion === "caducado" && estado.caducaEl && (
        <p className="mt-3 text-sm text-amber-800">
          Tu plan {nombrePagado} caducó el {fechaLarga(estado.caducaEl)} y ahora tienes las funciones del plan Gratis.
          Tus datos siguen ahí: renuévalo para recuperar las funciones de pago.
        </p>
      )}
      {conCaducidad ? (
        <div className="mt-4 flex gap-3">
          <RenovarPlan
            plan={estado.contratado}
            texto={estado.situacion === "vigente" ? "Renovar un mes más" : `Renovar plan ${nombrePagado}`}
          />
        </div>
      ) : currentPlan === "gratis" ? (
        <div className="mt-4 flex gap-3">
          <Link
            href="/precios"
            className="flex-1 flex items-center justify-center gap-2 bg-brand-blue text-white text-sm font-semibold py-2 rounded-lg hover:opacity-90 transition"
          >
            <Star className="w-4 h-4" /> Mejorar plan
          </Link>
        </div>
      ) : PORTAL_STRIPE_ACTIVO ? (
        <div className="mt-4 flex gap-3">
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
        </div>
      ) : null}
      <p className="mt-3 text-sm text-brand-muted">
        {estado.contratado === "gratis" ? "Para darte de baja" : "Para cambiar de plan o darte de baja"}, escribe a{" "}
        <a href={MAILTO_PLAN} className="text-brand-blue hover:underline">kuentas@mercadonet.es</a>{" "}
        desde el email con el que te registraste.
        {conCaducidad && " Para dejar el plan de pago también basta con no renovarlo."}
        {estado.situacion === "sin_caducidad" && " La baja produce efectos al final del periodo de facturación en curso."}
      </p>
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

          {/* Certificado digital VERI*FACTU (V11) */}
          <CertificadoCard />

          {/* Notifications */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-brand-blue" />
              <h3 className="font-semibold text-brand-text">Notificaciones email</h3>
            </div>
            <div className="space-y-4">
              {[
                { key: "notifFiscales" as const, label: "Alertas fiscales", desc: "Fechas de presentación de modelos" },
                { key: "notifFacturas" as const, label: "Facturas pendientes", desc: "Recordatorios de cobro" },
                { key: "notifResumen" as const, label: "Resumen semanal", desc: "Informe de ingresos y gastos" },
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
