import { NextResponse } from "next/server";
import {
  declaracionResponsableKuentas,
} from "@/lib/verifactu/declaracion-responsable";
import { generateDeclaracionPDFBuffer } from "@/lib/pdf/declaracion-responsable-pdf-server";
import { claveIp, limitarTasa, respuesta429 } from "@/lib/verifactu/seguridad-http";

// V19: descarga en PDF de la declaración responsable del SIF. Es un documento
// PÚBLICO por naturaleza (debe estar disponible para el cliente y el
// comercializador en el momento de la adquisición y a solicitud de la
// Administración, art. 13.2-13.3 RD 1007/2023), así que no exige sesión.
// Mientras sea borrador, el PDF sale marcado como tal en cada página.
export async function GET(request: Request) {
  // V24: único endpoint público que hace trabajo de CPU (render del PDF en
  // cada petición no cacheada) — límite por IP, mejor esfuerzo.
  const tasa = limitarTasa(`declaracion-pdf:${claveIp(request)}`, 10, 60 * 1000);
  if (!tasa.permitido) return respuesta429(tasa);

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
