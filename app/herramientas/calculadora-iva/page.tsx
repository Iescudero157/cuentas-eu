"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Calculator, ArrowRight, RefreshCw } from "lucide-react";

// Metadata via layout — see herramientas/layout.tsx

function formatEur(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function CalculadoraIVAPage() {
  const [base, setBase] = useState("");
  const [tipoIva, setTipoIva] = useState<21 | 10 | 4 | 0>(21);
  const [retencionPct, setRetencionPct] = useState<0 | 7 | 15>(0);
  const [modo, setModo] = useState<"sin_iva" | "con_iva">("sin_iva");

  const baseNum = parseFloat(base.replace(",", ".")) || 0;

  const calculo = useMemo(() => {
    if (baseNum <= 0) return null;

    let baseImponible: number;
    let totalConIva: number;

    if (modo === "sin_iva") {
      baseImponible = baseNum;
      totalConIva = baseNum * (1 + tipoIva / 100);
    } else {
      totalConIva = baseNum;
      baseImponible = baseNum / (1 + tipoIva / 100);
    }

    const cuotaIva = baseImponible * (tipoIva / 100);
    const cuotaRetencion = baseImponible * (retencionPct / 100);
    const totalACobrar = totalConIva - cuotaRetencion;

    return { baseImponible, cuotaIva, cuotaRetencion, totalConIva, totalACobrar };
  }, [baseNum, tipoIva, retencionPct, modo]);

  function reset() {
    setBase("");
    setTipoIva(21);
    setRetencionPct(0);
    setModo("sin_iva");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="w-14 h-14 bg-[#2A5AAE]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Calculator className="w-7 h-7 text-[#2A5AAE]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
          Calculadora de IVA para Autónomos
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Calcula el IVA de tus facturas en segundos: base imponible, cuota, retención IRPF y total
          a cobrar. Gratis, sin registro.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Datos de la factura</h2>

          {/* Modo */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              El importe que introduces es…
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: "sin_iva", label: "Sin IVA (base)" },
                { val: "con_iva", label: "Con IVA incluido" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setModo(opt.val as typeof modo)}
                  className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition ${
                    modo === opt.val
                      ? "border-[#2A5AAE] bg-[#2A5AAE]/5 text-[#2A5AAE]"
                      : "border-gray-100 text-gray-500 hover:border-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Importe */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Importe ({modo === "sin_iva" ? "base imponible" : "total con IVA"})
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="0,00"
                min="0"
                step="0.01"
                className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl text-lg font-bold text-gray-900 focus:outline-none focus:border-[#2A5AAE] transition"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
            </div>
          </div>

          {/* Tipo IVA */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo de IVA</label>
            <div className="grid grid-cols-4 gap-2">
              {([21, 10, 4, 0] as const).map((pct) => (
                <button
                  key={pct}
                  onClick={() => setTipoIva(pct)}
                  className={`py-2.5 rounded-lg text-sm font-bold border-2 transition ${
                    tipoIva === pct
                      ? "border-[#2A5AAE] bg-[#2A5AAE] text-white"
                      : "border-gray-100 text-gray-600 hover:border-gray-200"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {tipoIva === 21 && "General — servicios, tecnología, diseño, consultoría"}
              {tipoIva === 10 && "Reducido — hostelería, transporte, construcción"}
              {tipoIva === 4 && "Superreducido — libros, medicamentos, alimentos básicos"}
              {tipoIva === 0 && "Exento — educación, sanidad, seguros, servicios financieros"}
            </p>
          </div>

          {/* Retención IRPF */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Retención IRPF{" "}
              <span className="font-normal text-gray-400">(solo si facturas a empresa/autónomo)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([0, 7, 15] as const).map((pct) => (
                <button
                  key={pct}
                  onClick={() => setRetencionPct(pct)}
                  className={`py-2.5 rounded-lg text-sm font-bold border-2 transition ${
                    retencionPct === pct
                      ? "border-[#2A5AAE] bg-[#2A5AAE]/5 text-[#2A5AAE] border-[#2A5AAE]"
                      : "border-gray-100 text-gray-600 hover:border-gray-200"
                  }`}
                >
                  {pct === 0 ? "Sin ret." : `${pct}%`}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {retencionPct === 0 && "Sin retención — factura a particulares o exento de IRPF"}
              {retencionPct === 7 && "7% — Primeros 3 años de actividad como autónomo"}
              {retencionPct === 15 && "15% — Más de 3 años de actividad (tipo general)"}
            </p>
          </div>

          <button
            onClick={reset}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            <RefreshCw className="w-4 h-4" /> Limpiar
          </button>
        </div>

        {/* Results */}
        <div>
          <div className="bg-[#2A5AAE] rounded-2xl p-8 text-white mb-4">
            <h2 className="text-lg font-bold mb-6 text-white/80">Desglose de la factura</h2>
            {calculo ? (
              <div className="space-y-4">
                <div className="flex justify-between text-white/70 text-sm">
                  <span>Base imponible</span>
                  <span className="font-semibold text-white">{formatEur(calculo.baseImponible)}</span>
                </div>
                <div className="flex justify-between text-white/70 text-sm">
                  <span>IVA ({tipoIva}%)</span>
                  <span className="font-semibold text-white">+ {formatEur(calculo.cuotaIva)}</span>
                </div>
                {retencionPct > 0 && (
                  <div className="flex justify-between text-white/70 text-sm">
                    <span>Retención IRPF ({retencionPct}%)</span>
                    <span className="font-semibold text-white">− {formatEur(calculo.cuotaRetencion)}</span>
                  </div>
                )}
                <div className="border-t border-white/20 pt-4">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-white/70">Total con IVA</span>
                    <span className="font-semibold">{formatEur(calculo.totalConIva)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/80 font-semibold">Total a cobrar</span>
                    <span className="text-2xl font-extrabold">{formatEur(calculo.totalACobrar)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-white/40">
                <Calculator className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Introduce el importe para ver el cálculo</p>
              </div>
            )}
          </div>

          {calculo && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm">
              <p className="font-semibold text-gray-900 mb-3">Lo que pasa con el IVA:</p>
              <ul className="space-y-2 text-gray-600">
                <li>• Cobras <strong>{formatEur(calculo.totalConIva)}</strong> de tu cliente (base + IVA)</li>
                <li>• De ese IVA (<strong>{formatEur(calculo.cuotaIva)}</strong>), <strong className="text-[#2A5AAE]">no es tuyo</strong> — lo ingresas a Hacienda en el Modelo 303</li>
                {retencionPct > 0 && (
                  <li>• Tu cliente retiene <strong>{formatEur(calculo.cuotaRetencion)}</strong> y lo ingresa a Hacienda por ti (cuenta como adelanto de tu IRPF)</li>
                )}
                <li>• Tu ingreso real neto: <strong className="text-emerald-600">{formatEur(calculo.totalACobrar)}</strong></li>
              </ul>
            </div>
          )}

          {/* CTA */}
          <div className="mt-4 bg-[#2A5AAE]/5 border border-[#2A5AAE]/10 rounded-2xl p-5">
            <p className="text-sm font-semibold text-gray-900 mb-1">¿Gestionas varias facturas?</p>
            <p className="text-xs text-gray-600 mb-3">
              KUENTAS.EU calcula el IVA de todas tus facturas y transacciones automáticamente.
              Sabes en todo momento cuánto debes al Modelo 303.
            </p>
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 bg-[#2A5AAE] text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition"
            >
              Empezar gratis <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Info section below */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Cómo funciona el IVA para autónomos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "IVA repercutido",
              desc: "Es el IVA que añades a tus facturas y cobras a tus clientes. No es un ingreso tuyo: lo recaudas en nombre de Hacienda.",
              color: "bg-emerald-50 border-emerald-100",
              text: "text-emerald-700",
            },
            {
              title: "IVA soportado",
              desc: "Es el IVA que tú pagas en los gastos de tu negocio (proveedores, material, software). Puedes deducirlo del IVA repercutido.",
              color: "bg-blue-50 border-blue-100",
              text: "text-blue-700",
            },
            {
              title: "IVA a pagar",
              desc: "La diferencia: IVA repercutido − IVA soportado. Si es positivo, lo ingresas a Hacienda. Si es negativo, lo compensas o solicitas devolución.",
              color: "bg-amber-50 border-amber-100",
              text: "text-amber-700",
            },
          ].map((c) => (
            <div key={c.title} className={`rounded-xl border p-5 ${c.color}`}>
              <h3 className={`font-bold mb-2 ${c.text}`}>{c.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link
            href="/blog/modelo-303-iva-trimestral-guia"
            className="inline-flex items-center gap-2 text-[#2A5AAE] font-semibold text-sm hover:underline"
          >
            → Leer la guía completa del Modelo 303
          </Link>
        </div>
      </section>
    </div>
  );
}
