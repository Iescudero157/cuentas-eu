# Conservación y exportación de registros de facturación (V16)

Diseño e implementación del requisito de **conservación, accesibilidad y legibilidad**
(art. 8 RD 1007/2023 «RRSIF» y art. 8 Orden HAC/1177/2024) en `cuentas-app`.
Código: `lib/verifactu/export.ts` · API: `GET /api/verifactu/export` · CLI:
`npm run verifactu:exportar` · UI: tarjeta «Conservación y exportación» del panel Verifactu.

## 1. Base normativa

| Norma | Qué exige | Cómo lo cumple Kuentas |
|---|---|---|
| Art. 8.1 Orden | Conservar todos los registros generados y permitir acceso, recuperación y consulta en formato electrónico legible | Tablas `sif_registros`/`sif_eventos` **append-only** (RLS + REVOKE + triggers, V03); panel V13 de consulta; export V16 |
| Art. 8.2 Orden | Posibilidad de **exportación segura** a almacenamiento externo, en formato legible, **por períodos** | Export ZIP por rango de fechas de generación (tramo contiguo de correlativos) |
| Art. 8.3 Orden | El obligado conserva los registros durante el **plazo de las matrices de facturas** (RD 1619/2012, arts. 19-20) | Ver §4 Política de retención |
| Art. 8.4 Orden | Acceso y consulta «rápida, fácil e intuitiva» | Panel V13 (filtros, paginación, CSV) + export ZIP |
| Art. 8.5 Orden | La información exportada **mantiene la estructura y formato** de los arts. 10 y 11 | Cada lote es XML `RegistroAlta`/`RegistroAnulacion` de los XSD oficiales |
| Art. 18 Orden | Remisión **por requerimiento** con la estructura de VERI*FACTU | Lotes = mensajes `RegFactuSistemaFacturacion` (SuministroLR.xsd) de 1..1000 registros, validados contra XSD en tests |
| Art. 16.2 RRSIF | En VERI*FACTU se presume el cumplimiento del art. 8 RRSIF | La presunción **no exime** al obligado de conservar las facturas y sus registros (SPEC §1.7): por eso V16 existe igualmente |

## 2. Formato del export

Fichero `verifactu-export-<NIF>-<correlativoDesde>-<correlativoHasta>-<fecha>.zip`:

```
manifest.json                  Metadatos, alcance, huellas primera/última,
                               SHA-256 de cada fichero y resultado de la
                               verificación hecha en origen.
LEEME.txt                      Explicación humana + referencias normativas.
registros/registros-00001.xml  Lotes RegFactuSistemaFacturacion (≤1000
registros/registros-00002.xml  registros por lote, art. 16 Orden), en el
…                              orden de la cadena de huellas.
eventos/eventos.json           Eventos internos del SIF con su cadena de
                               huellas propia (si hay).
```

- El XML de cada registro es **el fijado al emitir** (`sif_registros.xml`, idéntico al
  remitido a la AEAT); si no se llegó a fijar, se reconstruye determinísticamente desde el
  jsonb (`registro`) y **solo se exporta si la huella reconstruida coincide** con la
  almacenada (línea roja: nunca se exporta un XML cuya huella no case).
- **Períodos**: el filtro `desde`/`hasta` se aplica sobre el instante de **generación** del
  registro (corte en UTC) y se resuelve a un tramo **contiguo de correlativos** — la cadena
  sigue el orden de generación (art. 7 Orden), así el encadenamiento de todo export es
  verificable. Un export parcial queda «anclado» a la huella del registro anterior
  (`RegistroAnterior/Huella` del primer registro exportado).
- Los **eventos** se vuelcan como JSON interno: Kuentas v1 es VERI*FACTU y está **exenta**
  del registro de eventos del art. 9 Orden (art. 3 Orden; DEC-V14); el volcado es
  trazabilidad interna, no la bitácora firmada del modo local.

## 3. Re-verificación de huellas sobre el fichero exportado

`verificarZipExport()` (usada por la API al generar, por el CLI con `--verificar` y por los
tests) es **independiente de la base de datos**:

1. Contrasta el **SHA-256** de cada fichero del ZIP con el manifiesto
   (`FICHERO_MANIPULADO` / `MANIFIESTO_INCONSISTENTE`).
2. Re-extrae los registros de los lotes XML y **recalcula cada huella** con la fórmula
   oficial (doc. AEAT «huella/hash» v0.1.2, librería V04): `HUELLA_NO_COINCIDE`,
   `FORMATO_HUELLA`.
3. Comprueba el **encadenamiento** entre registros consecutivos y la coherencia del primer
   registro (`ENCADENADO_ROTO`, `PRIMER_REGISTRO_INCOHERENTE`) y la trazabilidad de fechas
   (`FECHA_RETROCEDIDA`).
4. En los eventos, la **continuidad** de su cadena (`EVENTOS_ENCADENADO_ROTO`); su huella se
   recalcula en BD (`sif_registrar_evento`) y en el verificador V12, no aquí.

La descarga se sirve **aunque haya anomalías** (la conservación es prioritaria): el
manifiesto y la cabecera `X-Verifactu-Integra` dejan constancia, y el panel avisa.

## 4. Política de retención **[REVISIÓN IVAN/ASESOR]**

Propuesta (pendiente de ratificar; los plazos legales citados son los vigentes):

- **Plazo**: conservar registros de facturación, XML remitidos, respuestas AEAT (CSV) y
  eventos **al menos 6 años** desde la expedición — cubre los 4 años de prescripción
  tributaria (arts. 66-70 LGT) y los 6 años de conservación mercantil (art. 30 Código de
  Comercio), que es también el plazo aplicable a facturas y matrices (arts. 19-20
  RD 1619/2012 en relación con el art. 165 LIVA y el art. 29.2.e LGT).
- **Purga**: aunque el art. 8.2 Orden permite dejar de conservar en el sistema lo ya
  exportado correctamente, **Kuentas no purga**: los registros permanecen en la BD
  (append-only) además de cualquier copia exportada. Decisión DEC-V16.
- **Baja de cliente**: los registros **sobreviven a la baja** hasta agotar el plazo
  anterior (las FK a `auth.users` son `on delete restrict`: una baja no puede borrar en
  cascada los registros fiscales). Al causar baja se entrega un **export de despedida**
  (este mismo ZIP; el plan maestro añade facturas PDF y export contable — se implementará
  con el flujo de baja) **[REVISIÓN IVAN: proceso de baja y contenido exacto del ZIP de
  despedida]**.
- **Copias**: la conservación primaria es la BD Supabase (backups gestionados) y las
  exportaciones son copias adicionales bajo control del obligado.

## 5. Uso

- **Panel** (`/dashboard/verifactu`): tarjeta «Conservación y exportación», fechas
  opcionales, descarga directa. Cada export queda anotado como evento interno
  (`export_registros` / `export_eventos`, tipos oficiales 08/09 de EventosSIF.xsd) vía
  service_role, best-effort.
- **API**: `GET /api/verifactu/export?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` (sesión del
  usuario; RLS «select own»). 404 `sin_registros`, 409 `sin_config`, 400 `fecha_invalida`.
- **CLI** (operaciones):
  `npm run verifactu:exportar -- --user <uuid> [--desde …] [--hasta …] [--out <dir>] [--evento]`
  y `npm run verifactu:exportar -- --verificar <fichero.zip>`. Sale con código 1 si el
  export no es íntegro.

## 6. Tests

`lib/verifactu/tests/v16-export.test.mjs` (npm test): lotes validados contra
`SuministroLR.xsd` oficial, troceo ≤1000, reconstrucción desde jsonb (y rechazo si la
huella diverge), roundtrip íntegro, manipulación de importe → `HUELLA_NO_COINCIDE`,
registro eliminado → `ENCADENADO_ROTO`, export parcial anclado, ZIP manipulado →
`FICHERO_MANIPULADO`, fichero ausente → `MANIFIESTO_INCONSISTENTE`, cadena de eventos rota
→ `EVENTOS_ENCADENADO_ROTO`.
