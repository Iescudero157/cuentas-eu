"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";

export interface Client {
  id: string;
  name: string;
  nif: string;
  email: string;
  address: string;
  phone: string;
  notes: string;
  created_at?: string;
}

const DEMO_CLIENTS: Client[] = [
  { id: "c1", name: "Restaurante La Tasca S.L.", nif: "B12345678", email: "admin@latasca.es", address: "Calle Serrano 15, 28001 Madrid", phone: "912345678", notes: "Cliente recurrente" },
  { id: "c2", name: "Startup XYZ", nif: "B87654321", email: "cto@startupxyz.com", address: "Paseo de la Castellana 200, 28046 Madrid", phone: "917654321", notes: "Proyecto branding" },
  { id: "c3", name: "Clinica Dental Sonrie", nif: "B11111111", email: "info@sonrie.es", address: "Calle Alcala 75, 28009 Madrid", phone: "911111111", notes: "Mantenimiento mensual" },
  { id: "c4", name: "Inmobiliaria Costa", nif: "B22222222", email: "contacto@inmocosta.es", address: "Av. del Mediterraneo 10, 03001 Alicante", phone: "965555555", notes: "Landing page" },
  { id: "c5", name: "Banco Digital S.A.", nif: "A99999999", email: "tech@bancodigital.com", address: "Plaza de Colon 1, 28001 Madrid", phone: "919999999", notes: "Consultoria UX" },
];

interface UseClientsReturn {
  clients: Client[];
  loading: boolean;
  error: string | null;
  addClient: (client: Omit<Client, "id">) => Promise<boolean>;
  updateClient: (id: string, client: Partial<Client>) => Promise<boolean>;
  deleteClient: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useClients(): UseClientsReturn {
  const { user, isDemo } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    if (isDemo || !user) {
      setClients(DEMO_CLIENTS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/clients");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error cargando clientes");
      }

      setClients(data.clients || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setClients(DEMO_CLIENTS);
    } finally {
      setLoading(false);
    }
  }, [user, isDemo]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const addClient = useCallback(async (client: Omit<Client, "id">): Promise<boolean> => {
    if (isDemo || !user) {
      const newClient: Client = { ...client, id: `demo-${Date.now()}` };
      setClients((prev) => [newClient, ...prev]);
      return true;
    }

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(client),
      });
      if (!res.ok) throw new Error("Error creando cliente");
      await fetchClients();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      return false;
    }
  }, [user, isDemo, fetchClients]);

  const updateClient = useCallback(async (id: string, updates: Partial<Client>): Promise<boolean> => {
    if (isDemo || !user) {
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
      return true;
    }

    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Error actualizando cliente");
      await fetchClients();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      return false;
    }
  }, [user, isDemo, fetchClients]);

  const deleteClient = useCallback(async (id: string): Promise<boolean> => {
    if (isDemo || !user) {
      setClients((prev) => prev.filter((c) => c.id !== id));
      return true;
    }

    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error eliminando cliente");
      await fetchClients();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      return false;
    }
  }, [user, isDemo, fetchClients]);

  return { clients, loading, error, addClient, updateClient, deleteClient, refresh: fetchClients };
}
