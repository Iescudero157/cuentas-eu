"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Mail, User, Hash, Briefcase, Lock, ArrowLeft, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fireConversion } from "@/lib/gtag";

const SECTORES = [
  "Tecnología / Software", "Consultoría", "Construcción", "Comercio / Retail",
  "Hostelería / Restauración", "Salud / Bienestar", "Educación / Formación",
  "Marketing / Comunicación", "Inmobiliario", "Transporte / Logística", "Otro",
];

export default function RegistroEmpresaPage() {
  const [form, setForm] = useState({ empresa: "", cif: "", name: "", email: "", password: "", sector: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState("");

  function validate() {
    const e: Record<string, string> = {};
    if (!form.empresa.trim()) e.empresa = "Introduce el nombre de la empresa";
    if (!form.name.trim()) e.name = "Introduce el nombre del contacto";
    if (!form.email) e.email = "El email corporativo es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email no válido";
    if (!form.password || form.password.length < 8) e.password = "Mínimo 8 caracteres";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    setApiError("");

    try {
      // 1. Create Supabase auth account
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { name: form.name, empresa: form.empresa, tipo: "empresa" },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (authError) {
        const code = (authError as { code?: string }).code ?? "";
        const msg = authError.message?.toLowerCase() ?? "";
        if (
          code === "user_already_exists" || code === "email_exists" ||
          msg.includes("already registered") || msg.includes("already been registered") ||
          msg.includes("ya registrado") || msg.includes("ya existe")
        ) {
          setApiError("Este email ya tiene una cuenta. Inicia sesión o revisa tu bandeja de entrada.");
        } else if (code === "over_email_send_rate_limit" || msg.includes("rate limit") || msg.includes("demasiados")) {
          setApiError("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
        } else if (code === "weak_password" || msg.includes("weak_password") || msg.includes("contraseña")) {
          setApiError("La contraseña es demasiado débil. Usa al menos 8 caracteres con letras y números.");
        } else if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("conexión")) {
          setApiError("Error de conexión con el servidor. Inténtalo de nuevo en unos segundos.");
        } else {
          // Don't show raw server errors (often in English or confusing)
          setApiError("No se pudo crear la cuenta. Inténtalo de nuevo o contacta con soporte.");
        }
        return;
      }

      // Supabase silently "succeeds" for already-registered emails (identities=[])
      if (authData?.user?.identities?.length === 0) {
        setApiError("Este email ya tiene una cuenta. Inicia sesión o revisa tu bandeja de entrada.");
        return;
      }

      // 2. Notify via contact API (non-blocking — don't await)
      fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          empresa: form.empresa,
          cif: form.cif,
          sector: form.sector,
          tipo: "empresa",
          message: `Empresa: ${form.empresa}. Sector: ${form.sector || "No indicado"}.`,
        }),
      }).catch(() => { /* non-fatal */ });

      fireConversion(5.0, "EUR");
      setSuccess(true);
    } catch {
      setApiError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-brand-gray">
        <div className="bg-white rounded-2xl shadow-sm border border-brand-border/50 p-10 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-brand-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-brand-success" />
          </div>
          <h2 className="text-xl font-bold text-brand-text mb-2">¡Cuenta empresa creada!</h2>
          <p className="text-brand-muted text-sm mb-4">Revisa tu email y haz clic en el enlace de verificación para activar tu cuenta.</p>
          <Link href="/login" className="inline-block bg-brand-blue text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition text-sm">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-gray">
      <div className="w-full max-w-sm">
        <Link href="/registro" className="inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-blue transition mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-brand-border/50 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-brand-blue" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-brand-text">Registro Empresa</h1>
              <p className="text-sm text-brand-muted">Plan Business desde 29,99 EUR/mes</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Empresa */}
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Nombre de la empresa</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input type="text" value={form.empresa}
                  onChange={e => { setForm({ ...form, empresa: e.target.value }); setErrors({ ...errors, empresa: "" }); }}
                  placeholder="Mi Empresa S.L."
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue ${errors.empresa ? "border-brand-danger" : "border-brand-border"}`} />
              </div>
              {errors.empresa && <p className="mt-1 text-xs text-brand-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.empresa}</p>}
            </div>

            {/* CIF */}
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">CIF <span className="text-brand-muted font-normal">(opcional)</span></label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input type="text" value={form.cif}
                  onChange={e => setForm({ ...form, cif: e.target.value })}
                  placeholder="B12345678"
                  className="w-full pl-9 pr-4 py-2.5 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
            </div>

            {/* Contact name */}
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Nombre del contacto</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input type="text" value={form.name}
                  onChange={e => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: "" }); }}
                  placeholder="Tu nombre"
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue ${errors.name ? "border-brand-danger" : "border-brand-border"}`} />
              </div>
              {errors.name && <p className="mt-1 text-xs text-brand-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Email corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input type="email" value={form.email}
                  onChange={e => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: "" }); }}
                  placeholder="contacto@empresa.com"
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue ${errors.email ? "border-brand-danger" : "border-brand-border"}`} />
              </div>
              {errors.email && <p className="mt-1 text-xs text-brand-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input type="password" value={form.password}
                  onChange={e => { setForm({ ...form, password: e.target.value }); setErrors({ ...errors, password: "" }); }}
                  placeholder="Mínimo 8 caracteres"
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue ${errors.password ? "border-brand-danger" : "border-brand-border"}`} />
              </div>
              {errors.password && <p className="mt-1 text-xs text-brand-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.password}</p>}
            </div>

            {/* Sector */}
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Sector</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <select value={form.sector}
                  onChange={e => setForm({ ...form, sector: e.target.value })}
                  className="w-full pl-9 pr-4 py-2.5 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue bg-white appearance-none">
                  <option value="">Selecciona tu sector</option>
                  {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {apiError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {apiError}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-brand-blue hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando cuenta...</> : "Crear Cuenta Empresa"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-brand-muted">
            Al registrarte aceptas nuestros{" "}
            <a href="/privacidad" className="text-brand-blue hover:underline">términos de uso y política de privacidad</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
