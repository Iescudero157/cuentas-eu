/**
 * V19 · PDF de la declaración responsable del SIF (art. 13 RD 1007/2023 y
 * art. 15 Orden HAC/1177/2024), generado en servidor con @react-pdf/renderer
 * a partir de la fuente única lib/verifactu/declaracion-responsable.ts.
 * Mientras la declaración sea borrador, cada página lleva un aviso fijo y el
 * documento no debe entregarse a clientes.
 * Server-only (API routes) — do NOT import in client components.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { DeclaracionResponsable } from "../verifactu/declaracion-responsable.ts";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    paddingBottom: 64,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a2e",
    lineHeight: 1.5,
  },
  borradorBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
  },
  borradorTexto: {
    color: "#dc2626",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textAlign: "center",
  },
  titulo: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitulo: {
    fontSize: 9,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  apartadoTitulo: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#2A5AAE",
    marginTop: 14,
    marginBottom: 4,
  },
  parrafo: {
    marginBottom: 6,
    textAlign: "justify",
  },
  pendiente: {
    color: "#b45309",
  },
  pie: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#666",
    textAlign: "center",
  },
});

const AVISO =
  "BORRADOR PENDIENTE DE REVISIÓN (IVAN/ASESOR) — DOCUMENTO NO SUSCRITO. NO ENTREGAR A CLIENTES NI PUBLICAR";

function DeclaracionPDF({ d }: { d: DeclaracionResponsable }) {
  return (
    <Document
      title={`Declaración responsable ${d.sistema.nombre} v${d.sistema.version}${d.esBorrador ? " (BORRADOR)" : ""}`}
      author={d.productor.razonSocial}
    >
      <Page size="A4" style={styles.page}>
        {d.esBorrador && (
          <View style={styles.borradorBanner} fixed>
            <Text style={styles.borradorTexto}>{AVISO}</Text>
          </View>
        )}
        <Text style={styles.titulo}>{d.titulo}</Text>
        <Text style={styles.subtitulo}>
          {d.sistema.nombre} · versión {d.sistema.version} · {d.productor.razonSocial} ({d.productor.nif})
        </Text>
        {d.apartados.map((ap) => (
          <View key={ap.letra} wrap={false}>
            <Text style={styles.apartadoTitulo}>
              {ap.letra}) {ap.titulo}
            </Text>
            {ap.parrafos.map((p, i) => (
              <Text
                key={i}
                style={
                  ap.pendienteRevision ? [styles.parrafo, styles.pendiente] : styles.parrafo
                }
              >
                {p}
              </Text>
            ))}
          </View>
        ))}
        <Text style={[styles.parrafo, { marginTop: 16 }]}>
          Declaración formulada conforme al artículo 13 del Real Decreto 1007/2023, de 5 de
          diciembre, y al artículo 15 de la Orden HAC/1177/2024, de 17 de octubre.
        </Text>
        <Text
          style={styles.pie}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${d.sistema.nombre} · Declaración responsable v${d.sistema.version} — pág. ${pageNumber}/${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

/** Genera el PDF de la declaración responsable como Buffer (Node). */
export async function generateDeclaracionPDFBuffer(
  d: DeclaracionResponsable
): Promise<Buffer> {
  const instance = pdf(<DeclaracionPDF d={d} />);
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
