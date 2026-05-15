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
  updateInvoiceStatus: (id: string, status: Invoice["status"]) => Promise<boolean>;
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
        clientName: inv.client_name as string,
        clientNif: (inv.client_nif || "") as string,
        clientAddress: (inv.client_address || "") as string,
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
          client_name: inv.clientName,
          client_nif: inv.clientNif,
          client_address: inv.clientAddress,
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

  const updateInvoiceStatus = useCallback(async (id: string, status: Invoice["status"]): Promise<boolean> => {
    if (isDemo || !user) {
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status } : inv))
      );
      return true;
    }

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error("Error actualizando factura");
      }

      await fetchInvoices();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando factura");
      return false;
    }
  }, [user, isDemo, fetchInvoices]);

  return { invoices, loading, error, addInvoice, updateInvoiceStatus, refresh: fetchInvoices };
}
