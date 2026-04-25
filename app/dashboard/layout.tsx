"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  FileText,
  Calculator,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { demoUser } from "@/lib/demo-data";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/ingresos", label: "Ingresos", icon: TrendingUp },
  { href: "/dashboard/gastos", label: "Gastos", icon: TrendingDown },
  { href: "/dashboard/facturas", label: "Facturas", icon: FileText },
  { href: "/dashboard/impuestos", label: "Impuestos", icon: Calculator },
  { href: "/dashboard/cashflow", label: "Cash Flow", icon: BarChart3 },
  { href: "/dashboard/ajustes", label: "Ajustes", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center gap-2">
        <Image src="/logo.png" alt="KUENTAS.EU" width={32} height={32} />
        <span className="text-lg font-bold text-brand-blue">KUENTAS.EU</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              isActive(item.href)
                ? "bg-brand-blue text-white shadow-sm"
                : "text-brand-muted hover:text-brand-text hover:bg-brand-gray"
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-brand-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-brand-blue flex items-center justify-center text-white text-sm font-bold">
            {demoUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-brand-text truncate">{demoUser.name}</p>
            <p className="text-xs text-brand-muted">Plan {demoUser.plan}</p>
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-brand-muted hover:text-brand-danger transition"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-brand-gray">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-brand-border flex-col shrink-0">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-white h-full shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-brand-muted"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-brand-border px-4 lg:px-8 h-16 flex items-center justify-between shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-brand-text">
            <Menu className="w-6 h-6" />
          </button>
          <div className="hidden lg:block">
            <p className="text-sm text-brand-muted">
              Hola, <span className="font-medium text-brand-text">{demoUser.name.split(" ")[0]}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-brand-blue/10 text-brand-blue px-3 py-1 rounded-full font-medium">
              DEMO
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
