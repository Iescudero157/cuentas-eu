import Link from "next/link";
import { ArrowLeft, Download, TriangleAlert } from "lucide-react";
import {
  declaracionResponsableKuentas,
} from "@/lib/verifactu/declaracion-responsable";

// V19 · Declaración responsable del SIF, visible de manera legible dentro del
// propio sistema y accesible antes de la contratación (art. 13.2 RD 1007/2023
// y art. 15.3 Orden HAC/1177/2024). Página pública, misma fuente de datos que
// el bloque SistemaInformatico de los registros remitidos a la AEAT.

const declaracion = declaracionResponsableKuentas();

export const metadata = {
  title: `Declaración responsable Verifactu - KUENTAS.EU${declaracion.esBorrador ? " (borrador)" : ""}`,
  description:
    "Declaración responsable del sistema informático de facturación Kuentas (art. 13 RD 1007/2023 y art. 15 Orden HAC/1177/2024).",
  // Borrador: fuera de los índices hasta que Iván/asesor ratifiquen el texto.
  robots: declaracion.esBorrador ? { index: false, follow: false } : undefined,
};

export default function DeclaracionResponsablePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-blue transition mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        {declaracion.esBorrador && (
          <div className="flex items-start gap-3 border border-red-300 bg-red-50 text-red-700 rounded-xl px-4 py-3 mb-8">
            <TriangleAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold">
              BORRADOR PENDIENTE DE REVISIÓN (IVAN/ASESOR) — documento no suscrito. No entregar
              a clientes ni publicar hasta su ratificación.
            </p>
          </div>
        )}

        <h1 className="text-2xl sm:text-3xl font-bold text-brand-text mb-2">
          {declaracion.titulo}
        </h1>
        <p className="text-brand-muted mb-8">
          {declaracion.sistema.nombre} · versión {declaracion.sistema.version} ·{" "}
          {declaracion.productor.razonSocial} ({declaracion.productor.nif})
        </p>

        <a
          href="/api/verifactu/declaracion-responsable"
          className="inline-flex items-center gap-2 bg-brand-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition mb-10"
        >
          <Download className="w-4 h-4" /> Descargar en PDF
        </a>

        <div className="space-y-6 text-brand-text">
          {declaracion.apartados.map((ap) => (
            <section key={ap.letra}>
              <h2 className="text-lg font-bold mt-8 mb-3">
                {ap.letra}) {ap.titulo}
              </h2>
              {ap.parrafos.map((p, i) => (
                <p
                  key={i}
                  className={`leading-relaxed mb-2 ${
                    ap.pendienteRevision ? "text-amber-700" : "text-brand-muted"
                  }`}
                >
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <p className="text-sm text-brand-muted mt-12 pt-6 border-t border-brand-border/50">
          Declaración formulada conforme al artículo 13 del Real Decreto 1007/2023, de 5 de
          diciembre, y al artículo 15 de la Orden HAC/1177/2024, de 17 de octubre. Los datos
          identificativos del sistema coinciden con los remitidos a la AEAT en cada registro de
          facturación.
        </p>
      </div>
    </div>
  );
}
