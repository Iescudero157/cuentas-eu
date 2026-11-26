/**
 * Server-side invoice PDF generator using @react-pdf/renderer.
 * This module runs in Node.js (API routes) only — do NOT import in client components.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, pdf } from "@react-pdf/renderer";
import type { MarcaFactura } from "./marca-factura.ts";
import { formatearEuros } from "./marca-factura.ts";
import type { BloqueQRFactura } from "../verifactu/qr.ts";

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
  /**
   * Bloque QR tributario + leyenda (V08, arts. 20-21 Orden HAC/1177/2024).
   * Solo presente en facturas emitidas bajo Verifactu; se construye en el
   * servidor con `construirBloqueQR` (lib/verifactu/qr.ts).
   */
  verifactu?: BloqueQRFactura | null;
  /**
   * Título del documento según el tipo de factura: «FACTURA», «FACTURA
   * SIMPLIFICADA», «FACTURA RECTIFICATIVA» o «FACTURA SIMPLIFICADA
   * RECTIFICATIVA» (lib/verifactu/factura-fiscal.ts). Por defecto, «FACTURA».
   */
  titulo?: string;
  /** Mención de exención del IVA con su artículo (art. 6.1.j y 7.1.i RD 1619/2012). */
  mencionExencion?: string | null;
  /** Factura rectificada: número y fecha (`aaaa-mm-dd`), art. 15.4 RD 1619/2012. */
  rectifica?: { numero: string; fecha: string } | null;
  /** La factura tiene registro de anulación: el documento lo dice de forma destacada. */
  anulada?: boolean;
  /** Fecha de la operación si es distinta de la de expedición (art. 6.1.k RD 1619/2012), `aaaa-mm-dd`. */
  fechaOperacion?: string | null;
  /** Modelo de factura de la cuenta (logo, colores y pie). Sin él, diseño de Kuentas. */
  marca?: MarcaFactura | null;
  /** Forma de pago legible (plantilla con marca). */
  formaPago?: string | null;
  /** Notas de la factura que se imprimen (sin marcas internas). */
  notas?: string | null;
}

function fechaLegible(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// Lado del QR impreso: 35 mm (rango legal 30-40 mm, art. 21 Orden). 1 mm = 72/25.4 pt.
const QR_LADO_PT = (35 * 72) / 25.4;

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
  // QR tributario (V08): al principio de la factura, antes del contenido,
  // centrado, con zona en blanco alrededor (fondo blanco de la página) y
  // textos con tamaño ≥ al del resto de datos de la factura (doc. QR AEAT §3).
  qrBloque: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 17, // ≥6 mm de zona en blanco recomendada sobre y bajo el QR
    marginBottom: 8,
  },
  qrTitulo: { fontSize: 10, color: "#1a1a2e", marginBottom: 6 },
  qrImagen: { width: QR_LADO_PT, height: QR_LADO_PT },
  qrLeyenda: {
    fontSize: 10,
    color: "#1a1a2e",
    marginTop: 6,
    textAlign: "center",
  },
  qrMarca: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    marginTop: 2,
    textAlign: "center",
  },
  // Título largo («FACTURA SIMPLIFICADA RECTIFICATIVA»): cuerpo menor para que quepa.
  invoiceLabelLargo: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#2A5AAE",
    textAlign: "right",
    maxWidth: 260,
  },
  rectificaTexto: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    textAlign: "right",
    marginTop: 4,
    maxWidth: 260,
  },
  anuladaBanda: {
    borderWidth: 1.5,
    borderColor: "#ef4444",
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  anuladaTexto: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#ef4444",
    textAlign: "center",
  },
  mencionCaja: {
    marginTop: 14,
    padding: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  mencionTexto: { fontSize: 9, color: "#1a1a2e", lineHeight: 1.35 },
});

function InvoiceDocument({ data }: { data: InvoicePDFServerData }) {
  const statusColor =
    data.anulada || data.status === "vencida"
      ? "#ef4444"
      : data.status === "cobrada"
        ? "#4ECB71"
        : "#f59e0b";
  const titulo = data.titulo || "FACTURA";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* QR tributario + leyenda VERI*FACTU: SIEMPRE antes del contenido de la
            factura y solo en la primera página (arts. 20-21 Orden HAC/1177/2024) */}
        {data.verifactu && (
          <View style={styles.qrBloque}>
            <Text style={styles.qrTitulo}>{data.verifactu.titulo}</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf, no acepta alt */}
            <Image style={styles.qrImagen} src={data.verifactu.qrPngDataUrl} />
            {data.verifactu.leyenda && (
              <Text style={styles.qrLeyenda}>{data.verifactu.leyenda}</Text>
            )}
            {data.verifactu.marca && <Text style={styles.qrMarca}>{data.verifactu.marca}</Text>}
          </View>
        )}

        {/* Factura anulada: el documento no puede pasar por una factura en vigor */}
        {data.anulada && (
          <View style={styles.anuladaBanda}>
            <Text style={styles.anuladaTexto}>
              FACTURA ANULADA - sin validez (registro de anulación, art. 11 RD 1007/2023)
            </Text>
          </View>
        )}

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
            <Text style={titulo.length > 14 ? styles.invoiceLabelLargo : styles.invoiceLabel}>
              {titulo}
            </Text>
            <Text style={styles.invoiceNumber}>{data.number}</Text>
            {/* Datos identificativos de la factura rectificada (art. 15.4 y 7.1.h RD 1619/2012) */}
            {data.rectifica && (
              <Text style={styles.rectificaTexto}>
                Rectifica a la factura {data.rectifica.numero} de {fechaLegible(data.rectifica.fecha)}
              </Text>
            )}
            <Text style={{ fontSize: 9, color: "#999", textAlign: "right", marginTop: 2 }}>
              Fecha: {data.date}
            </Text>
            {data.fechaOperacion && (
              <Text style={{ fontSize: 9, color: "#999", textAlign: "right" }}>
                Fecha de la operación: {fechaLegible(data.fechaOperacion)}
              </Text>
            )}
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
              {data.anulada ? "ANULADA" : data.status.toUpperCase()}
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
              {formatearEuros(item.unitPrice)}
            </Text>
            <Text style={{ ...styles.colTotal, fontSize: 10, fontFamily: "Helvetica-Bold" }}>
              {formatearEuros(item.total)}
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatearEuros(data.subtotal)}</Text>
          </View>
          {data.mencionExencion ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IVA</Text>
              <Text style={styles.totalValue}>Exento</Text>
            </View>
          ) : (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IVA ({data.ivaRate}%)</Text>
              <Text style={styles.totalValue}>
                {Number(data.iva) < 0 ? "" : "+"}
                {formatearEuros(data.iva)}
              </Text>
            </View>
          )}
          {data.irpfRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IRPF (-{data.irpfRate}%)</Text>
              <Text style={{ ...styles.totalValue, color: "#ef4444" }}>
                {Number(data.irpf) < 0 ? "+" : "-"}
                {formatearEuros(Math.abs(Number(data.irpf)))}
              </Text>
            </View>
          )}
          <View style={styles.totalFinalRow}>
            <Text style={styles.totalFinalLabel}>TOTAL</Text>
            <Text style={styles.totalFinalValue}>{formatearEuros(data.total)}</Text>
          </View>
        </View>

        {/* Mención de exención (art. 6.1.j y 7.1.i RD 1619/2012) */}
        {data.mencionExencion && (
          <View style={styles.mencionCaja}>
            <Text style={styles.mencionTexto}>{data.mencionExencion}</Text>
          </View>
        )}

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

// ---------------------------------------------------------------------------
// Plantilla con el modelo de factura de la cuenta (26-nov-2026): logo, colores y pie de `profiles.factura_marca`.
// Disposición del modelo de MERCADONET: emisor con logo a la izquierda; «FACTURA» con fecha, número y fecha de
// la operación a la derecha; «Factura para:»; líneas; forma de pago y totales; notas; pie. El QR y la leyenda
// VERI*FACTU siguen yendo al principio de la primera página (arts. 20-21 Orden HAC/1177/2024).
// ---------------------------------------------------------------------------

const euros = formatearEuros;

function estilosMarca(m: MarcaFactura) {
  const principal = m.colorPrincipal || "#2A5AAE";
  const titulo = m.colorTitulo || principal;
  const suave = m.colorSuave || "#f5f5f2";
  return StyleSheet.create({
    page: { padding: 36, paddingBottom: 64, fontFamily: "Helvetica", fontSize: 9.5, color: "#1a1a1a", backgroundColor: "#ffffff" },
    cabecera: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
    emisor: { maxWidth: 270 },
    logo: { width: 170, height: 64, objectFit: "contain", objectPosition: "left", marginBottom: 6 },
    emisorNombre: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
    emisorDato: { fontSize: 9, color: "#333333", marginTop: 1 },
    titulo: { fontSize: 28, color: titulo, textAlign: "right", marginBottom: 8 },
    tituloLargo: { fontSize: 15, color: titulo, textAlign: "right", marginBottom: 8, maxWidth: 270 },
    datosFila: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginBottom: 2 },
    datosEtiqueta: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#333333", textAlign: "right", marginRight: 6 },
    datosValor: { fontSize: 8.5, borderWidth: 0.6, borderColor: "#9a9a9a", paddingVertical: 2, paddingHorizontal: 4, width: 104, textAlign: "center" },
    barra: { backgroundColor: principal, paddingVertical: 3.5, paddingHorizontal: 7 },
    barraTexto: { color: "#ffffff", fontSize: 8.5, fontFamily: "Helvetica-Bold" },
    cliente: { borderWidth: 0.6, borderColor: "#9a9a9a", padding: 8, marginTop: 5, marginBottom: 16, lineHeight: 1.4 },
    clienteNombre: { fontFamily: "Helvetica-Bold" },
    tablaCab: { flexDirection: "row", backgroundColor: principal, paddingVertical: 4, paddingHorizontal: 7 },
    tablaCabTexto: { color: "#ffffff", fontSize: 8.5, fontFamily: "Helvetica-Bold" },
    fila: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 7 },
    filaAlt: { backgroundColor: suave },
    cCant: { width: "10%", textAlign: "center" },
    cDesc: { width: "54%", paddingRight: 6 },
    cPrecio: { width: "18%", textAlign: "right" },
    cImporte: { width: "18%", textAlign: "right" },
    finTabla: { borderTopWidth: 0.8, borderTopColor: principal, marginTop: 2, marginBottom: 14 },
    inferior: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    pago: { width: "52%", borderWidth: 0.6, borderColor: "#9a9a9a", padding: 8, fontSize: 8.5, minHeight: 40 },
    totales: { width: "40%" },
    totalFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 7, backgroundColor: suave, marginBottom: 1 },
    totalEtiqueta: { fontFamily: "Helvetica-Bold", fontSize: 8.5 },
    totalValor: { fontSize: 8.5 },
    totalFinal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, paddingHorizontal: 7, backgroundColor: principal, marginTop: 2 },
    totalFinalTexto: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 10.5 },
    nota: { marginTop: 14, fontSize: 8, color: "#555555", fontFamily: "Helvetica-Oblique", lineHeight: 1.4 },
    pie: { position: "absolute", left: 36, right: 36, bottom: 26, fontSize: 7.5, color: "#6b6b6b", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#cccccc", paddingTop: 6 },
  });
}

function InvoiceDocumentMarca({ data, marca }: { data: InvoicePDFServerData; marca: MarcaFactura }) {
  const s = estilosMarca(marca);
  const titulo = data.titulo || "FACTURA";
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {data.verifactu && (
          <View style={styles.qrBloque}>
            <Text style={styles.qrTitulo}>{data.verifactu.titulo}</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf, no acepta alt */}
            <Image style={styles.qrImagen} src={data.verifactu.qrPngDataUrl} />
            {data.verifactu.leyenda && <Text style={styles.qrLeyenda}>{data.verifactu.leyenda}</Text>}
            {data.verifactu.marca && <Text style={styles.qrMarca}>{data.verifactu.marca}</Text>}
          </View>
        )}

        {data.anulada && (
          <View style={styles.anuladaBanda}>
            <Text style={styles.anuladaTexto}>
              FACTURA ANULADA - sin validez (registro de anulación, art. 11 RD 1007/2023)
            </Text>
          </View>
        )}

        <View style={s.cabecera}>
          <View style={s.emisor}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf, no acepta alt */}
            {marca.logo && <Image style={s.logo} src={marca.logo} />}
            <Text style={s.emisorNombre}>{data.issuerName}</Text>
            {data.issuerNif && <Text style={s.emisorDato}>NIF: {data.issuerNif}</Text>}
            {data.issuerAddress && <Text style={s.emisorDato}>{data.issuerAddress}</Text>}
          </View>
          <View>
            <Text style={titulo.length > 14 ? s.tituloLargo : s.titulo}>{titulo}</Text>
            <View style={s.datosFila}>
              <Text style={s.datosEtiqueta}>Fecha</Text>
              <Text style={s.datosValor}>{fechaLegible(data.date)}</Text>
            </View>
            <View style={s.datosFila}>
              <Text style={s.datosEtiqueta}>Factura nº</Text>
              <Text style={s.datosValor}>{data.number}</Text>
            </View>
            {data.fechaOperacion && (
              <View style={s.datosFila}>
                <Text style={s.datosEtiqueta}>Fecha de la operación</Text>
                <Text style={s.datosValor}>{fechaLegible(data.fechaOperacion)}</Text>
              </View>
            )}
            {data.rectifica && (
              <Text style={styles.rectificaTexto}>
                Rectifica a la factura {data.rectifica.numero} de {fechaLegible(data.rectifica.fecha)}
              </Text>
            )}
          </View>
        </View>

        <View style={s.barra}>
          <Text style={s.barraTexto}>Factura para:</Text>
        </View>
        <View style={s.cliente}>
          <Text style={s.clienteNombre}>{data.clientName}</Text>
          {data.clientNif && <Text>NIF: {data.clientNif}</Text>}
          {data.clientAddress && <Text>Dirección: {data.clientAddress}</Text>}
        </View>

        <View style={s.tablaCab}>
          <Text style={{ ...s.tablaCabTexto, ...s.cCant }}>Cantidad</Text>
          <Text style={{ ...s.tablaCabTexto, ...s.cDesc }}>Descripción</Text>
          <Text style={{ ...s.tablaCabTexto, ...s.cPrecio }}>Precio unitario</Text>
          <Text style={{ ...s.tablaCabTexto, ...s.cImporte }}>Importe</Text>
        </View>
        {(data.items || []).map((item, idx) => (
          <View key={idx} style={[s.fila, idx % 2 === 1 ? s.filaAlt : {}]} wrap={false}>
            <Text style={s.cCant}>{item.quantity}</Text>
            <Text style={s.cDesc}>{item.description}</Text>
            <Text style={s.cPrecio}>{euros(item.unitPrice)}</Text>
            <Text style={s.cImporte}>{euros(item.total)}</Text>
          </View>
        ))}
        <View style={s.finTabla} />

        <View style={s.inferior} wrap={false}>
          <View style={s.pago}>
            <Text>{data.formaPago ? `Forma de pago: ${data.formaPago}` : " "}</Text>
          </View>
          <View style={s.totales}>
            <View style={s.totalFila}>
              <Text style={s.totalEtiqueta}>Subtotal</Text>
              <Text style={s.totalValor}>{euros(data.subtotal)}</Text>
            </View>
            <View style={s.totalFila}>
              <Text style={s.totalEtiqueta}>{data.mencionExencion ? "IVA" : `IVA ${data.ivaRate} %`}</Text>
              <Text style={s.totalValor}>{data.mencionExencion ? "Exento" : euros(data.iva)}</Text>
            </View>
            {data.irpfRate > 0 && (
              <View style={s.totalFila}>
                <Text style={s.totalEtiqueta}>IRPF {data.irpfRate} %</Text>
                <Text style={s.totalValor}>-{euros(Math.abs(Number(data.irpf)))}</Text>
              </View>
            )}
            <View style={s.totalFinal}>
              <Text style={s.totalFinalTexto}>TOTAL</Text>
              <Text style={s.totalFinalTexto}>{euros(data.total)}</Text>
            </View>
          </View>
        </View>

        {data.mencionExencion && <Text style={s.nota}>{data.mencionExencion}</Text>}
        {data.notas && <Text style={s.nota}>{data.notas}</Text>}
        {marca.pie && (
          <Text style={s.pie} fixed>
            {marca.pie}
          </Text>
        )}
      </Page>
    </Document>
  );
}

/**
 * Generates a PDF buffer for an invoice. Safe to call from Node.js API routes.
 *
 * Note: @react-pdf/renderer v4 `toBuffer()` actually returns a NodeJS ReadableStream
 * (the method will be renamed `toStream()` in the next major version).
 * We read all chunks and concatenate them into a proper Buffer.
 */
export async function generateInvoicePDFBuffer(data: InvoicePDFServerData): Promise<Buffer> {
  const doc = data.marca ? <InvoiceDocumentMarca data={data} marca={data.marca} /> : <InvoiceDocument data={data} />;
  const instance = pdf(doc);
  // toBuffer() returns a ReadableStream in react-pdf v4, despite the name
  const stream = (await instance.toBuffer()) as unknown as NodeJS.ReadableStream;
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
