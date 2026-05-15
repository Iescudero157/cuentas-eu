"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { demoTransactions } from "@/lib/demo-data";
import type { Transaction } from "@/lib/types";

interface UseTransactionsOptions {
  year?: number;
  month?: number;
  type?: "ingreso" | "gasto";
}

interface UseTransactionsReturn {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  addTransaction: (tx: Omit<Transaction, "id">) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useTransactions(options?: UseTransactionsOptions): UseTransactionsReturn {
  const { user, isDemo } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (isDemo || !user) {
      // Demo mode: use demo data
      let filtered = [...demoTransactions];
      if (options?.type) {
        filtered = filtered.filter((t) => t.type === options.type);
      }
      setTransactions(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options?.year) params.set("year", String(options.year));
      if (options?.month) params.set("month", String(options.month));
      if (options?.type) params.set("type", options.type);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error cargando transacciones");
      }

      // Map DB format to frontend format
      const mapped: Transaction[] = (data.transactions || []).map((t: Record<string, unknown>) => ({
        id: t.id as string,
        type: t.type as "ingreso" | "gasto",
        description: t.description as string,
        amount: Number(t.amount),
        iva: Number(t.iva || 0),
        date: t.date as string,
        source: (t.source || "banco") as Transaction["source"],
        category: t.category as string | undefined,
        aiCategorized: t.ai_categorized as boolean | undefined,
        client: t.client as string | undefined,
      }));

      setTransactions(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      // Fallback to demo data on error
      setTransactions(demoTransactions);
    } finally {
      setLoading(false);
    }
  }, [user, isDemo, options?.year, options?.month, options?.type]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = useCallback(async (tx: Omit<Transaction, "id">): Promise<boolean> => {
    if (isDemo || !user) {
      // Demo mode: add locally
      const newTx: Transaction = { ...tx, id: `demo-${Date.now()}` };
      setTransactions((prev) => [newTx, ...prev]);
      return true;
    }

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: tx.type,
          description: tx.description,
          amount: tx.amount,
          iva: tx.iva,
          date: tx.date,
          source: tx.source,
          category: tx.category,
          ai_categorized: tx.aiCategorized,
          client: tx.client,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error creando transaccion");
      }

      await fetchTransactions();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando transaccion");
      return false;
    }
  }, [user, isDemo, fetchTransactions]);

  const deleteTransaction = useCallback(async (id: string): Promise<boolean> => {
    if (isDemo || !user) {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      return true;
    }

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Error eliminando transaccion");
      }
      await fetchTransactions();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando transaccion");
      return false;
    }
  }, [user, isDemo, fetchTransactions]);

  return { transactions, loading, error, addTransaction, deleteTransaction, refresh: fetchTransactions };
}
