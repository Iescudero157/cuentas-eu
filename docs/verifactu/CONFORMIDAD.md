# V18 · Batería de conformidad E2E (portal de pruebas AEAT)

Resultados y metodología de la batería de conformidad del módulo Verifactu de
Kuentas contra el entorno de pruebas de la AEAT (prewww1.aeat.es), en
cumplimiento del bloque B8 del plan maestro («baterías de prueba: errores,
reanudación de cadena, multi-tenant») y del ítem V18.

## 1. Instrumental

- **`npm run verifactu:conformidad -- --plan <dir>`** — genera el plan
  completo SIN RED: 13 casos (12 envelopes SOAP + 1 cotejo QR), con las
  huellas y cadenas calculadas en local (librería V04) y el resultado
  esperado de cada caso anotado en `plan.json`.
- **`scripts/verifactu-conformidad.ps1`** — remite el plan al portal de
  pruebas con el certificado del almacén de Windows (curl/Schannel, como en
  V17), respetando el `TiempoEsperaEnvio` entre envíos (art. 16 Orden
  HAC/1177/2024), y evalúa al terminar.
- **`npm run verifactu:conformidad -- --evaluar <dir>`** — compara cada
  respuesta real con lo esperado usando el catálogo oficial de errores
  (`lib/verifactu/errores-aeat.ts`) y emite `resultado.json`; exit 0 solo si
  la batería completa es CONFORME.
- El test `v18-conformidad.test.mjs` verifica OFFLINE en cada `npm test` que
  el plan sigue siendo válido: envelopes contra los XSD oficiales, cadenas de
  huellas, manipulaciones anunciadas y evaluador (PASS/FAIL) con respuestas
  sintéticas conformes a `RespuestaSuministro.xsd`.

## 2. Catálogo oficial de validaciones y errores

`lib/verifactu/errores-aeat.ts`: 247 códigos generados del
`errores.properties` oficial de la AEAT (44 de rechazo de envío completo,
193 de rechazo de registro, 10 de aceptación con errores), con helpers de
ámbito y descripción. Fuente intacta y hashes en
`docs/verifactu/validaciones/FUENTES.md`; el test `v18-errores-aeat.test.mjs`
falla si el fichero oficial cambia sin regenerar el catálogo (SHA-256 y
comparación código a código).

## 3. Casos de la batería

Los casos de error se fabrican **manipulando el XML tras generarlo**, porque
la librería V05 se niega a construir registros inválidos (los tests de V05
cubren esa negativa); cada manipulación queda anotada en `plan.json` y en el
informe. Tres cadenas independientes: A (flujo feliz), B (errores y
reanudación), C (envío inválido, nunca se registra).

| # | Caso | Qué prueba | Esperado |
|---|---|---|---|
| 01 | `alta-f2-basica` | Alta simple F2 21 %, primer registro de cadena | Correcto |
| 02 | `alta-f2-multi-iva` | Desglose 21 %, 10 %, 4 %, exenta E1 y no sujeta N1 en un registro | Correcto |
| 03 | `alta-f1-destinatario` | F1 con destinatario identificado por NIF (sondeo de censo, D-09) | Correcto (o 2001 ACE) |
| 04 | `alta-f1-recargo` | Recargo de equivalencia (régimen 18: 21 % + 5,2 %) | Correcto (o 2001 ACE) |
| 05 | `rectificativa-r1` | R1 por diferencias (`TipoRectificativa=I`) sobre el caso 03 | Correcto (o 2001 ACE) |
| 06 | `anulacion` | Anulación del caso 02, misma cadena | Correcto |
| 07 | `envio-multiple` | Dos altas encadenadas en un solo `RegFactuSistemaFacturacion` | Correcto (2 líneas) |
| 08 | `duplicado-reintento` | Reenvío byte a byte del envelope 01 (reintento tras caída) | Incorrecto 3000 + `RegistroDuplicado` → idempotente |
| 09 | `rechazo-cuota` | `CuotaRepercutida` incoherente con base×tipo (manipulada; la huella usa `CuotaTotal` y no se altera) | Incorrecto 1142/1216 |
| 10 | `subsanacion-rechazo` | Reenvío corregido del 09: mismo `IDFactura`, `Subsanacion=S` + `RechazoPrevio=S`, encadenado al registro rechazado (**reanudación de cadena**) | Correcto |
| 11 | `aceptado-con-errores` | Huella corrompida tras generar (último carácter) | AceptadoConErrores 2000 |
| 12 | `subsanacion-ace` | Subsanación del 11: mismo `IDFactura`, `Subsanacion=S` (sin `RechazoPrevio`: el 11 SÍ quedó registrado) | Correcto |
| 13 | `envio-xsd-invalido` | `CalificacionOperacion` fuera del esquema (manipulada) | Rechazo del envío completo (4102/SOAP Fault) |
| 14 | `cotejo-qr` | Cotejo público `ValidarQR` (prewww2) del caso 01 | «Encontrada» |

Notas de diseño:

- **Encadenamiento entre envíos**: los casos 01-07 comparten la cadena A a
  través de 7 envíos distintos (y 09-12 la cadena B), de modo que el contraste
  de encadenamiento de la AEAT se ejercita de verdad entre remisiones
  separadas, no solo dentro de un lote.
- **Reanudación tras rechazo**: el caso 10 encadena al registro RECHAZADO
  (09), como exige el flujo `RechazoPrevio` (el registro rechazado sigue
  formando parte de la cadena generada por el SIF).
- **Destinatario de pruebas**: el administrador de Mercadonet (persona real
  censada); si el censo de preproducción no lo identificara, el plan admite y
  documenta 2001 (ACE). La AEAT prohíbe usar el propio obligado como
  destinatario (validación 1193).
- **Multi-tenant**: no se puede ejercitar contra el portal con un solo NIF
  censado (haría falta un segundo obligado real). El aislamiento multi-tenant
  está verificado en la batería V15 (80 tests PGlite: cadenas, numeración,
  RLS y suplantación con 4 obligados). Limitación documentada.
- **Eventos del SIF**: exentos de remisión en modalidad VERI*FACTU (art. 3
  Orden HAC/1177/2024); su generación y cadena propia quedan cubiertas por
  los tests de V06/V12 (decisión DEC-V14).

## 4. Resultados de la ejecución en vivo

(Ver sección final; artefactos completos — envelopes remitidos, respuestas
SOAP, `plan.json` y `resultado.json` — en
`verifactu-engine/verifactu-logs/v18-conformidad/` del equipo ARES2.)

## 5. Qué valida esta batería (mapa a normativa)

- Arts. 8-11 RRSIF y arts. 6-8 Orden: contenido de registros de alta,
  anulación y rectificativas aceptado por la AEAT en todos los tratamientos
  de IVA de la UI de Kuentas.
- Art. 7 Orden (encadenamiento) y doc. de huella v0.1.2: cadenas aceptadas a
  través de envíos separados; corrupción de huella detectada por la AEAT
  (2000) exactamente como predice el catálogo.
- Art. 16 Orden (control de flujo): `TiempoEsperaEnvio` respetado; duplicado
  tratado idempotentemente (3000 + `RegistroDuplicado`), que es la base del
  reintento de la cola V10.
- SPEC §5.4 (máquina de estados): los tres desenlaces (Correcto /
  AceptadoConErrores / Incorrecto) provocados y verificados en real, incluida
  la subsanación V12 en sus dos variantes (tras rechazo y tras ACE).
- Arts. 20-21 Orden (QR): cotejo público del registro remitido.
