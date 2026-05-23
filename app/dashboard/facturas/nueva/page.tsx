"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Eye, ArrowLeft, User, ChevronDown, Send, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { formatCurrency } from "@/lib/utils";
import { loadData, saveData } from "@/lib/storage";
import { useAuth } from "@/lib/hooks/useAuth";
import { useClients } from "@/lib/hooks/useClients";
import PlanLimitBanner from "@/components/PlanLimitBanner";
import type { Invoice, InvoiceItem, PaymentMethod } from "@/lib/types";

const InvoicePDFButton = dynamic(() => import("@/components/InvoicePDF"), { ssr: false });

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "efectivo", label: "Efectivo" },
  { value: "domiciliacion", label: "Domiciliación bancaria" },
  { value: "cheque", label: "Cheque" },
  { value: "otro", label: "Otro" },
];

function buildInvoice(
  number: string,
  clientId: string,
  clientName: string,
  clientNif: string,
  clientAddress: string,
  clientEmail: string,
  items: LineItem[],
  ivaRate: number,
  irpfRate: number,
  paymentMethod: PaymentMethod,
  daysUntilDue: number,
  notes: string,
  today: string,
): Invoice {
  const invoiceItems: InvoiceItem[] = items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.quantity * item.unitPrice,
  }));
  const subtotal = invoiceItems.reduce((s, i) => s + i.total, 0);
  const iva = subtotal * (ivaRate / 100);
  const irpf = subtotal * (irpfRate / 100);
  const total = subtotal + iva - irpf;
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + daysUntilDue);
  return {
    id: `inv-${Date.now()}`,
    number,
    clientId: clientId || undefined,
    clientName,
    clientNif,
    clientAddress,
    clientEmail: clientEmail || undefined,
    items: invoiceItems,
    subtotal,
    iva,
    ivaRate,
    irpf,
    irpfRate,
    total,
    date: today,
    dueDate: dueDate.toISOString().split("T")[0],
    status: "pendiente",
    paymentMethod,
    notes: notes || undefined,
  };
}

export default function NuevaFacturaPage() {
  const router = useRouter();
  const { user, isDemo } = useAuth();
  const { clients } = useClients();

  // Client selector
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Client fields
  const [clientName, setClientName] = useState("");
  const [clientNif, setClientNif] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // Invoice fields
  const [ivaRate, setIvaRate] = useState(21);
  const [irpfRate, setIrpfRate] = useState(15);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transferencia");
  const [daysUntilDue, setDaysUntilDue] = useState(30);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);

  // State
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [issuerProfile, setIssuerProfile] = useState({ name: "", nif: "", address: "" });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load issuer profile
  useEffect(() => {
    if (!isDemo && user) {
      fetch("/api/profile")
        .then((r) => r.json())
        .then((d) => {
          if (d.profile) {
            setIssuerProfile({
              name: d.profile.name || "",
              nif: d.profile.nif || "",
              address: d.profile.address || "",
            });
          }
        })
        .catch(() => {});
    } else {
      setIssuerProfile({ name: "Carlos Martínez López", nif: "47234567B", address: "Calle Mayor 10, 28001 Madrid" });
    }
  }, [user, isDemo]);

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.nif || "").toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(clientSearch.toLowerCase())
  );

  function selectClient(client: { id: string; name: string; nif?: string; address?: string; email?: string }) {
    setSelectedClientId(client.id);
    setClientName(client.name);
    setClientNif(client.nif || "");
    setClientAddress(client.address || "");
    setClientEmail(client.email || "");
    setClientSearch(client.name);
    setShowClientDropdown(false);
  }

  function clearClient() {
    setSelectedClientId("");
    setClientName("");
    setClientNif("");
    setClientAddress("");
    setClientEmail("");
    setClientSearch("");
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const iva = subtotal * (ivaRate / 100);
  const irpf = subtotal * (irpfRate / 100);
  const total = subtotal + iva - irpf;

  const existingInvoices = loadData<Invoice[]>("kuentas_facturas", []);
  const nextSeq = existingInvoices.length + 6;
  const nextNumber = `FACT-2026-${String(nextSeq).padStart(3, "0")}`;
  const today = new Date().toISOString().split("T")[0];
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysUntilDue);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  function addItem() {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0 }]);
  }
  function removeItem(index: number) {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  }
  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  async function handleSave() {
    setSaving(true);
    const invoice = buildInvoice(
      nextNumber,
      selectedClientId,
      clientName || "Cliente sin nombre",
      clientNif,
      clientAddress,
      clientEmail,
      items,
      ivaRate,
      irpfRate,
      paymentMethod,
      daysUntilDue,
      notes,
      today,
    );

    if (!isDemo && user) {
      try {
        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: invoice.number,
            client_id: invoice.clientId || null,
            client_name: invoice.clientName,
            client_nif: invoice.clientNif,
            client_address: invoice.clientAddress,
            client_email: invoice.clientEmail || null,
            items: invoice.items,
            subtotal: invoice.subtotal,
            iva: invoice.iva,
            iva_rate: invoice.ivaRate,
            irpf: invoice.irpf,
            irpf_rate: invoice.irpfRate,
            total: invoice.total,
            date: invoice.date,
            due_date: invoice.dueDate,
            status: "pendiente",
            payment_method: invoice.paymentMethod,
            notes: invoice.notes || null,
          }),
        });
        const data = await res.json();
        if (res.status === 402) {
          // Plan limit reached — show upsell
          router.push("/precios?limit=1");
          return;
        }
        if (res.ok && data.invoice) {
          setSavedInvoice({ ...invoice, id: data.invoice.id });
        } else {
          setSavedInvoice(invoice);
        }
      } catch {
        setSavedInvoice(invoice);
      }
    } else {
      const existing = loadData<Invoice[]>("kuentas_facturas", []);
      saveData("kuentas_facturas", [invoice, ...existing]);
      setSavedInvoice(invoice);
    }
    setSaving(false);
  }

  async function handleSendEmail() {
    if (!savedInvoice || !clientEmail) return;
    setSendingEmail(true);
    setEmailError("");
    try {
      const res = await fetch(`/api/invoices/${savedInvoice.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: clientEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error enviando");
      setEmailSent(true);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Error enviando email");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/facturas" className="text-brand-muted hover:text-brand-text transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Nueva factura</h1>
          <p className="text-brand-muted text-sm mt-1">Número: {nextNumber}</p>
        </div>
      </div>

      {savedInvoice && (
        <div className="bg-brand-success/10 border border-brand-success/20 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-brand-success" />
              <p className="text-brand-success text-sm font-medium">
                Factura {savedInvoice.number} guardada correctamente
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <InvoicePDFButton
                invoice={savedInvoice}
                issuerName={issuerProfile.name}
                issuerNif={issuerProfile.nif}
                issuerAddress={issuerProfile.address}
              />
              {clientEmail && !emailSent && (
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="flex items-center gap-2 bg-brand-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-60"
                >
                  {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sendingEmail ? "Enviando…" : `Enviar a ${clientEmail}`}
                </button>
              )}
              {emailSent && (
                <span className="flex items-center gap-1.5 text-sm text-brand-success font-medium">
                  <CheckCircle className="w-4 h-4" /> Email enviado
                </span>
              )}
              {emailError && (
                <span className="flex items-center gap-1.5 text-sm text-brand-danger">
                  <AlertCircle className="w-4 h-4" /> {emailError}
                </span>
              )}
              <button
                onClick={() => router.push("/dashboard/facturas")}
                className="text-sm text-brand-blue font-medium hover:underline"
              >
                Ver listado
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── FORM ── */}
        <div className="space-y-6">
          {/* Client selector */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-brand-text">Datos del cliente</h3>
              {selectedClientId && (
                <button onClick={clearClient} className="text-xs text-brand-muted hover:text-brand-danger transition">
                  Limpiar
                </button>
              )}
            </div>

            {/* Client search combobox */}
            <div className="relative" ref={clientDropdownRef}>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Buscar cliente existente
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setShowClientDropdown(true);
                    if (!e.target.value) clearClient();
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Escribe nombre, NIF o email…"
                  className="w-full pl-9 pr-8 py-2.5 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none" />
              </div>
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-brand-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      onMouseDown={() => selectClient(c)}
                      className="w-full text-left px-4 py-3 hover:bg-brand-gray/50 transition border-b border-brand-border/30 last:border-0"
                    >
                      <p className="text-sm font-medium text-brand-text">{c.name}</p>
                      <p className="text-xs text-brand-muted">{[c.nif, c.email].filter(Boolean).join(" · ")}</p>
                    </button>
                  ))}
                </div>
              )}
              {showClientDropdown && clientSearch && filteredClients.length === 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-brand-border rounded-xl shadow-lg p-3">
                  <p className="text-sm text-brand-muted text-center">No hay clientes. <Link href="/dashboard/clientes" className="text-brand-blue hover:underline">Crear uno</Link></p>
                </div>
              )}
            </div>

            {/* Manual fields (auto-filled when client selected) */}
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Nombre / Razón social</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Empresa S.L."
                className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">NIF/CIF</label>
                <input
                  type="text"
                  value={clientNif}
                  onChange={(e) => setClientNif(e.target.value)}
                  placeholder="B12345678"
                  className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">Email del cliente</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="cliente@empresa.com"
                  className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Dirección</label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="Calle, número, CP, ciudad"
                className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm"
              />
            </div>
          </div>

          {/* Payment & Tax */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm space-y-4">
            <h3 className="font-semibold text-brand-text">Impuestos y cobro</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">IVA %</label>
                <select
                  value={ivaRate}
                  onChange={(e) => setIvaRate(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
                >
                  <option value={21}>21% (General)</option>
                  <option value={10}>10% (Reducido)</option>
                  <option value={4}>4% (Superreducido)</option>
                  <option value={0}>0% (Exento)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">IRPF %</label>
                <select
                  value={irpfRate}
                  onChange={(e) => setIrpfRate(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
                >
                  <option value={0}>0% (Sin retención)</option>
                  <option value={15}>15% (General)</option>
                  <option value={7}>7% (Nuevos autónomos)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">Forma de cobro</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">Vencimiento</label>
                <select
                  value={daysUntilDue}
                  onChange={(e) => setDaysUntilDue(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
                >
                  <option value={0}>Al contado</option>
                  <option value={15}>15 días</option>
                  <option value={30}>30 días</option>
                  <option value={60}>60 días</option>
                  <option value={90}>90 días</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Notas internas <span className="text-brand-muted font-normal">(opcional, no aparecen en la factura)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Referencia interna, número de pedido…"
                className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm resize-none"
              />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm space-y-4">
            <h3 className="font-semibold text-brand-text">Conceptos</h3>
            {items.map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex-1">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    placeholder="Descripción del servicio"
                    className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
                  />
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                    placeholder="Uds"
                    min={1}
                    className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
                  />
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    value={item.unitPrice || ""}
                    onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value))}
                    placeholder="Precio"
                    min={0}
                    step={0.01}
                    className="w-full px-3 py-2.5 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
                  />
                </div>
                <button onClick={() => removeItem(i)} className="text-brand-muted hover:text-brand-danger mt-2.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addItem}
              className="flex items-center gap-2 text-sm text-brand-blue font-medium hover:text-brand-blue/80 transition"
            >
              <Plus className="w-4 h-4" /> Añadir concepto
            </button>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-blue text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition text-sm disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Guardando…" : "Guardar factura"}
            </button>
            {savedInvoice && (
              <InvoicePDFButton
                invoice={savedInvoice}
                issuerName={issuerProfile.name}
                issuerNif={issuerProfile.nif}
                issuerAddress={issuerProfile.address}
              />
            )}
            <Link
              href="/dashboard/facturas"
              className="border border-brand-border text-brand-muted font-medium px-6 py-2.5 rounded-lg hover:bg-brand-gray transition text-sm"
            >
              Cancelar
            </Link>
          </div>
        </div>

        {/* ── PREVIEW ── */}
        <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm p-8 sticky top-6 h-fit">
          <div className="flex items-center gap-2 mb-6 text-brand-muted">
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">Vista previa</span>
          </div>

          <div className="border border-brand-border rounded-lg p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-brand-text">{issuerProfile.name || "Tu nombre"}</h2>
                <p className="text-xs text-brand-muted">NIF: {issuerProfile.nif || "—"}</p>
                <p className="text-xs text-brand-muted">{issuerProfile.address || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-brand-blue">{nextNumber}</p>
                <p className="text-xs text-brand-muted">Fecha: {today}</p>
                <p className="text-xs text-brand-muted">Vence: {dueDateStr}</p>
              </div>
            </div>

            <div className="bg-brand-gray rounded-lg p-4">
              <p className="text-xs text-brand-muted mb-1">Facturar a:</p>
              <p className="text-sm font-medium">{clientName || "Nombre del cliente"}</p>
              <p className="text-xs text-brand-muted">{clientNif || "NIF/CIF"}</p>
              <p className="text-xs text-brand-muted">{clientAddress || "Dirección"}</p>
              {clientEmail && <p className="text-xs text-brand-blue mt-1">{clientEmail}</p>}
            </div>

            {paymentMethod && (
              <p className="text-xs text-brand-muted">
                Forma de cobro: <span className="font-medium text-brand-text capitalize">
                  {PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label}
                </span>
              </p>
            )}

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left py-2 text-brand-muted">Concepto</th>
                  <th className="text-center py-2 text-brand-muted w-12">Uds</th>
                  <th className="text-right py-2 text-brand-muted w-20">Precio</th>
                  <th className="text-right py-2 text-brand-muted w-20">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-brand-border/50">
                    <td className="py-2">{item.description || "—"}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-muted">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">IVA ({ivaRate}%)</span>
                <span>{formatCurrency(iva)}</span>
              </div>
              {irpfRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-brand-muted">IRPF (-{irpfRate}%)</span>
                  <span className="text-brand-danger">-{formatCurrency(irpf)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-brand-border pt-2 font-bold text-base">
                <span>TOTAL</span>
                <span className="text-brand-blue">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
