"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="KUENTAS.EU" width={36} height={36} />
          <span className="text-xl font-bold text-brand-blue">KUENTAS.EU</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-brand-muted">
          <a href="#how" className="hover:text-brand-blue transition">Cómo funciona</a>
          <a href="#features" className="hover:text-brand-blue transition">Funcionalidades</a>
          <a href="#pricing" className="hover:text-brand-blue transition">Precios</a>
          <a href="#faq" className="hover:text-brand-blue transition">FAQ</a>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-brand-text hover:text-brand-blue transition"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="bg-brand-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
          >
            Registrarse gratis
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 rounded-lg text-brand-text hover:bg-brand-gray hover:text-brand-blue transition"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-brand-border bg-white shadow-lg">
          <div className="px-4 py-3 space-y-1">
            <a
              href="#how"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-brand-text hover:bg-brand-gray hover:text-brand-blue transition"
            >
              Cómo funciona
            </a>
            <a
              href="#features"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-brand-text hover:bg-brand-gray hover:text-brand-blue transition"
            >
              Funcionalidades
            </a>
            <a
              href="#pricing"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-brand-text hover:bg-brand-gray hover:text-brand-blue transition"
            >
              Precios
            </a>
            <a
              href="#faq"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-brand-text hover:bg-brand-gray hover:text-brand-blue transition"
            >
              FAQ
            </a>
          </div>
          <div className="px-4 pb-4 pt-2 border-t border-brand-border flex flex-col gap-2">
            <Link
              href="/login"
              className="block text-center px-4 py-2.5 rounded-lg text-sm font-semibold text-brand-text border-2 border-brand-border hover:border-brand-blue/40 transition"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="block text-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-brand-blue text-white hover:opacity-90 transition"
            >
              Registrarse gratis
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
