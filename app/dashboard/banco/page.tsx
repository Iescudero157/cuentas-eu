"use client";

import Link from "next/link";
import { Info, Upload, ScanLine, ArrowRight } from "lucide-react";

// La conexión automática con el banco NO existe en KUENTAS.EU (no hay proveedor
// de agregación bancaria integrado). Esta página solo explica cómo incorporar los
// movimientos con las funciones que sí existen: importación CSV y escáner OCR.
export default function BancoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Banco</h1>
        <p className="text-brand-muted text-sm mt-1">
          Cómo incorporar los movimientos de tu cuenta bancaria a KUENTAS.EU
        </p>
      </div>

      <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-brand-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-brand-text">
            La conexión automática con el banco no está disponible
          </p>
          <p className="text-xs text-brand-muted mt-1 leading-relaxed">
            KUENTAS.EU no se conecta a tu banco ni te pide tus credenciales bancarias. Hoy los
            movimientos se incorporan importando el fichero CSV que descargas de tu banca online,
            escaneando tickets y facturas con la cámara o registrándolos a mano.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/importar"
          className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm hover:border-brand-blue/40 transition flex flex-col gap-3"
        >
          <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center">
            <Upload className="w-6 h-6 text-brand-blue" />
          </div>
          <div>
            <p className="font-semibold text-brand-text">Importar el CSV del banco</p>
            <p className="text-sm text-brand-muted mt-1 leading-relaxed">
              Columnas fecha, concepto e importe. Separadores admitidos: coma, punto y coma o
              tabulador. Revisas la vista previa antes de guardar.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue mt-auto">
            Ir a Importar <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link
          href="/dashboard/importar?tipo=gasto"
          className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm hover:border-brand-blue/40 transition flex flex-col gap-3"
        >
          <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center">
            <ScanLine className="w-6 h-6 text-brand-blue" />
          </div>
          <div>
            <p className="font-semibold text-brand-text">Escanear un ticket o factura</p>
            <p className="text-sm text-brand-muted mt-1 leading-relaxed">
              Saca una foto o sube el PDF: la IA extrae fecha, importe, IVA y categoría; tú revisas
              y guardas la transacción.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue mt-auto">
            Ir al escáner <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
