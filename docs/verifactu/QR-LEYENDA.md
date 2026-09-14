# V08 — QR tributario y leyenda VERI*FACTU

Implementación de los arts. 20-21 de la Orden HAC/1177/2024 y del documento oficial AEAT
«Detalle de las especificaciones técnicas del código "QR" de la factura y de la "URL" del
servicio de cotejo o remisión de información por parte del receptor de la factura»
**v0.5.0 (10/12/2025)**, descargado de la sede AEAT
(`https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DetalleEspecificacTecnCodigoQRfactura.pdf`).

## Módulos

| Fichero | Qué hace |
|---|---|
| `lib/verifactu/qr.ts` | URL de cotejo (constantes oficiales, validación y construcción con orden fijo de parámetros y URL-encoding UTF-8), generación del PNG del QR (nivel M, `qrcode`), y `construirBloqueQR` → bloque listo para plantillas. Isomorfo. |
| `lib/verifactu/qr-factura.ts` | Helper de servidor: bloque QR de una factura desde las fuentes de verdad (`sif_registros` fila de alta + `sif_config.entorno_aeat/modalidad`). Devuelve `null` si la factura no está emitida bajo Verifactu. |
| `lib/pdf/invoice-pdf-server.tsx` | Plantilla PDF de servidor: bloque «QR tributario:» + QR 35 mm + leyenda, SIEMPRE antes del contenido de la factura, centrado, solo primera página. |
| `lib/pdf/invoice-pdf-data.ts` | Mapper compartido fila `invoices` + perfil → datos de plantilla (rutas email y pdf). |
| `app/api/invoices/[id]/pdf/route.ts` | **Nueva** ruta GET: PDF de servidor (D-08, fuente única). Si la factura está emitida y el QR no puede generarse → 500 (nunca un duplicado sin QR). |
| `app/api/invoices/[id]/email/route.ts` | El PDF adjunto lleva el QR; si la factura está emitida y el QR falla, el envío se aborta. |
| `components/InvoicePDF.tsx` | Facturas reales (BD) descargan el PDF del servidor; facturas demo siguen con la plantilla local **sin** QR ni leyenda (D-11: nada ficticio). |

## Decisiones (conformes a la especificación)

- **URL de cotejo** (doc. QR §§5-6): 4 parámetros obligatorios en orden fijo
  `nif`, `numserie`, `fecha` (dd-mm-aaaa), `importe` (punto decimal, máx. 12 enteros + 2
  decimales), valores URL-encoded UTF-8, solo ASCII imprimible (32-126).
  - Producción: `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR`
  - Pruebas: `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR`
  - Modo no-VERI*FACTU (V14): mismas bases con `ValidarQRNoVerifactu`.
  - El parámetro opcional `formato=json` **nunca** va en el QR (solo para cotejo
    máquina-a-máquina del receptor); `idioma` tampoco se emplea.
- **Datos del QR = datos del registro**: NIF, `NumSerieFactura`, fecha de expedición e
  `ImporteTotal` se leen de la fila de ALTA de `sif_registros` (no de `invoices`), de modo
  que el QR coincide EXACTAMENTE con lo remitido a AEAT. Recordar que el IRPF no minora el
  `ImporteTotal` del registro: el importe del QR puede diferir del «total a pagar» de la
  factura con retención (criterio AEAT, adaptador V05).
- **QR**: ISO/IEC 18004, corrección de errores **nivel M**, impreso a **35 mm** (rango
  legal 30-40), PNG de ~512 px (≈370 ppp), `margin: 0` en el PNG y zona en blanco
  reglamentaria (≥2 mm, recomendada 6 mm) aportada por la maquetación (≈6 mm arriba/abajo
  + fondo blanco). La huella **no** va en el QR (FAQ AEAT).
- **Ubicación** (doc. QR §3): al principio de la factura, antes del contenido, primera
  página únicamente, centrado; texto «**QR tributario:**» siempre encima; debajo la
  leyenda «**Factura verificable en la sede electrónica de la AEAT**» + marca
  «**VERI*FACTU**» (decisión Kuentas: ambas), con tamaño ≥ al del resto de datos (10 pt).
- **Demo sin QR**: las facturas del modo demo no generan QR ni leyenda (LÍNEA ROJA /
  D-11); solo las facturas con registro de alta real lo llevan.

## Verificación realizada

- 16 tests nuevos (`lib/verifactu/tests/v08-qr.test.mjs`, 103/103 en `npm test`):
  ejemplos oficiales §4 y §8 del doc. AEAT reproducidos byte a byte (incl. URL-encoding
  de `&` en `numserie`), formatos y validaciones de los 4 parámetros, nivel M y contenido
  del QR, PNG, y PDF real generado con y sin bloque QR (plantilla transpilada al vuelo).
- Cotejo **en vivo** contra el Portal de Pruebas Externas AEAT (14/09/2026): la URL de
  ejemplo oficial responde 200 con cotejo procesado, y una URL con formato Kuentas
  (`numserie=F-2026-000123`, `importe=121.40`) responde «No encontrada» sin errores de
  formato (lo esperado al no existir la factura).
- PDF de muestra renderizado y el QR **decodificado** desde la imagen (OpenCV):
  devuelve exactamente la URL de cotejo construida.
