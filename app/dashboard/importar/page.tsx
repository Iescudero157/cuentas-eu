"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  X,
  Download,
  Loader2,
  Camera,
  ScanLine,
  Sparkles,
  Edit3,
  Save,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";

// ─── CSV types & parser ───────────────────────────────────────────────────────

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: "ingreso" | "gasto";
  category?: string;
  valid: boolean;
  error?: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const separator = header.includes("\t") ? "\t" : header.includes(";") ? ";" : ",";
  const headers = lines[0]
    .split(separator)
    .map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const dateIdx = headers.findIndex((h) =>
    ["fecha", "date", "f.valor", "f. valor"].includes(h)
  );
  const descIdx = headers.findIndex((h) =>
    ["descripcion", "concepto", "description", "detalle", "movimiento"].includes(h)
  );
  const amountIdx = headers.findIndex((h) =>
    ["importe", "amount", "cantidad", "monto", "valor"].includes(h)
  );
  const typeIdx = headers.findIndex((h) => ["tipo", "type"].includes(h));

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    return [
      {
        date: "",
        description:
          "Formato CSV no reconocido. Columnas requeridas: fecha, descripcion, importe",
        amount: 0,
        type: "gasto",
        valid: false,
        error: "Formato no reconocido",
      },
    ];
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(separator).map((c) => c.trim().replace(/^"|"$/g, ""));
    const rawAmount = (cols[amountIdx] || "0")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");
    const amount = Math.abs(parseFloat(rawAmount) || 0);
    const isNegative = rawAmount.startsWith("-") || parseFloat(rawAmount) < 0;

    let type: "ingreso" | "gasto" = isNegative ? "gasto" : "ingreso";
    if (typeIdx !== -1) {
      const typeVal = (cols[typeIdx] || "").toLowerCase();
      if (
        typeVal.includes("gasto") ||
        typeVal.includes("cargo") ||
        typeVal.includes("pago")
      )
        type = "gasto";
      else if (
        typeVal.includes("ingreso") ||
        typeVal.includes("abono") ||
        typeVal.includes("cobro")
      )
        type = "ingreso";
    }

    const date = cols[dateIdx] || "";
    const description = cols[descIdx] || "";

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

// ─── OCR result type ──────────────────────────────────────────────────────────

interface OcrResult {
  date: string | null;
  vendor: string | null;
  description: string | null;
  subtotal: number | null;
  iva_rate: number | null;
  iva_amount: number | null;
  total: number | null;
  type: "ingreso" | "gasto";
  category: string | null;
  deductible: boolean;
  confidence: number;
  notes: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  software: "Software",
  hardware: "Hardware",
  coworking: "Coworking / Oficina",
  transporte: "Transporte",
  comida: "Comida",
  marketing: "Marketing",
  telefono: "Teléfono / Internet",
  formacion: "Formación",
  seguros: "Seguros",
  material: "Material",
  servicios: "Servicios profesionales",
  otros: "Otros",
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImportarPage() {
  const { isDemo } = useAuth();
  const [activeTab, setActiveTab] = useState<"csv" | "scan">("csv");

  // ── CSV state ──
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  // ── Scan state ──
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [editableOcr, setEditableOcr] = useState<Partial<OcrResult>>({});
  const [savingOcr, setSavingOcr] = useState(false);
  const [saveOcrResult, setSaveOcrResult] = useState<"ok" | "error" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ─── CSV handlers ─────────────────────────────────────────────────────────

  const handleCsvFile = useCallback((file: File) => {
    setImportResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRows(parseCSV(text));
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  function handleCsvDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (
      file &&
      (file.name.endsWith(".csv") ||
        file.name.endsWith(".tsv") ||
        file.name.endsWith(".txt"))
    ) {
      handleCsvFile(file);
    }
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
            iva:
              row.type === "ingreso"
                ? row.amount * 0.21
                : (row.amount * 0.21) / 1.21,
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

    setImportResult({ success, errors });
    setImporting(false);
  }

  // ─── Scan handlers ────────────────────────────────────────────────────────

  function handleImageSelect(file: File) {
    setScanError(null);
    setOcrResult(null);
    setEditableOcr({});
    setSaveOcrResult(null);
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  async function handleScan() {
    if (!imageFile) return;
    setScanning(true);
    setScanError(null);
    setSaveOcrResult(null);

    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      const res = await fetch("/api/scan", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error en el análisis");

      const result: OcrResult = data.extracted;
      setOcrResult(result);
      setEditableOcr({ ...result });
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : "Error desconocido al analizar"
      );
    } finally {
      setScanning(false);
    }
  }

  async function handleSaveOcr() {
    if (!editableOcr) return;
    setSavingOcr(true);
    setSaveOcrResult(null);

    try {
      if (isDemo) {
        setSaveOcrResult("ok");
        setSavingOcr(false);
        return;
      }

      const amount = editableOcr.total ?? editableOcr.subtotal ?? 0;
      const ivaAmount = editableOcr.iva_amount ?? 0;

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editableOcr.type ?? "gasto",
          description:
            editableOcr.description || editableOcr.vendor || "Sin descripción",
          amount,
          iva: ivaAmount,
          date: editableOcr.date || new Date().toISOString().slice(0, 10),
          source: "efectivo",
          category: editableOcr.category || null,
          ai_categorized: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error guardando transacción");
      }

      setSaveOcrResult("ok");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Error guardando");
      setSaveOcrResult("error");
    } finally {
      setSavingOcr(false);
    }
  }

  function resetScan() {
    setImageFile(null);
    setImagePreview(null);
    setOcrResult(null);
    setEditableOcr({});
    setScanError(null);
    setSaveOcrResult(null);
  }

  // ─── CSV derived ──────────────────────────────────────────────────────────

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.filter((r) => !r.valid).length;
  const totalAmount = rows
    .filter((r) => r.valid)
    .reduce((s, r) => s + (r.type === "ingreso" ? r.amount : -r.amount), 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Importar transacciones</h1>
        <p className="text-brand-muted text-sm mt-1">
          Importa desde un CSV bancario o analiza facturas y tickets con IA
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-brand-gray rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("csv")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === "csv"
              ? "bg-white text-brand-text shadow-sm"
              : "text-brand-muted hover:text-brand-text"
          }`}
        >
          <FileText className="w-4 h-4" />
          CSV / Banco
        </button>
        <button
          onClick={() => setActiveTab("scan")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === "scan"
              ? "bg-white text-brand-text shadow-sm"
              : "text-brand-muted hover:text-brand-text"
          }`}
        >
          <ScanLine className="w-4 h-4" />
          Foto / Escáner IA
        </button>
      </div>

      {/* ══ CSV tab ══════════════════════════════════════════════════════════ */}
      {activeTab === "csv" && (
        <>
          <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4 flex items-start gap-3">
            <Download className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-brand-text">Formato esperado del CSV</p>
              <p className="text-xs text-brand-muted mt-1">
                Columnas requeridas: <strong>fecha</strong>,{" "}
                <strong>descripcion</strong> (o concepto),{" "}
                <strong>importe</strong> (o cantidad). Importes negativos → gastos.
                Separadores admitidos: coma, punto y coma, tabulador.
              </p>
              <p className="text-xs text-brand-muted mt-1">
                Formatos de fecha: YYYY-MM-DD · DD/MM/YYYY · DD-MM-YYYY
              </p>
            </div>
          </div>

          {rows.length === 0 && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCsvDrop}
              className="border-2 border-dashed border-brand-border rounded-xl p-12 text-center bg-white hover:border-brand-blue/40 transition"
            >
              <Upload className="w-10 h-10 text-brand-muted mx-auto mb-4" />
              <p className="text-brand-text font-medium mb-1">
                Arrastra tu archivo CSV aquí
              </p>
              <p className="text-sm text-brand-muted mb-4">o haz clic para seleccionarlo</p>
              <label className="inline-flex items-center gap-2 bg-brand-blue text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition cursor-pointer text-sm">
                <FileText className="w-4 h-4" /> Seleccionar archivo
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvFile(f);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          )}

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
                  onClick={() => { setRows([]); setFileName(""); setImportResult(null); }}
                  className="text-sm text-brand-muted hover:text-brand-danger flex items-center gap-1"
                >
                  <X className="w-4 h-4" /> Quitar archivo
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 border border-brand-border/50 shadow-sm">
                  <p className="text-xs text-brand-muted mb-1">Filas válidas</p>
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
                    {importing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                    ) : (
                      <>Importar {validCount} transacciones</>
                    )}
                  </button>
                </div>
              </div>

              {importResult && (
                <div className={`rounded-xl p-4 flex items-center gap-3 ${importResult.errors === 0 ? "bg-brand-success/10 border border-brand-success/20" : "bg-brand-warning/10 border border-brand-warning/20"}`}>
                  <CheckCircle className={`w-5 h-5 ${importResult.errors === 0 ? "text-brand-success" : "text-brand-warning"}`} />
                  <p className="text-sm font-medium">
                    {importResult.success} transacciones importadas correctamente.
                    {importResult.errors > 0 && ` ${importResult.errors} con errores.`}
                  </p>
                </div>
              )}

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
                        <th className="text-left px-4 py-2 text-brand-muted font-medium">Descripción</th>
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
                              <span title={row.error}>
                                <AlertTriangle className="w-4 h-4 text-brand-danger mx-auto" />
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
        </>
      )}

      {/* ══ Scan tab ══════════════════════════════════════════════════════════ */}
      {activeTab === "scan" && (
        <div className="space-y-5">
          <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-brand-text">
                Análisis de facturas y tickets con IA
              </p>
              <p className="text-xs text-brand-muted mt-1">
                Saca una foto a cualquier factura, ticket o recibo. La IA extrae
                automáticamente la fecha, importe, IVA y categoría. Revisa los datos
                y guárdalos como transacción con un clic.
              </p>
            </div>
          </div>

          {/* Upload area — only shown before image is selected */}
          {!imagePreview && (
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-brand-border rounded-xl bg-white hover:border-brand-blue/40 hover:bg-brand-blue/5 transition text-center"
              >
                <Camera className="w-10 h-10 text-brand-blue" />
                <div>
                  <p className="font-semibold text-brand-text">Sacar foto</p>
                  <p className="text-xs text-brand-muted mt-1">Abre la cámara del móvil</p>
                </div>
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageSelect(f);
                }}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-brand-border rounded-xl bg-white hover:border-brand-blue/40 hover:bg-brand-blue/5 transition text-center"
              >
                <Upload className="w-10 h-10 text-brand-muted" />
                <div>
                  <p className="font-semibold text-brand-text">Subir imagen</p>
                  <p className="text-xs text-brand-muted mt-1">JPEG, PNG o WEBP · máx. 10 MB</p>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageSelect(f);
                }}
              />
            </div>
          )}

          {/* Image + results grid */}
          {imagePreview && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left: image preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-brand-text truncate">
                    {imageFile?.name || "Imagen seleccionada"}
                  </p>
                  <button
                    onClick={resetScan}
                    className="text-sm text-brand-muted hover:text-brand-danger flex items-center gap-1 shrink-0 ml-3"
                  >
                    <X className="w-4 h-4" /> Cambiar
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Documento a analizar"
                  className="w-full rounded-xl border border-brand-border shadow-sm object-contain max-h-80 bg-brand-gray"
                />
                {!ocrResult && (
                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="w-full bg-brand-blue text-white font-semibold py-3 rounded-xl hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {scanning ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Analizando con IA...</>
                    ) : (
                      <><Sparkles className="w-5 h-5" /> Analizar con IA</>
                    )}
                  </button>
                )}
              </div>

              {/* Right: OCR results */}
              <div className="space-y-4">
                {scanError && (
                  <div className="bg-brand-danger/10 border border-brand-danger/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-brand-danger shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-brand-danger">Error en el análisis</p>
                      <p className="text-xs text-brand-danger/80 mt-1">{scanError}</p>
                    </div>
                  </div>
                )}

                {scanning && (
                  <div className="bg-white rounded-xl border border-brand-border p-10 flex flex-col items-center gap-3 text-center">
                    <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
                    <p className="text-sm font-medium text-brand-text">Analizando el documento...</p>
                    <p className="text-xs text-brand-muted">La IA está leyendo fecha, importe e IVA</p>
                  </div>
                )}

                {ocrResult && !scanning && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-brand-text flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-brand-blue" />
                        Datos extraídos — revisa y corrige si hace falta
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                        ocrResult.confidence >= 0.85
                          ? "bg-brand-success/10 text-brand-success"
                          : ocrResult.confidence >= 0.6
                          ? "bg-brand-warning/10 text-brand-warning"
                          : "bg-brand-danger/10 text-brand-danger"
                      }`}>
                        {Math.round(ocrResult.confidence * 100)}% confianza
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-brand-border shadow-sm divide-y divide-brand-border/50 text-sm">
                      {/* Date */}
                      <div className="flex items-center px-4 py-3 gap-4">
                        <span className="text-xs text-brand-muted w-24 shrink-0">Fecha</span>
                        <input
                          type="date"
                          value={editableOcr.date || ""}
                          onChange={(e) => setEditableOcr((p) => ({ ...p, date: e.target.value }))}
                          className="flex-1 text-brand-text bg-transparent border-b border-brand-border/50 focus:border-brand-blue outline-none py-0.5"
                        />
                      </div>
                      {/* Vendor */}
                      <div className="flex items-center px-4 py-3 gap-4">
                        <span className="text-xs text-brand-muted w-24 shrink-0">Proveedor</span>
                        <input
                          type="text"
                          value={editableOcr.vendor || ""}
                          onChange={(e) => setEditableOcr((p) => ({ ...p, vendor: e.target.value }))}
                          placeholder="Nombre del proveedor"
                          className="flex-1 text-brand-text bg-transparent border-b border-brand-border/50 focus:border-brand-blue outline-none py-0.5"
                        />
                      </div>
                      {/* Description */}
                      <div className="flex items-center px-4 py-3 gap-4">
                        <span className="text-xs text-brand-muted w-24 shrink-0">Concepto</span>
                        <input
                          type="text"
                          value={editableOcr.description || ""}
                          onChange={(e) => setEditableOcr((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Descripción del gasto"
                          className="flex-1 text-brand-text bg-transparent border-b border-brand-border/50 focus:border-brand-blue outline-none py-0.5"
                        />
                      </div>
                      {/* Total */}
                      <div className="flex items-center px-4 py-3 gap-4">
                        <span className="text-xs text-brand-muted w-24 shrink-0">Total (€)</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editableOcr.total ?? ""}
                          onChange={(e) => setEditableOcr((p) => ({ ...p, total: parseFloat(e.target.value) || null }))}
                          placeholder="0.00"
                          className="flex-1 text-brand-text bg-transparent border-b border-brand-border/50 focus:border-brand-blue outline-none py-0.5"
                        />
                      </div>
                      {/* IVA */}
                      <div className="flex items-center px-4 py-3 gap-4">
                        <span className="text-xs text-brand-muted w-24 shrink-0">IVA (%)</span>
                        <select
                          value={editableOcr.iva_rate ?? 21}
                          onChange={(e) => setEditableOcr((p) => ({ ...p, iva_rate: parseInt(e.target.value) }))}
                          className="flex-1 text-brand-text bg-transparent border-b border-brand-border/50 focus:border-brand-blue outline-none py-0.5"
                        >
                          <option value={0}>0%</option>
                          <option value={4}>4%</option>
                          <option value={10}>10%</option>
                          <option value={21}>21%</option>
                        </select>
                      </div>
                      {/* Type */}
                      <div className="flex items-center px-4 py-3 gap-4">
                        <span className="text-xs text-brand-muted w-24 shrink-0">Tipo</span>
                        <select
                          value={editableOcr.type ?? "gasto"}
                          onChange={(e) => setEditableOcr((p) => ({ ...p, type: e.target.value as "ingreso" | "gasto" }))}
                          className="flex-1 text-brand-text bg-transparent border-b border-brand-border/50 focus:border-brand-blue outline-none py-0.5"
                        >
                          <option value="gasto">Gasto</option>
                          <option value="ingreso">Ingreso</option>
                        </select>
                      </div>
                      {/* Category */}
                      <div className="flex items-center px-4 py-3 gap-4">
                        <span className="text-xs text-brand-muted w-24 shrink-0">Categoría</span>
                        <select
                          value={editableOcr.category || "otros"}
                          onChange={(e) => setEditableOcr((p) => ({ ...p, category: e.target.value }))}
                          className="flex-1 text-brand-text bg-transparent border-b border-brand-border/50 focus:border-brand-blue outline-none py-0.5"
                        >
                          {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                      {/* Deductible */}
                      <div className="flex items-center px-4 py-3 gap-4">
                        <span className="text-xs text-brand-muted w-24 shrink-0">Deducible</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          editableOcr.deductible
                            ? "bg-brand-success/10 text-brand-success"
                            : "bg-brand-muted/10 text-brand-muted"
                        }`}>
                          {editableOcr.deductible ? "Sí, deducible" : "No deducible"}
                        </span>
                      </div>
                    </div>

                    {ocrResult.notes && (
                      <p className="text-xs text-brand-muted bg-brand-gray rounded-lg px-3 py-2">
                        <span className="font-medium">Nota IA:</span> {ocrResult.notes}
                      </p>
                    )}

                    {saveOcrResult === "ok" && (
                      <div className="bg-brand-success/10 border border-brand-success/20 rounded-xl p-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-brand-success" />
                        <p className="text-sm font-medium text-brand-success">
                          Transacción guardada correctamente
                        </p>
                      </div>
                    )}
                    {saveOcrResult === "error" && (
                      <div className="bg-brand-danger/10 border border-brand-danger/20 rounded-xl p-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-brand-danger" />
                        <p className="text-sm font-medium text-brand-danger">
                          Error al guardar — revisa los datos
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {saveOcrResult !== "ok" && (
                        <button
                          onClick={handleSaveOcr}
                          disabled={savingOcr}
                          className="flex-1 bg-brand-blue text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
                        >
                          {savingOcr ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                          ) : (
                            <><Save className="w-4 h-4" /> Guardar transacción</>
                          )}
                        </button>
                      )}
                      <button
                        onClick={resetScan}
                        className="px-4 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:text-brand-text text-sm transition"
                      >
                        {saveOcrResult === "ok" ? "Analizar otro" : "Cancelar"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
