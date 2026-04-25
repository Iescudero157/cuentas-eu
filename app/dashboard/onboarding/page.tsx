"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Building2, CreditCard, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { saveData } from "@/lib/storage";

const STEPS = [
  { id: 1, title: "Datos personales", icon: User },
  { id: 2, title: "Tu actividad", icon: Building2 },
  { id: 3, title: "Configuracion fiscal", icon: CreditCard },
  { id: 4, title: "Listo", icon: CheckCircle },
];

interface OnboardingData {
  name: string;
  nif: string;
  email: string;
  address: string;
  activity: string;
  epigrafe: string;
  tipoIva: number;
  retencionIrpf: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    nif: "",
    email: "",
    address: "",
    activity: "",
    epigrafe: "",
    tipoIva: 21,
    retencionIrpf: 15,
  });

  function next() {
    if (step < 4) setStep(step + 1);
  }

  function back() {
    if (step > 1) setStep(step - 1);
  }

  function handleFinish() {
    saveData("kuentas_ajustes", {
      ...data,
      notifFiscales: true,
      notifFacturas: true,
      notifResumen: false,
      notifTips: true,
    });
    router.push("/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      {/* Progress */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                step > s.id
                  ? "bg-brand-success border-brand-success text-white"
                  : step === s.id
                  ? "bg-brand-blue border-brand-blue text-white"
                  : "border-brand-border text-brand-muted"
              }`}>
                {step > s.id ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <s.icon className="w-5 h-5" />
                )}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`h-0.5 w-16 sm:w-24 mx-1 transition-all ${step > s.id ? "bg-brand-success" : "bg-brand-border"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm text-brand-muted text-center">
          Paso {step} de {STEPS.length}: <strong className="text-brand-text">{STEPS[step - 1].title}</strong>
        </p>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-brand-border/50 shadow-sm p-8">

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-brand-text">Cuéntanos sobre ti</h2>
              <p className="text-brand-muted text-sm mt-1">Esta informacion aparecera en tus facturas</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Nombre completo *</label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder="Carlos Martinez Lopez"
                className="w-full px-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">NIF/NIE</label>
              <input
                type="text"
                value={data.nif}
                onChange={(e) => setData({ ...data, nif: e.target.value })}
                placeholder="12345678A"
                className="w-full px-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Email de contacto</label>
              <input
                type="email"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                placeholder="tu@email.com"
                className="w-full px-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Direccion fiscal</label>
              <input
                type="text"
                value={data.address}
                onChange={(e) => setData({ ...data, address: e.target.value })}
                placeholder="Calle Gran Via 42, 28013 Madrid"
                className="w-full px-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-brand-text">Tu actividad profesional</h2>
              <p className="text-brand-muted text-sm mt-1">Para calcular tus impuestos correctamente</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Describe tu actividad *</label>
              <input
                type="text"
                value={data.activity}
                onChange={(e) => setData({ ...data, activity: e.target.value })}
                placeholder="Desarrollo web y diseno digital"
                className="w-full px-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Epigrafe IAE (opcional)</label>
              <input
                type="text"
                value={data.epigrafe}
                onChange={(e) => setData({ ...data, epigrafe: e.target.value })}
                placeholder="831 - Servicios tecnicos"
                className="w-full px-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
            <div className="bg-brand-blue/5 rounded-xl p-4">
              <p className="text-sm text-brand-blue font-medium mb-1">Ejemplos de actividades comunes:</p>
              <ul className="text-sm text-brand-muted space-y-1">
                {["Desarrollo web / software", "Diseño grafico / UX", "Consultoria empresarial", "Creador de contenido", "Fotografia / video", "Marketing digital"].map((a) => (
                  <li key={a} className="cursor-pointer hover:text-brand-blue transition" onClick={() => setData({ ...data, activity: a })}>
                    + {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-brand-text">Configuracion fiscal</h2>
              <p className="text-brand-muted text-sm mt-1">Estos valores se usan en tus facturas e impuestos</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Tipo de IVA por defecto</label>
              <select
                value={data.tipoIva}
                onChange={(e) => setData({ ...data, tipoIva: Number(e.target.value) })}
                className="w-full px-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                <option value={21}>21% - General (servicios, tecnologia, diseño)</option>
                <option value={10}>10% - Reducido (alimentacion elaborada, transporte)</option>
                <option value={4}>4% - Superreducido (libros, medicamentos)</option>
                <option value={0}>0% - Exento (educacion, sanidad, financiero)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Retención IRPF en facturas</label>
              <select
                value={data.retencionIrpf}
                onChange={(e) => setData({ ...data, retencionIrpf: Number(e.target.value) })}
                className="w-full px-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                <option value={15}>15% - General (más de 3 años como autónomo)</option>
                <option value={7}>7% - Reducido (primeros 3 años de actividad)</option>
              </select>
            </div>
            <div className="bg-brand-blue/5 rounded-xl p-4 text-sm text-brand-muted">
              <p><strong className="text-brand-text">IRPF 15%:</strong> Si llevas más de 3 años como autónomo o ya has facturado antes.</p>
              <p className="mt-2"><strong className="text-brand-text">IRPF 7%:</strong> Si es tu primer, segundo o tercer año como autónomo.</p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center space-y-6 py-4">
            <div className="w-20 h-20 bg-brand-success/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-brand-success" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-brand-text">Todo listo, {data.name.split(" ")[0] || "autónomo"}!</h2>
              <p className="text-brand-muted mt-2">Tu cuenta está configurada. Ahora puedes empezar a gestionar tus finanzas.</p>
            </div>
            <div className="bg-brand-gray rounded-xl p-5 text-left space-y-3">
              <p className="text-sm font-semibold text-brand-text">Próximos pasos recomendados:</p>
              {[
                "Importa tus transacciones o conecta tu banco",
                "Crea tu primera factura a un cliente",
                "Revisa los próximos plazos fiscales en el dashboard",
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-brand-muted">
                  <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs flex items-center justify-center font-bold shrink-0">
                    {i + 1}
                  </span>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={back}
          disabled={step === 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-brand-border text-brand-muted hover:bg-brand-gray transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Anterior
        </button>

        {step < 4 ? (
          <button
            onClick={next}
            className="flex items-center gap-2 bg-brand-blue text-white px-6 py-2.5 rounded-lg hover:opacity-90 transition text-sm font-semibold"
          >
            Siguiente <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="flex items-center gap-2 bg-brand-blue text-white px-6 py-2.5 rounded-lg hover:opacity-90 transition text-sm font-semibold"
          >
            Ir al dashboard <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
