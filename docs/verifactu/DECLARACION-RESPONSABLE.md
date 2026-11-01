# V19 · Declaración responsable del SIF Kuentas

**Estado: SUSCRITA el 1-nov-2026 en Madrid por Iván Escudero Salas, administrador solidario de
MILBROTES, S.L. (versión 1.0.0).** Ver «Historial» al final.

## Base legal

- **Art. 13 RD 1007/2023 (RRSIF)**: el productor certifica mediante declaración responsable
  que el SIF cumple el reglamento. Debe constar por escrito **de modo visible en el propio
  sistema en cada una de sus versiones** y estar disponible para el cliente y el
  comercializador en el momento de la adquisición (13.2), conservarse para todas las
  versiones y entregarse a quien la solicite (13.3).
- **Art. 15 Orden HAC/1177/2024**: contenido mínimo (letras a–l): nombre del SIF, código
  identificador, versión, componentes y funcionalidades, si es solo-VERI*FACTU, si soporta
  varios obligados, tipos de firma de registros/eventos, razón social, NIF y dirección del
  productor, declaración expresa de cumplimiento (LGT + RRSIF + Orden) y fecha/lugar de
  suscripción. No existe homologación previa de la AEAT: es autocertificación con
  responsabilidad (sanción del art. 201 bis.2 LGT: 1.000 € por sistema comercializado sin
  declaración exigible).

## Implementación (fuente única)

| Pieza | Fichero |
|---|---|
| Fuente única del texto y los datos | `lib/verifactu/declaracion-responsable.ts` |
| Página visible en el sistema (pública) | `app/verifactu/page.tsx` → `/verifactu` |
| PDF descargable (público, sin sesión) | `app/api/verifactu/declaracion-responsable/route.ts` |
| Generador PDF | `lib/pdf/declaracion-responsable-pdf-server.tsx` |
| Acceso desde el panel | tarjeta «Declaración responsable del sistema» en `/dashboard/verifactu` |
| Enlace de adquisición | footer de la landing (`app/page.tsx`) |
| Tests | `lib/verifactu/tests/v19-declaracion.test.mjs` |
| Página en kuentas.eu (marketing) | `verifactu.html` en el repo GitLab de la web (tras el muro de mantenimiento) |

Los datos identificativos (nombre, `IdSistemaInformatico`, versión, indicadores
VERI*FACTU/multi-OT, productor) se toman de `sistemaInformaticoKuentas()`
(`registro-alta.ts`), la misma función que los estampa en cada registro remitido a la AEAT:
un cambio allí se refleja automáticamente en la declaración (los tests verifican la
coincidencia 1:1).

**Productor (oct-2026): Milbrotes S.L.** Los datos del productor salen de la constante única
`PRODUCTOR_SIF` (`lib/verifactu/productor-sif.ts`). Mercadonet Global S.L. (B98407901) deja
de ser productor y sigue siendo **cliente/obligado** (ver `ALTA-MERCADONET.md`). Mientras
`PRODUCTOR_SIF.nif` esté vacío, la declaración muestra `{{MILBROTES_CIF}}` y
`{{MILBROTES_REGISTRO}}`, y la emisión de registros y cualquier envío real a la AEAT abortan
con `ErrorProductorSif` (también `sif_registrar_evento` en BD: `SIF_PRODUCTOR_SIN_NIF`).
La declaración se firma directamente con Milbrotes como productor (no se publica ninguna
versión con Mercadonet).

**Disciplina de versionado (art. 13.2 RRSIF):** cada nueva versión del componente de
facturación ⇒ subir `version` en `sistemaInformaticoKuentas()` ⇒ la declaración se reedita
sola, pero debe **volver a suscribirse** (fecha/lugar/firmante nuevos) y archivarse la
anterior (13.3: hay que conservar las declaraciones de TODAS las versiones).

## Historial

- 30-oct-2026: `PRODUCTOR_SIF` con el NIF B05772710 y la inscripción (RM de Madrid, hoja
  M-899621, 1.ª). La migración `20261016100000_sif_productor_milbrotes.sql` se aplica con el
  despliegue del código que la usa.
- 1-nov-2026: razón social y domicilio como en la comunicación del NIF de la AEAT y el art. 3
  de los estatutos («MILBROTES, S.L.», Calle Belalcázar, 14, 28006 Madrid). `IdSistemaInformatico`
  `01`, estable entre versiones. Texto revisado por el asesor (OK comunicado por Iván el
  23-oct-2026). Suscrita: `SUSCRIPCION_DECLARACION` (Madrid, 2026-11-01, Iván Escudero Salas,
  administrador solidario) y `DECLARACION_ES_BORRADOR = false`. Sin suscripción completa la
  declaración vuelve a salir como borrador aunque el indicador esté a false (test V19).
- Pendiente: archivar el PDF suscrito de la v1.0.0 (13.3 RRSIF) y publicar `verifactu.html` en
  kuentas.eu con el mismo texto al salir de mantenimiento.
