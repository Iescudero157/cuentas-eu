/**
 * Server-side invoice PDF generator using @react-pdf/renderer.
 * This module runs in Node.js (API routes) only — do NOT import in client components.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

export interface InvoicePDFServerItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePDFServerData {
  number: string;
  clientName: string;
  clientNif?: string | null;
  clientAddress?: string | null;
  date: string;
  dueDate?: string | null;
  status: string;
  items: InvoicePDFServerItem[];
  subtotal: number;
  iva: number;
  ivaRate: number;
  irpf: number;
  irpfRate: number;
  total: number;
  issuerName: string;
  issuerNif?: string | null;
  issuerAddress?: string | null;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a2e",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#2A5AAE",
  },
  brandName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#2A5AAE",
  },
  invoiceLabel: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#2A5AAE",
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 11,
    color: "#666",
    textAlign: "right",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  twoCol: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 24,
  },
  col: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 4,
  },
  colLabel: { fontSize: 8, color: "#999", marginBottom: 2 },
  colValue: { fontSize: 10, color: "#1a1a2e" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2A5AAE",
    padding: "8 12",
    borderRadius: 4,
    marginBottom: 4,
  },
  tableHeaderText: { color: "#fff", fontSize: 9, fontFamily: "Helvetica-Bold" },
  tableRow: {
    flexDirection: "row",
    padding: "7 12",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tableRowAlt: { backgroundColor: "#f8fafc" },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "center" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  totalsBox: { marginTop: 16, marginLeft: "auto", width: 200 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { fontSize: 10, color: "#666" },
  totalValue: { fontSize: 10, color: "#1a1a2e", fontFamily: "Helvetica-Bold" },
  totalFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#2A5AAE",
    borderRadius: 4,
    marginTop: 6,
  },
  totalFinalLabel: { fontSize: 12, color: "#fff", fontFamily: "Helvetica-Bold" },
  totalFinalValue: { fontSize: 12, color: "#fff", fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 8, color: "#aaa" },
});

function InvoiceDocument({ data }: { data: InvoicePDFServerData }) {
  const statusColor =
    data.status === "cobrada" ? "#4ECB71" : data.status === "vencida" ? "#ef4444" : "#f59e0b";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>KUENTAS.EU</Text>
            <Text style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{data.issuerName}</Text>
            {data.issuerNif && (
              <Text style={{ fontSize: 9, color: "#999" }}>NIF: {data.issuerNif}</Text>
            )}
            {data.issuerAddress && (
              <Text style={{ fontSize: 9, color: "#999" }}>{data.issuerAddress}</Text>
            )}
          </View>
          <View>
            <Text style={styles.invoiceLabel}>FACTURA</Text>
            <Text style={styles.invoiceNumber}>{data.number}</Text>
            <Text style={{ fontSize: 9, color: "#999", textAlign: "right", marginTop: 2 }}>
              Fecha: {data.date}
            </Text>
            {data.dueDate && (
              <Text style={{ fontSize: 9, color: "#999", textAlign: "right" }}>
                Vence: {data.dueDate}
              </Text>
            )}
          </View>
        </View>

        {/* Issuer & Client */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Facturar a</Text>
            <Text style={{ ...styles.colValue, fontFamily: "Helvetica-Bold" }}>
              {data.clientName}
            </Text>
            {data.clientNif && (
              <Text style={styles.colLabel}>NIF/CIF: {data.clientNif}</Text>
            )}
            {data.clientAddress && (
              <Text style={styles.colLabel}>{data.clientAddress}</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Estado</Text>
            <Text
              style={{ ...styles.colValue, fontFamily: "Helvetica-Bold", color: statusColor }}
            >
              {data.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.tableHeader}>
          <Text style={{ ...styles.tableHeaderText, ...styles.colDesc }}>Concepto</Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colQty }}>Uds.</Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colPrice }}>Precio unit.</Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colTotal }}>Total</Text>
        </View>

        {(data.items || []).map((item, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={{ ...styles.colDesc, fontSize: 10 }}>{item.description}</Text>
            <Text style={{ ...styles.colQty, fontSize: 10 }}>{item.quantity}</Text>
            <Text style={{ ...styles.colPrice, fontSize: 10 }}>
              {Number(item.unitPrice).toFixed(2)} EUR
            </Text>
            <Text style={{ ...styles.colTotal, fontSize: 10, fontFamily: "Helvetica-Bold" }}>
              {Number(item.total).toFixed(2)} EUR
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{Number(data.subtotal).toFixed(2)} EUR</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA ({data.ivaRate}%)</Text>
            <Text style={styles.totalValue}>+{Number(data.iva).toFixed(2)} EUR</Text>
          </View>
          {data.irpfRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IRPF (-{data.irpfRate}%)</Text>
              <Text style={{ ...styles.totalValue, color: "#ef4444" }}>
                -{Number(data.irpf).toFixed(2)} EUR
              </Text>
            </View>
          )}
          <View style={styles.totalFinalRow}>
            <Text style={styles.totalFinalLabel}>TOTAL</Text>
            <Text style={styles.totalFinalValue}>{Number(data.total).toFixed(2)} EUR</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            KUENTAS.EU - Gestion financiera con IA para autonomos
          </Text>
          <Text style={styles.footerText}>kuentas.eu</Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Generates a PDF buffer for an invoice. Safe to call from Node.js API routes.
 */
export async function generateInvoicePDFBuffer(data: InvoicePDFServerData): Promise<Buffer> {
  const instance = pdf(<InvoiceDocument data={data} />);
  const result = await instance.toBuffer();
  // react-pdf v4 toBuffer() returns Uint8Array; convert to Buffer via ArrayBuffer overload
  if (result instanceof Uint8Array) {
    return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
  }
  return result as unknown as Buffer;
}
