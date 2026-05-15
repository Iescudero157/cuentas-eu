"use client";

import { useState } from "react";
import { X, Loader2, Brain } from "lucide-react";
import type { Transaction, TransactionSource, ExpenseCategory } from "@/lib/types";

interface TransactionModalProps {
  type: "ingreso" | "gasto";
  onSave: (tx: Omit<Transaction, "id">) => Promise<boolean>;
  onClose: () => void;
}

const SOURCES: { value: TransactionSource; label: string }[] = [
  { value: "transferencia", label: "Transferencia" },
  { value: "stripe", label: "Stripe" },
  { value: "paypal", label: "PayPal" },
  { value: "wise", label: "Wise" },
  { value: "efectivo", label: "Efectivo" },
  { value: "banco", label: "Banco" },
];

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
  { value: "coworking", label: "Coworking" },
  { value: "transporte", label: "Transporte" },
  { value: "comida", label: "Comida" },
  { value: "marketing", label: "Marketing" },
  { value: "telefono", label: "Telefono" },
  { value: "formacion", label: "Formacion" },
  { value: "seguros", label: "Seguros" },
  { value: "material", label: "Material oficina" },
  { value: "servicios", label: "Servicios" },
  { value: "otros", label: "Otros" },
];

export default function TransactionModal({ type, onSave, onClose }: TransactionModalProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [ivaRate, setIvaRate] = useState(21);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [source, setSource] = useState<TransactionSource>("transferencia");
  const [category, setCategory] = useState<ExpenseCategory>("otros");
  const [client, setClient] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const iva = numAmount * (ivaRate / 100);

  async function categorizeWithAI() {
    if (!description) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, amount: numAmount }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.category && CATEGORIES.some((c) => c.value === data.category)) {
          setCategory(data.category);
          setAiSuggestion(`IA sugiere: ${CATEGORIES.find((c) => c.value === data.category)?.label}`);
        }
      }
    } catch {
      // Ignore
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description || numAmount <= 0 || !date) return;

    setSaving(true);
    const success = await onSave({
      type,
      description,
      amount: numAmount,
      iva,
      date,
      source,
      category: type === "gasto" ? category : undefined,
      aiCategorized: !!aiSuggestion,
      client: type === "ingreso" ? client : undefined,
    });

    setSaving(false);
    if (success) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-brand-text">
            {type === "ingreso" ? "Nuevo ingreso" : "Nuevo gasto"}
          </h2>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-text mb-1">Descripcion *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => { if (type === "gasto" && description) categorizeWithAI(); }}
              placeholder={type === "ingreso" ? "Desarrollo web para cliente" : "Suscripcion Figma Pro"}
              required
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Importe (EUR) *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                required
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">IVA %</label>
              <select
                value={ivaRate}
                onChange={(e) => setIvaRate(Number(e.target.value))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                <option value={21}>21% General</option>
                <option value={10}>10% Reducido</option>
                <option value={4}>4% Super reducido</option>
                <option value={0}>0% Exento</option>
              </select>
            </div>
          </div>

          {numAmount > 0 && (
            <div className="bg-brand-gray rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-muted">Base imponible</span>
                <span className="font-medium">{numAmount.toFixed(2)} EUR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">IVA ({ivaRate}%)</span>
                <span className="font-medium">{iva.toFixed(2)} EUR</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Fecha *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Fuente</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as TransactionSource)}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {type === "ingreso" && (
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Cliente</label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
          )}

          {type === "gasto" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-brand-text">Categoria</label>
                {description && (
                  <button
                    type="button"
                    onClick={categorizeWithAI}
                    disabled={aiLoading}
                    className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                    Categorizar con IA
                  </button>
                )}
              </div>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value as ExpenseCategory); setAiSuggestion(null); }}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {aiSuggestion && (
                <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                  <Brain className="w-3 h-3" /> {aiSuggestion}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !description || numAmount <= 0}
              className={`flex-1 font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm text-white ${
                type === "ingreso" ? "bg-brand-success" : "bg-brand-danger"
              }`}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : type === "ingreso" ? "Registrar ingreso" : "Registrar gasto"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-brand-border rounded-lg text-sm text-brand-muted hover:bg-brand-gray transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
