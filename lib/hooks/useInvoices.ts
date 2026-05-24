"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { demoInvoices } from "@/lib/demo-data";
import { loadData, saveData } from "@/lib/storage";
import type { Invoice } from "@/lib/types";

interface UseInvoicesReturn {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  addInvoice: (inv: Invoice) => Promise<boolean>;
  updateInvoiceStatus: (id: string, status: Invoice["status"], paymentDate?: string) => Promise<boolean>;
  sendInvoiceEmail: (id: string) => Promise<{ ok: boolean; sentTo?: string; error?: string }>;
  refresh: () => Promise<void>;
}

export function useInvoices(): UseInvoicesReturn {
  const { user, isDemo } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (isDemo || !user) {
      // Demo mode: use demo data + localStorage
      const stored = loadData<Invoice[]>("kuentas_facturas", []);
      const all = stored.length > 0 ? [...stored, ...demoInvoices] : [...demoInvoices];
      const seen = new Set<string>();
      const deduped = all.filter((inv) => {
        if (seen.has(inv.id)) return false;
        seen.add(inv.id);
        return true;
      });
      setInvoices(deduped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/invoices");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error cargando facturas");
      }

      const mapped: Invoice[] = (data.invoices || []).map((inv: Record<string, unknown>) => ({
        id: inv.id as string,
        number: inv.number as string,
        clientId: (inv.client_id || undefined) as string | undefined,
        clientName: inv.client_name as string,
        clientNif: (inv.client_nif || "") as string,
        clientAddress: (inv.client_address || "") as string,
        clientEmail: (inv.client_email || undefined) as string | undefined,
        items: (inv.items || []) as Invoice["items"],
        subtotal: Number(inv.subtotal),
        iva: Number(inv.iva),
        ivaRate: Number(inv.iva_rate),
        irpf: Number(inv.irpf),
        irpfRate: Number(inv.irpf_rate),
        total: Number(inv.total),
        date: inv.date as string,
        dueDate: (inv.due_date || inv.date) as string,
        status: (inv.status || "pendiente") as Invoice["status"],
        paymentMethod: (inv.payment_method || undefined) as Invoice["paymentMethod"],
        paymentDate: (inv.payment_date || undefined) as string | undefined,
        notes: (inv.notes || undefined) as string | undefined,
      }));

      setInvoices(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setInvoices(demoInvoices);
    } finally {
      setLoading(false);
    }
  }, [user, isDemo]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const addInvoice = useCallback(async (inv: Invoice): Promise<boolean> => {
    if (isDemo || !user) {
      // Demo mode: save to localStorage
      const existing = loadData<Invoice[]>("kuentas_facturas", []);
      saveData("kuentas_facturas", [inv, ...existing]);
      setInvoices((prev) => [inv, ...prev]);
      return true;
    }

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: inv.number,
          client_id: inv.clientId || null,
          client_name: inv.clientName,
          client_nif: inv.clientNif,
          client_address: inv.clientAddress,
          client_email: inv.clientEmail || null,
          items: inv.items,
          subtotal: inv.subtotal,
          iva: inv.iva,
          iva_rate: inv.ivaRate,
          irpf: inv.irpf,
          irpf_rate: inv.irpfRate,
          total: inv.total,
          date: inv.date,
          due_date: inv.dueDate,
          status: inv.status,
          payment_method: inv.paymentMethod || null,
          payment_date: inv.paymentDate || null,
          notes: inv.notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error creando factura");
      }

      await fetchInvoices();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando factura");
      return false;
    }
  }, [user, isDemo, fetchInvoices]);

  const updateInvoiceStatus = useCallback(async (
    id: string,
    status: Invoice["status"],
    paymentDate?: string,
  ): Promise<boolean> => {
    if (isDemo || !user) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === id ? { ...inv, status, ...(paymentDate ? { paymentDate } : {}) } : inv
        )
      );
      return true;
    }

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, payment_date: paymentDate || null }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error actualizando factura");
      }

      // ── Cash Flow sync: when marked cobrada, auto-create the income transaction ──
      if (status === "cobrada") {
        const invoice = invoices.find((inv) => inv.id === id);
        if (invoice) {
          const txSource =
            invoice.paymentMethod === "efectivo"
              ? "efectivo"
              : invoice.paymentMethod === "tarjeta"
              ? "stripe"
              : "transferencia";

          // Non-fatal: if this fails cash flow is just not updated automatically
          fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "ingreso",
              description: `Cobro factura ${invoice.number} — ${invoice.clientName}`,
              amount: invoice.total,
              iva: invoice.iva,
              date: paymentDate || new Date().toISOString().split("T")[0],
              source: txSource,
              client: invoice.clientName,
              ai_categorized: false,
            }),
          }).catch(() => {});
        }
      }

      await fetchInvoices();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando factura");
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isDemo, fetchInvoices, invoices]);

  const sendInvoiceEmail = useCallback(async (id: string): Promise<{ ok: boolean; sentTo?: string; error?: string }> => {
    if (isDemo || !user) {
      return { ok: false, error: "El envío por email no está disponible en modo demo" };
    }

    try {
      const res = await fetch(`/api/invoices/${id}/email`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || "Error enviando email" };
      }

      return { ok: true, sentTo: data.sentTo };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
    }
  }, [user, isDemo]);

  return { invoices, loading, error, addInvoice, updateInvoiceStatus, sendInvoiceEmail, refresh: fetchInvoices };
}
