"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, ArrowRight, AlertCircle, Info, Building2, Sparkles } from "lucide-react";

// ── Plan selector shown before the registration form ────────────────────────
function PlanSelector() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-gray">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <Image src="/logo.png" alt="KUENTAS.EU" width={32} height={32} />
          <span className="text-xl font-bold text-brand-blue">KUENTAS.EU</span>
        </Link>

        <h1 className="text-2xl font-bold text-brand-text mb-2">Crear cuenta</h1>
        <p className="text-brand-muted mb-8">Elige el tipo de cuenta que necesitas</p>

        <div className="space-y-4">
          {/* Profesional */}
          <Link href="/registro/profesional" className="block bg-white rounded-2xl border-2 border-brand-border hover:border-brand-green transition p-5 group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-green/10 flex items-center justify-center shrink-0 group-hover:bg-brand-green/20 transition">
                <User className="w-6 h-6 text-brand-green" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-brand-text">Registro Profesional</h2>
                  <span className="text-xs font-semibold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">Gratis</span>
                </div>
                <p className="text-sm text-brand-muted mt-0.5">Autónomos, freelancers y creadores de contenido</p>
              </div>
            </div>
          </Link>

          {/* Empresa */}
          <Link href="/registro/empresa" className="block bg-white rounded-2xl border-2 border-brand-border hover:border-brand-blue transition p-5 group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0 group-hover:bg-brand-blue/20 transition">
                <Building2 className="w-6 h-6 text-brand-blue" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-brand-text">Registro Empresa</h2>
                  <span className="text-xs font-semibold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-full">Desde 29,99€</span>
                </div>
                <p className="text-sm text-brand-muted mt-0.5">Pymes, equipos y negocios con múltiples usuarios</p>
              </div>
            </div>
          </Link>

          {/* Demo */}
          <Link href="/dashboard" className="block bg-brand-gray rounded-2xl border-2 border-dashed border-brand-border hover:border-brand-blue/40 transition p-5 group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-brand-muted" />
              </div>
              <div>
                <h2 className="font-bold text-brand-text">Probar sin registro</h2>
                <p className="text-sm text-brand-muted mt-0.5">Accede al demo con datos de ejemplo</p>
              </div>
            </div>
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-brand-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-brand-blue font-medium hover:underline">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegistroPage() {
  return <PlanSelector />;
}

function _RegistroPageOriginal() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs: { name?: string; email?: string; password?: string } = {};
    if (!name || name.trim().length < 2) errs.name = "Introduce tu nombre completo";
    if (!email) errs.email = "El email es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Email no válido";
    if (!password) errs.password = "La contraseña es obligatoria";
    else if (password.length < 8) errs.password = "Mínimo 8 caracteres";
    return errs;
  }

  function handleDemo() {
    setLoading(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-2 mb-10">
            <Image src="/logo.png" alt="KUENTAS.EU" width={32} height={32} />
            <span className="text-xl font-bold text-brand-blue">KUENTAS.EU</span>
          </Link>

          {/* Demo Mode Banner */}
          <div className="mb-6 flex items-start gap-3 bg-brand-blue/10 border border-brand-blue/20 rounded-xl p-4">
            <Info className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-brand-blue">Modo Demo disponible</p>
              <p className="text-xs text-brand-muted mt-0.5">
                Explora todas las funcionalidades sin registrarte con el boton &quot;Probar sin registro&quot;
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-brand-text mb-2">Crea tu cuenta gratis</h1>
          <p className="text-brand-muted mb-8">Empieza a gestionar tus finanzas en 2 minutos</p>

          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Nombre completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({ ...errors, name: undefined }); }}
                  placeholder="Tu nombre"
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue ${errors.name ? "border-brand-danger" : "border-brand-border"}`}
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-xs text-brand-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.name}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: undefined }); }}
                  placeholder="tu@email.com"
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue ${errors.email ? "border-brand-danger" : "border-brand-border"}`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-brand-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.email}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Contrasena</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                  placeholder="Mínimo 8 caracteres"
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue ${errors.password ? "border-brand-danger" : "border-brand-border"}`}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-brand-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.password}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-blue text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-60"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-brand-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-brand-muted">o</span>
            </div>
          </div>

          <button
            onClick={handleDemo}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 border-2 border-brand-blue text-brand-blue font-semibold py-2.5 rounded-lg hover:bg-brand-blue/5 transition disabled:opacity-60"
          >
            Probar sin registro <ArrowRight className="w-4 h-4" />
          </button>

          <p className="mt-6 text-center text-sm text-brand-muted">
            Ya tienes cuenta?{" "}
            <Link href="/login" className="text-brand-blue font-medium hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-brand-blue items-center justify-center p-12">
        <div className="max-w-md text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ahorra hasta 150 EUR/mes</h2>
          <p className="text-white/80 text-lg mb-8">
            Gestiona tus finanzas tú mismo con ayuda de IA. Sin gestoría, sin complicaciones.
          </p>
          <div className="space-y-3 text-left">
            {[
              "Conexion bancaria automatica via Open Banking",
              "Categorizacion IA de gastos",
              "Estimacion IVA + IRPF en tiempo real",
              "Facturas legales con numeracion",
              "Alertas de fechas fiscales",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <span className="text-xs">&#10003;</span>
                </div>
                <p className="text-sm">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
