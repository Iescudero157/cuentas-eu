"use client";

import { useState } from "react";
import { Users, Plus, Pencil, Trash2, Search, X, Loader2, Building2 } from "lucide-react";
import { useClients, type Client } from "@/lib/hooks/useClients";

interface ClientFormData {
  name: string;
  nif: string;
  email: string;
  address: string;
  phone: string;
  notes: string;
}

const emptyForm: ClientFormData = { name: "", nif: "", email: "", address: "", phone: "", notes: "" };

export default function ClientesPage() {
  const { clients, loading, addClient, updateClient, deleteClient } = useClients();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const filtered = clients.filter((c) =>
    `${c.name} ${c.nif} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(client: Client) {
    setForm({
      name: client.name,
      nif: client.nif || "",
      email: client.email || "",
      address: client.address || "",
      phone: client.phone || "",
      notes: client.notes || "",
    });
    setEditingId(client.id);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    if (editingId) {
      await updateClient(editingId, form);
    } else {
      await addClient(form);
    }

    setSaving(false);
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (confirm("Eliminar este cliente?")) {
      await deleteClient(id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Clientes</h1>
          <p className="text-brand-muted text-sm mt-1">Gestiona tu cartera de clientes</p>
        </div>
        <button
          onClick={openNew}
          className="bg-brand-blue text-white font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Total clientes</p>
          <p className="text-3xl font-bold text-brand-text">{clients.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Con NIF/CIF</p>
          <p className="text-3xl font-bold text-brand-blue">{clients.filter((c) => c.nif).length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
          <p className="text-sm text-brand-muted mb-1">Con email</p>
          <p className="text-3xl font-bold text-brand-success">{clients.filter((c) => c.email).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, NIF o email..."
          className="w-full pl-10 pr-4 py-2.5 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm bg-white"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-blue mx-auto mb-2" />
            <p className="text-sm text-brand-muted">Cargando clientes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-brand-muted mx-auto mb-3" />
            <p className="text-brand-muted text-sm">
              {search ? "No se encontraron clientes" : "Aun no tienes clientes"}
            </p>
            {!search && (
              <button onClick={openNew} className="mt-3 text-sm text-brand-blue font-medium hover:underline">
                Crear tu primer cliente
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-gray">
                <tr>
                  <th className="text-left px-6 py-3 text-brand-muted font-medium">Nombre</th>
                  <th className="text-left px-6 py-3 text-brand-muted font-medium">NIF/CIF</th>
                  <th className="text-left px-6 py-3 text-brand-muted font-medium">Email</th>
                  <th className="text-left px-6 py-3 text-brand-muted font-medium">Telefono</th>
                  <th className="text-center px-6 py-3 text-brand-muted font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {filtered.map((client) => (
                  <tr key={client.id} className="hover:bg-brand-gray/50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-brand-text">{client.name}</p>
                      {client.address && <p className="text-xs text-brand-muted mt-0.5 truncate max-w-[200px]">{client.address}</p>}
                    </td>
                    <td className="px-6 py-4 text-brand-muted">{client.nif || "-"}</td>
                    <td className="px-6 py-4 text-brand-muted">{client.email || "-"}</td>
                    <td className="px-6 py-4 text-brand-muted">{client.phone || "-"}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(client)}
                          className="p-1.5 rounded-lg hover:bg-brand-blue/10 text-brand-muted hover:text-brand-blue transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          className="p-1.5 rounded-lg hover:bg-brand-danger/10 text-brand-muted hover:text-brand-danger transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-brand-text">
                {editingId ? "Editar cliente" : "Nuevo cliente"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-brand-muted hover:text-brand-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">Nombre / Razon social *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Empresa S.L."
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-brand-text mb-1">NIF/CIF</label>
                  <input
                    type="text"
                    value={form.nif}
                    onChange={(e) => setForm({ ...form, nif: e.target.value })}
                    placeholder="B12345678"
                    className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-text mb-1">Telefono</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="912345678"
                    className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contacto@empresa.es"
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">Direccion</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Calle, numero, CP, ciudad"
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notas internas sobre este cliente"
                  rows={2}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 bg-brand-blue text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : editingId ? "Guardar cambios" : "Crear cliente"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 border border-brand-border rounded-lg text-sm text-brand-muted hover:bg-brand-gray transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
