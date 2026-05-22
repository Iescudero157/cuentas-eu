"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle, X, Download, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: "ingreso" | "gasto";
  category?: string;
  source?: string;
  valid: boolean;
  error?: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const separator = header.includes("\t") ? "\t" : header.includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const dateIdx = headers.findIndex((h) => ["fecha", "date", "f.valor", "f. valor"].includes(h));
  const descIdx = headers.findIndex((h) => ["descripcion", "concepto", "description", "detalle", "movimiento"].includes(h));
  const amountIdx = headers.findIndex((h) => ["importe", "amount", "cantidad", "monto", "valor"].includes(h));
  const typeIdx = headers.findIndex((h) => ["tipo", "type"].includes(h));

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    return [{ date: "", description: "Formato CSV no reconocido. Columnas requeridas: fecha, descripcion, importe", amount: 0, type: "gasto", valid: false, error: "Formato no reconocido" }];
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(separator).map((c) => c.trim().replace(/^"|"$/g, ""));
    const rawAmount = (cols[amountIdx] || "0").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const amount = Math.abs(parseFloat(rawAmount) || 0);
    const isNegative = rawAmount.startsWith("-") || parseFloat(rawAmount) < 0;

    let type: "ingreso" | "gasto" = isNegative ? "gasto" : "ingreso";
    if (typeIdx !== -1) {
      const typeVal = (cols[typeIdx] || "").toLowerCase();
      if (typeVal.includes("gasto") || typeVal.includes("cargo") || typeVal.includes("pago")) type = "gasto";
      else if (typeVal.includes("ingreso") || typeVal.includes("abono") || typeVal.includes("cobro")) type = "ingreso";
    }

    const date = cols[dateIdx] || "";
    const description = cols[descIdx] || "";

    // Validate date (try common formats)
    let parsedDate = "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      parsedDate = date;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      const [d, m, y] = date.split("/");
      parsedDate = `${y}-${m}-${d}`;
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(date)) {
      const [d, m, y] = date.split("-");
      parsedDate = `${y}-${m}-${d}`;
    }

    const valid = !!parsedDate && !!description && amount > 0;

    return {
      date: parsedDate || date,
      description,
      amount,
      type,
      valid,
      error: !valid ? "Datos incompletos o formato de fecha no válido" : undefined,
    };
  });
}

export default function ImportarPage() {
  const { isDemo } = useAuth();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);

  const handleFile = useCallback((file: File) => {
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".tsv") || file.name.endsWith(".txt"))) {
      handleFile(file);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    const validRows = rows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setImporting(true);
    let success = 0;
    let errors = 0;

    for (const row of validRows) {
      try {
        if (isDemo) {
          // Demo mode: just count
          success++;
          continue;
        }

        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: row.type,
            description: row.description,
            amount: row.amount,
            iva: row.type === "ingreso" ? row.amount * 0.21 : row.amount * 0.21 / 1.21,
            date: row.date,
            source: "banco",
            category: row.category || null,
            ai_categorized: false,
          }),
        });

        if (res.ok) success++;
        else errors++;
      } catch {
        errors++;
      }
    }

    setResult({ success, errors });
    setImporting(false);
  }

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.filter((r) => !r.valid).length;
  const totalAmount = rows.filter((r) => r.valid).reduce((s, r) => s + (r.type === "ingreso" ? r.amount : -r.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Importar transacciones</h1>
        <p className="text-brand-muted text-sm mt-1">Sube un archivo CSV de tu banco para importar movimientos</p>
      </div>

      {/* Download template */}
      <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4 flex items-start gap-3">
        <Download className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-brand-text">Formato esperado del CSV</p>
          <p className="text-xs text-brand-muted mt-1">
            El archivo debe tener columnas: <strong>fecha</strong>, <strong>descripcion</strong> (o concepto), <strong>importe</strong> (o cantidad).
            Los importes negativos se importan como gastos. Se aceptan separadores: coma, punto y coma, tabulador.
          </p>
          <p className="text-xs text-brand-muted mt-1">
            Formatos de fecha aceptados: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
          </p>
        </div>
      </div>

      {/* Drop zone */}
      {rows.length === 0 && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-brand-border rounded-xl p-12 text-center bg-white hover:border-brand-blue/40 transition"
        >
          <Upload className="w-10 h-10 text-brand-muted mx-auto mb-4" />
          <p className="text-brand-text font-medium mb-1">Arrastra tu archivo CSV aqui</p>
          <p className="text-sm text-brand-muted mb-4">o haz clic para seleccionarlo</p>
          <label className="inline-flex items-center gap-2 bg-brand-blue text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition cursor-pointer text-sm">
            <FileText className="w-4 h-4" /> Seleccionar archivo
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileInput} className="hidden" />
          </label>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-brand-blue" />
              <div>
                <p className="text-sm font-medium text-brand-text">{fileName}</p>
                <p className="text-xs text-brand-muted">{rows.length} filas detectadas</p>
              </div>
            </div>
            <button
              onClick={() => { setRows([]); setFileName(""); setResult(null); }}
              className="text-sm text-brand-muted hover:text-brand-danger flex items-center gap-1"
            >
              <X className="w-4 h-4" /> Quitar archivo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-brand-border/50 shadow-sm">
              <p className="text-xs text-brand-muted mb-1">Filas validas</p>
              <p className="text-2xl font-bold text-brand-success">{validCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-brand-border/50 shadow-sm">
              <p className="text-xs text-brand-muted mb-1">Con errores</p>
              <p className="text-2xl font-bold text-brand-danger">{invalidCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-brand-border/50 shadow-sm">
              <p className="text-xs text-brand-muted mb-1">Balance neto</p>
              <p className={`text-2xl font-bold ${totalAmount >= 0 ? "text-brand-success" : "text-brand-danger"}`}>
                {formatCurrency(totalAmount)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-brand-border/50 shadow-sm flex items-center justify-center">
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="bg-brand-blue text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-60 flex items-center gap-2 text-sm w-full justify-center"
              >
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : <>Importar {validCount} transacciones</>}
              </button>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-4 flex items-center gap-3 ${result.errors === 0 ? "bg-brand-success/10 border border-brand-success/20" : "bg-brand-warning/10 border border-brand-warning/20"}`}>
              <CheckCircle className={`w-5 h-5 ${result.errors === 0 ? "text-brand-success" : "text-brand-warning"}`} />
              <p className="text-sm font-medium">
                {result.success} transacciones importadas correctamente.
                {result.errors > 0 && ` ${result.errors} con errores.`}
              </p>
            </div>
          )}

          {/* Table preview */}
          <div className="bg-white rounded-xl border border-brand-border/50 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-brand-border">
              <h3 className="font-semibold text-brand-text text-sm">Vista previa</h3>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-brand-gray sticky top-0">
                  <tr>
                    <th className="text-center px-4 py-2 text-brand-muted font-medium w-8">#</th>
                    <th className="text-left px-4 py-2 text-brand-muted font-medium">Fecha</th>
                    <th className="text-left px-4 py-2 text-brand-muted font-medium">Descripcion</th>
                    <th className="text-left px-4 py-2 text-brand-muted font-medium">Tipo</th>
                    <th className="text-right px-4 py-2 text-brand-muted font-medium">Importe</th>
                    <th className="text-center px-4 py-2 text-brand-muted font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/50">
                  {rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className={row.valid ? "hover:bg-brand-gray/50" : "bg-brand-danger/5"}>
                      <td className="px-4 py-2 text-center text-brand-muted text-xs">{i + 1}</td>
                      <td className="px-4 py-2 text-brand-muted">{row.date}</td>
                      <td className="px-4 py-2 text-brand-text truncate max-w-[200px]">{row.description}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.type === "ingreso" ? "bg-brand-success/10 text-brand-success" : "bg-brand-danger/10 text-brand-danger"}`}>
                          {row.type === "ingreso" ? "Ingreso" : "Gasto"}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-right font-medium ${row.type === "ingreso" ? "text-brand-success" : "text-brand-danger"}`}>
                        {row.type === "ingreso" ? "+" : "-"}{formatCurrency(row.amount)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {row.valid ? (
                          <CheckCircle className="w-4 h-4 text-brand-success mx-auto" />
                        ) : (
                          <span className="text-xs text-brand-danger" title={row.error}>
                            <AlertTriangle className="w-4 h-4 mx-auto" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <p className="p-3 text-center text-xs text-brand-muted bg-brand-gray">
                  Mostrando 50 de {rows.length} filas
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
