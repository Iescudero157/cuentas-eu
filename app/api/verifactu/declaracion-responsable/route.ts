import { NextResponse } from "next/server";
import {
  declaracionResponsableKuentas,
} from "@/lib/verifactu/declaracion-responsable";
import { generateDeclaracionPDFBuffer } from "@/lib/pdf/declaracion-responsable-pdf-server";

// V19: descarga en PDF de la declaración responsable del SIF. Es un documento
// PÚBLICO por naturaleza (debe estar disponible para el cliente y el
// comercializador en el momento de la adquisición y a solicitud de la
// Administración, art. 13.2-13.3 RD 1007/2023), así que no exige sesión.
// Mientras sea borrador, el PDF sale marcado como tal en cada página.
export async function GET() {
  const declaracion = declaracionResponsableKuentas();
  const pdfBuffer = await generateDeclaracionPDFBuffer(declaracion);
  const nombre = `declaracion-responsable-kuentas-v${declaracion.sistema.version}${
    declaracion.esBorrador ? "-BORRADOR" : ""
  }.pdf`;
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      // El contenido solo cambia con cada versión del SIF desplegada.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
