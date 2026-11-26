// Mapper compartido (V08): fila de `invoices` + perfil del emisor →
// datos de la plantilla PDF de servidor. Lo usan la ruta de email y la
// ruta de descarga de PDF para no duplicar la conversión.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { BloqueQRFactura } from "../verifactu/qr.ts";
import {
  esCausaExencionIva,
  esRectificativa,
  mencionExencion,
  tipoFacturaDeDocumento,
  tituloDocumento,
} from "../verifactu/factura-fiscal.ts";
import type { InvoicePDFServerData } from "./invoice-pdf-server";

/** Columnas de `invoices` que consume el PDF (select * las cubre). */
export interface InvoiceRowForPDF {
  number: string;
  client_name: string | null;
  client_nif: string | null;
  client_address: string | null;
  date: string;
  due_date: string | null;
  status: string | null;
  items: InvoicePDFServerData["items"] | null;
  subtotal: number;
  iva: number;
  iva_rate: number;
  irpf: number;
  irpf_rate: number;
  total: number;
  /** Tipo con el que se registró (F1, F2, R1…): decide el título del documento. */
  tipo_factura?: string | null;
  verifactu_estado?: string | null;
  /** Causa de exención (lista L10) y detalle del precepto: mención del art. 6.1.j RD 1619/2012. */
  operacion_exenta?: string | null;
  fecha_operacion?: string | null;
  exencion_detalle?: string | null;
  rectifica_invoice_id?: string | null;
}

export interface IssuerProfileForPDF {
  name?: string | null;
  nif?: string | null;
  address?: string | null;
}

/** Datos identificativos de la factura rectificada (art. 15.4 RD 1619/2012). */
export interface RectificadaForPDF {
  numero: string;
  /** `aaaa-mm-dd`. */
  fecha: string;
}

/**
 * Lee la factura que rectifica `invoice` (si es una rectificativa) para poder
 * imprimir su número y fecha en el PDF. Devuelve null si no es rectificativa.
 */
export async function rectificadaParaPDF(
  supabase: SupabaseClient,
  userId: string,
  invoice: { rectifica_invoice_id?: string | null }
): Promise<RectificadaForPDF | null> {
  if (!invoice.rectifica_invoice_id) return null;
  const { data } = await supabase
    .from("invoices")
    .select("number, numero_fiscal, date")
    .eq("id", invoice.rectifica_invoice_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    numero: (data.numero_fiscal as string | null) ?? (data.number as string),
    fecha: String(data.date).slice(0, 10),
  };
}

export function invoicePDFDataFromRow(
  invoice: InvoiceRowForPDF,
  profile: IssuerProfileForPDF | null,
  verifactu: BloqueQRFactura | null = null,
  rectificada: RectificadaForPDF | null = null
): InvoicePDFServerData {
  const tipo = tipoFacturaDeDocumento(invoice);
  return {
    number: invoice.number,
    clientName: invoice.client_name ?? "",
    clientNif: invoice.client_nif,
    clientAddress: invoice.client_address,
    date: invoice.date,
    dueDate: invoice.due_date,
    status: invoice.status || "pendiente",
    items: invoice.items || [],
    subtotal: Number(invoice.subtotal),
    iva: Number(invoice.iva),
    ivaRate: Number(invoice.iva_rate),
    irpf: Number(invoice.irpf),
    irpfRate: Number(invoice.irpf_rate),
    total: Number(invoice.total),
    issuerName: profile?.name || "KUENTAS.EU",
    issuerNif: profile?.nif,
    issuerAddress: profile?.address,
    verifactu,
    titulo: tituloDocumento(tipo),
    mencionExencion: esCausaExencionIva(invoice.operacion_exenta)
      ? mencionExencion(invoice.operacion_exenta, invoice.exencion_detalle)
      : null,
    rectifica: esRectificativa(tipo) || invoice.rectifica_invoice_id ? rectificada : null,
    anulada: invoice.verifactu_estado === "anulada",
    fechaOperacion: invoice.fecha_operacion ?? null,
  };
}
