"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleDemo() {
    router.push("/dashboard");
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-2 mb-10">
            <Image src="/logo.png" alt="CUENTAS.EU" width={32} height={32} />
            <span className="text-xl font-bold text-gradient-brand">CUENTAS.EU</span>
          </Link>

          <h1 className="text-2xl font-bold text-brand-text mb-2">Bienvenido de vuelta</h1>
          <p className="text-brand-muted mb-8">Inicia sesion para gestionar tus finanzas</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Contrasena</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contrasena"
                  className="w-full pl-10 pr-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full gradient-brand text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition"
            >
              Iniciar sesion
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
            className="w-full flex items-center justify-center gap-2 border-2 border-brand-blue text-brand-blue font-semibold py-2.5 rounded-lg hover:bg-brand-blue/5 transition"
          >
            Probar sin registro <ArrowRight className="w-4 h-4" />
          </button>

          <p className="mt-6 text-center text-sm text-brand-muted">
            No tienes cuenta?{" "}
            <Link href="/registro" className="text-brand-blue font-medium hover:underline">
              Registrate gratis
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Branding */}
      <div className="hidden lg:flex flex-1 gradient-brand items-center justify-center p-12">
        <div className="max-w-md text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Todas tus cuentas, en una app</h2>
          <p className="text-white/80 text-lg mb-8">
            Conecta tu banco, categoriza gastos con IA, estima impuestos y factura. Todo en un solo sitio.
          </p>
          <div className="grid grid-cols-2 gap-4 text-left">
            {["3.4M autonomos", "IA integrada", "IVA + IRPF auto", "Facturas legales"].map((item) => (
              <div key={item} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <p className="text-sm font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
