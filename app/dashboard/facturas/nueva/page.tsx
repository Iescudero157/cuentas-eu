"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Eye, ArrowLeft } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { formatCurrency } from "@/lib/utils";
import { demoUser } from "@/lib/demo-data";
import { loadData, saveData } from "@/lib/storage";
import type { Invoice, InvoiceItem } from "@/lib/types";

const InvoicePDFButton = dynamic(() => import("@/components/InvoicePDF"), { ssr: false });

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

function buildInvoice(
  number: string,
  clientName: string,
  clientNif: string,
  clientAddress: string,
  items: LineItem[],
  ivaRate: number,
  irpfRate: number,
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
  dueDate.setDate(dueDate.getDate() + 30);
  return {
    id: `inv-${Date.now()}`,
    number,
    clientName,
    clientNif,
    clientAddress,
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
  };
}

export default function NuevaFacturaPage() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [clientNif, setClientNif] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [ivaRate, setIvaRate] = useState(21);
  const [irpfRate, setIrpfRate] = useState(15);
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const iva = subtotal * (ivaRate / 100);
  const irpf = subtotal * (irpfRate / 100);
  const total = subtotal + iva - irpf;

  // Compute next number from localStorage
  const existingInvoices = loadData<Invoice[]>("kuentas_facturas", []);
  const nextSeq = existingInvoices.length + 6; // offset from demo data
  const nextNumber = `FACT-2026-${String(nextSeq).padStart(3, "0")}`;
  const today = new Date().toISOString().split("T")[0];

  function addItem() {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  function handleSave() {
    const invoice = buildInvoice(
      nextNumber,
      clientName || "Cliente sin nombre",
      clientNif,
      clientAddress,
      items,
      ivaRate,
      irpfRate,
      today,
    );
    const existing = loadData<Invoice[]>("kuentas_facturas", []);
    saveData("kuentas_facturas", [invoice, ...existing]);
    setSavedInvoice(invoice);
  }

  function handleGoToList() {
    router.push("/dashboard/facturas");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/facturas" className="text-brand-muted hover:text-brand-text transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Nueva factura</h1>
          <p className="text-brand-muted text-sm mt-1">Numero: {nextNumber}</p>
        </div>
      </div>

      {savedInvoice && (
        <div className="bg-brand-success/10 border border-brand-success/20 rounded-xl p-4 flex items-center justify-between">
          <p className="text-brand-success text-sm font-medium">
            Factura {savedInvoice.number} guardada correctamente
          </p>
          <div className="flex items-center gap-3">
            <InvoicePDFButton
              invoice={savedInvoice}
              issuerName={demoUser.name}
              issuerNif={demoUser.nif}
              issuerAddress={demoUser.address}
            />
            <button
              onClick={handleGoToList}
              className="text-sm text-brand-blue font-medium hover:underline"
            >
              Ver listado
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-6">
          {/* Client */}
          <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm space-y-4">
            <h3 className="font-semibold text-brand-text">Datos del cliente</h3>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Nombre / Razon social</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Empresa S.L."
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm"
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
                  className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">IVA %</label>
                <select
                  value={ivaRate}
                  onChange={(e) => setIvaRate(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
                >
                  <option value={21}>21% (General)</option>
                  <option value={10}>10% (Reducido)</option>
                  <option value={4}>4% (Super reducido)</option>
                  <option value={0}>0% (Exento)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Direccion</label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="Calle, numero, CP, ciudad"
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm"
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
                    placeholder="Descripcion del servicio"
                    className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
                  />
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                    placeholder="Uds"
                    min={1}
                    className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
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
                    className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
                  />
                </div>
                <button onClick={() => removeItem(i)} className="text-brand-muted hover:text-brand-danger mt-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addItem}
              className="flex items-center gap-2 text-sm text-brand-blue font-medium hover:text-brand-blue/80 transition"
            >
              <Plus className="w-4 h-4" /> Anadir concepto
            </button>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleSave}
              className="bg-brand-blue text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition text-sm"
            >
              Guardar factura
            </button>
            {savedInvoice && (
              <InvoicePDFButton
                invoice={savedInvoice}
                issuerName={demoUser.name}
                issuerNif={demoUser.nif}
                issuerAddress={demoUser.address}
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

        {/* Preview */}
        <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm p-8">
          <div className="flex items-center gap-2 mb-6 text-brand-muted">
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">Vista previa</span>
          </div>

          <div className="border border-brand-border rounded-lg p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-brand-text">{demoUser.name}</h2>
                <p className="text-xs text-brand-muted">NIF: {demoUser.nif}</p>
                <p className="text-xs text-brand-muted">{demoUser.address}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-brand-blue">{nextNumber}</p>
                <p className="text-xs text-brand-muted">Fecha: {today}</p>
              </div>
            </div>

            {/* Client */}
            <div className="bg-brand-gray rounded-lg p-4">
              <p className="text-xs text-brand-muted mb-1">Facturar a:</p>
              <p className="text-sm font-medium">{clientName || "Nombre del cliente"}</p>
              <p className="text-xs text-brand-muted">{clientNif || "NIF/CIF"}</p>
              <p className="text-xs text-brand-muted">{clientAddress || "Direccion"}</p>
            </div>

            {/* Items table */}
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
                    <td className="py-2">{item.description || "-"}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-muted">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">IVA ({ivaRate}%)</span>
                <span>{formatCurrency(iva)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">IRPF (-{irpfRate}%)</span>
                <span className="text-brand-danger">-{formatCurrency(irpf)}</span>
              </div>
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
