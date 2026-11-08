"use client";

// Caducidad mensual (8-nov-2026): renueva un mes el plan contratado con el mismo pago que /precios
// (/api/redsys/checkout + formulario al TPV de BBVA). Cada pago cubre un mes; no hay cargo automático.
// El formulario hacia el banco se crea en document.body: este botón vive dentro del <form> de Ajustes y un
// <form> anidado no es HTML válido.
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

function enviarAlBanco(url: string, campos: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  form.style.display = "none";
  for (const [nombre, valor] of Object.entries(campos)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = nombre;
    input.value = valor;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export default function RenovarPlan({ plan, texto }: { plan: string; texto: string }) {
  const [cargando, setCargando] = useState(false);

  async function pagar() {
    setCargando(true);
    try {
      const res = await fetch("/api/redsys/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar el pago");
      enviarAlBanco(data.redsysUrl, {
        Ds_SignatureVersion: data.Ds_SignatureVersion,
        Ds_MerchantParameters: data.Ds_MerchantParameters,
        Ds_Signature: data.Ds_Signature,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo iniciar el pago. Inténtalo de nuevo.");
      setCargando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={pagar}
      disabled={cargando}
      className="flex-1 flex items-center justify-center gap-2 bg-brand-blue text-white text-sm font-semibold py-2 rounded-lg hover:opacity-90 transition disabled:opacity-60"
    >
      {cargando ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Redirigiendo al banco...</>
      ) : (
        <><RefreshCw className="w-4 h-4" /> {texto}</>
      )}
    </button>
  );
}
