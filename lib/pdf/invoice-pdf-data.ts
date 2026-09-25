// Mapper compartido (V08): fila de `invoices` + perfil del emisor →
// datos de la plantilla PDF de servidor. Lo usan la ruta de email y la
// ruta de descarga de PDF para no duplicar la conversión.

import type { BloqueQRFactura } from "../verifactu/qr.ts";
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
}

export interface IssuerProfileForPDF {
  name?: string | null;
  nif?: string | null;
  address?: string | null;
}

export function invoicePDFDataFromRow(
  invoice: InvoiceRowForPDF,
  profile: IssuerProfileForPDF | null,
  verifactu: BloqueQRFactura | null = null
): InvoicePDFServerData {
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
  };
}
