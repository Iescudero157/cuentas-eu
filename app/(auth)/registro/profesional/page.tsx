"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Phone, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";

const API = "https://cuentas-eu.vercel.app/api/contact";

export default function RegistroProfesionalPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", telefono: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState("");

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Introduce tu nombre completo";
    if (!form.email) e.email = "El email es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email no válido";
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
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tipo: "profesional", perfil: "autonomo" }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => router.push("/dashboard"), 2500);
      } else {
        setApiError(data.error || "Error al registrar. Inténtalo de nuevo.");
      }
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
          <h2 className="text-xl font-bold text-brand-text mb-2">¡Cuenta creada!</h2>
          <p className="text-brand-muted text-sm">Revisa tu email — te hemos enviado la bienvenida. Redirigiendo al dashboard...</p>
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
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-brand-green/10 flex items-center justify-center">
              <User className="w-6 h-6 text-brand-green" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-brand-text">Registro Profesional</h1>
              <p className="text-sm text-brand-muted">Gratis para siempre</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Nombre completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input
                  type="text"
                  value={form.name}
                  onChange={e => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: "" }); }}
                  placeholder="Carlos Martínez López"
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue ${errors.name ? "border-brand-danger" : "border-brand-border"}`}
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-brand-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: "" }); }}
                  placeholder="tu@email.com"
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue ${errors.email ? "border-brand-danger" : "border-brand-border"}`}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-brand-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Teléfono <span className="text-brand-muted font-normal">(opcional)</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={e => setForm({ ...form, telefono: e.target.value })}
                  placeholder="+34 628 201 218"
                  className="w-full pl-9 pr-4 py-2.5 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>
            </div>

            {apiError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {apiError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-brand-green hover:bg-brand-green-dark transition disabled:opacity-60"
            >
              {loading ? "Creando cuenta..." : "Crear Cuenta Gratis"}
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
