# Validaciones y errores oficiales AEAT — Verifactu (V18)

Fuentes descargadas el **2026-09-20** del portal de desarrolladores de la AEAT
(Sistemas Informáticos de Facturación y Sistemas VERI*FACTU → Validaciones y
errores, enlazado desde la sede electrónica → Información técnica →
«Documento de validaciones y errores»).

| Fichero | Origen | SHA-256 |
|---|---|---|
| `errores.properties` (este directorio) | `https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/errores.properties` | `06519ceb23422bd6b0ad3bfb659e3007615050da4920781d12cff536481d5902` |
| `Validaciones_Errores_Veri-Factu.pdf` (NO en el repo; copia en `verifactu-engine/verifactu-logs/aeat-validaciones-errores.pdf`) | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf` | `426eb926fc098a36a163f66ca5f40d9e0847ca23300bbe5008979832d3513440` |

`errores.properties` se conserva **INTACTO** tal como lo sirve la AEAT
(codificación ISO-8859-1; incluye alguna errata de origen, p. ej. «nÃºmerico»
en el código 1214). Cualquier actualización se hace re-descargando y anotando
aquí fecha y hash.

El fichero define tres ámbitos, separados por líneas de cabecera `*********`:

1. Códigos que provocan el **rechazo del envío completo** (4xxx).
2. Códigos que provocan el **rechazo de la factura** — o de la petición
   completa si el error se produce en la cabecera (1xxx y 3xxx).
3. Códigos que producen la **aceptación con errores** del registro
   (2xxx, deben subsanarse posteriormente).

`lib/verifactu/errores-aeat.ts` es el catálogo tipado generado desde este
fichero; el test `lib/verifactu/tests/v18-errores-aeat.test.mjs` verifica que
ambos coinciden código a código (si la AEAT publica una versión nueva, el
test obliga a regenerar el catálogo).
