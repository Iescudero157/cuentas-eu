"use client";

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer";
import type { Invoice } from "@/lib/types";
import { Download } from "lucide-react";

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
  colLabel: {
    fontSize: 8,
    color: "#999",
    marginBottom: 2,
  },
  colValue: {
    fontSize: 10,
    color: "#1a1a2e",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2A5AAE",
    padding: "8 12",
    borderRadius: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    padding: "7 12",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "center" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  totalsBox: {
    marginTop: 16,
    marginLeft: "auto",
    width: 200,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 10,
    color: "#666",
  },
  totalValue: {
    fontSize: 10,
    color: "#1a1a2e",
    fontFamily: "Helvetica-Bold",
  },
  totalFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#2A5AAE",
    borderRadius: 4,
    marginTop: 6,
  },
  totalFinalLabel: {
    fontSize: 12,
    color: "#fff",
    fontFamily: "Helvetica-Bold",
  },
  totalFinalValue: {
    fontSize: 12,
    color: "#fff",
    fontFamily: "Helvetica-Bold",
  },
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
  footerText: {
    fontSize: 8,
    color: "#aaa",
  },
});

interface InvoiceDocProps {
  invoice: Invoice;
  issuerName: string;
  issuerNif: string;
  issuerAddress: string;
}

function InvoiceDoc({ invoice, issuerName, issuerNif, issuerAddress }: InvoiceDocProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>KUENTAS.EU</Text>
            <Text style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{issuerName}</Text>
            <Text style={{ fontSize: 9, color: "#999" }}>NIF: {issuerNif}</Text>
            <Text style={{ fontSize: 9, color: "#999" }}>{issuerAddress}</Text>
          </View>
          <View>
            <Text style={styles.invoiceLabel}>FACTURA</Text>
            <Text style={styles.invoiceNumber}>{invoice.number}</Text>
            <Text style={{ fontSize: 9, color: "#999", textAlign: "right", marginTop: 2 }}>
              Fecha: {invoice.date}
            </Text>
            <Text style={{ fontSize: 9, color: "#999", textAlign: "right" }}>
              Vence: {invoice.dueDate}
            </Text>
          </View>
        </View>

        {/* Issuer & Client */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Facturar a</Text>
            <Text style={{ ...styles.colValue, fontFamily: "Helvetica-Bold" }}>{invoice.clientName}</Text>
            <Text style={styles.colLabel}>NIF/CIF: {invoice.clientNif}</Text>
            <Text style={styles.colLabel}>{invoice.clientAddress}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Estado</Text>
            <Text style={{ ...styles.colValue, fontFamily: "Helvetica-Bold", color: invoice.status === "cobrada" ? "#4ECB71" : invoice.status === "vencida" ? "#ef4444" : "#f59e0b" }}>
              {invoice.status.toUpperCase()}
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

        {invoice.items.map((item, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={{ ...styles.colDesc, fontSize: 10 }}>{item.description}</Text>
            <Text style={{ ...styles.colQty, fontSize: 10 }}>{item.quantity}</Text>
            <Text style={{ ...styles.colPrice, fontSize: 10 }}>
              {item.unitPrice.toFixed(2)} EUR
            </Text>
            <Text style={{ ...styles.colTotal, fontSize: 10, fontFamily: "Helvetica-Bold" }}>
              {item.total.toFixed(2)} EUR
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{invoice.subtotal.toFixed(2)} EUR</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA ({invoice.ivaRate}%)</Text>
            <Text style={styles.totalValue}>+{invoice.iva.toFixed(2)} EUR</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IRPF (-{invoice.irpfRate}%)</Text>
            <Text style={{ ...styles.totalValue, color: "#ef4444" }}>-{invoice.irpf.toFixed(2)} EUR</Text>
          </View>
          <View style={styles.totalFinalRow}>
            <Text style={styles.totalFinalLabel}>TOTAL</Text>
            <Text style={styles.totalFinalValue}>{invoice.total.toFixed(2)} EUR</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>KUENTAS.EU - Gestion financiera con IA para autonomos</Text>
          <Text style={styles.footerText}>kuentas.eu</Text>
        </View>
      </Page>
    </Document>
  );
}

interface InvoicePDFButtonProps {
  invoice: Invoice;
  issuerName?: string;
  issuerNif?: string;
  issuerAddress?: string;
}

export default function InvoicePDFButton({
  invoice,
  issuerName = "Autonomo Demo",
  issuerNif = "12345678A",
  issuerAddress = "Madrid, Espana",
}: InvoicePDFButtonProps) {
  return (
    <PDFDownloadLink
      document={
        <InvoiceDoc
          invoice={invoice}
          issuerName={issuerName}
          issuerNif={issuerNif}
          issuerAddress={issuerAddress}
        />
      }
      fileName={`${invoice.number}.pdf`}
    >
      {({ loading: pdfLoading }) => (
        <button
          className="flex items-center gap-2 border border-brand-blue text-brand-blue font-semibold px-4 py-2.5 rounded-lg hover:bg-brand-blue/5 transition text-sm disabled:opacity-50"
          disabled={pdfLoading}
        >
          <Download className="w-4 h-4" />
          {pdfLoading ? "Generando PDF..." : "Descargar PDF"}
        </button>
      )}
    </PDFDownloadLink>
  );
}
