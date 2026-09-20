# DECISIONES — Módulo Verifactu de Kuentas

Registro de decisiones de alcance del módulo. Cada decisión indica su base normativa
(textos consolidados del BOE y documentación técnica de la sede AEAT, ver SPEC.md §0)
y su estado de ratificación.

---

## DEC-V14 · Modalidad no-VERI*FACTU: NO se soporta en v1

**Fecha:** 19/09/2026 · **Ítem:** V14 · **Estado:** decisión técnica adoptada —
**[REVISIÓN IVAN]** ratificación final (coincide con la decisión D1 del plan maestro,
7-sep-2026, y con SPEC.md §1).

### Decisión

`cuentas-app` opera **exclusivamente** en modalidad **VERI*FACTU** (remisión continua,
art. 16 RRSIF). La modalidad no-VERI*FACTU (conservación local con firma electrónica de
registros) **no se implementa en v1** y queda fuera del alcance de los ítems V15-V27.
No se crean ítems 14b/14c en la cola de trabajo.

Consecuencias operativas inmediatas:

1. `SistemaInformatico.TipoUsoPosibleSoloVerifactu = 'S'` se mantiene en todos los
   registros (alta, anulación y evento) y **deberá declararse igual** en la declaración
   responsable (V19, art. 15 Orden HAC/1177/2024: la declaración indica si el SIF es de
   uso exclusivo VERI*FACTU).
2. `sif_config.modalidad` conserva el valor `no_verifactu` en su CHECK (previsión de
   esquema), pero **todas** las rutas de emisión, anulación, subsanación y remisión lo
   rechazan con `SIF_MODALIDAD` / `modalidad_no_soportada` (comportamiento ya
   implementado en V07/V10/V12 y verificado en tests).
3. La **firma XAdES** de registros y eventos (art. 14 Orden) **no se implementa**: en
   VERI*FACTU está exenta (art. 3 Orden), la remisión inmediata la sustituye. El punto
   de inyección `firmaXmlDs` de `lib/verifactu/registro-evento.ts` (V06) queda como
   interfaz preparada, sin implementación de firma.
4. El **registro de eventos** (art. 8.4 RRSIF + art. 9 Orden) **no se activa como
   bitácora obligatoria**: en VERI*FACTU está exento (art. 3 Orden). El generador de
   eventos de V06 y el evento de incidencia de V12 se conservan porque son útiles
   internamente y dejan el terreno preparado, pero no constituyen la bitácora firmada
   del art. 9.

### Base normativa de la comparación

| Obligación | VERI*FACTU (elegida) | no-VERI*FACTU | Fuente |
|---|---|---|---|
| Remisión a AEAT | Continua, automática e inmediata de todos los registros | No hay envío; aportación a requerimiento (art. 18 Orden) | art. 16.1 RRSIF; arts. 16-18 Orden |
| Firma electrónica de registros | **Exenta** — basta huella SHA-256 encadenada | **Obligatoria** en cada registro de facturación **y de evento** | art. 12 RRSIF; art. 3 Orden (exime del art. 14 Orden) |
| Registro de eventos | **Exento** | **Obligatorio y firmado**: 9 tipos del art. 9.1 Orden + resumen cada 6 h de funcionamiento (art. 9.2) | art. 8.4 RRSIF; arts. 3 y 9 Orden; `EventosSIF.xsd` |
| Verificaciones locales de cadena | Exentas (la AEAT valida al recibir) | Obligatorias (detección periódica de anomalías en registros y eventos) | arts. 6-7 Orden; art. 3 Orden |
| Presunción de cumplimiento art. 8 RRSIF | **Sí** (art. 16.2 RRSIF) | No: la carga probatoria de integridad/inalterabilidad recae en el SIF | art. 16.2 RRSIF |
| QR y leyenda | QR + «Factura verificable en la sede electrónica de la AEAT» / «VERI*FACTU» | QR sin leyenda (servicio de cotejo `ValidarQRNoVerifactu`) | arts. 20-21 Orden; doc. QR sede AEAT |
| Conservación | Registros conservados (art. 8 Orden) + copia en sede AEAT | Conservación local íntegra hasta prescripción, con volcado y remisión a requerimiento | art. 8 Orden; art. 18 Orden |

### Análisis coste/beneficio

**Coste de soportar no-VERI*FACTU** (estimación plan maestro: **+10-15 días** de
desarrollo, sin contar operación continua):

- **Firma XAdES por registro**: no existe librería XAdES madura y mantenida en el
  ecosistema Node/TypeScript del stack (Next.js en Vercel); habría que implementar la
  firma conforme a las especificaciones que la AEAT publica en sede (DA 1.ª Orden) y
  mantenerla. Es la pieza de mayor riesgo técnico y de conformidad.
- **Certificado de firma por tenant**: cada obligado necesitaría firmar sus propios
  registros en el servidor → custodia y uso continuo de la clave privada de CADA
  cliente para CADA factura (hoy V11 solo la usa para mTLS de remisión). Superficie de
  riesgo de seguridad mucho mayor y posible cuestión jurídica sobre delegación de firma
  **[ASESOR]**.
- **Bitácora de eventos operativa**: scheduler del resumen cada 6 h **por tenant**
  (art. 9.2 Orden) — mal encaje en serverless (Vercel), coste de operación permanente.
- **Detección periódica local** de anomalías sobre registros y eventos con evidencia
  firmada (arts. 6-7 y 9 Orden), volcado/exportación firmada y remisión a requerimiento
  (art. 18 Orden).
- **Doble QA de conformidad** (V17-V18) y declaración responsable con dos modos;
  `TipoUsoPosibleSoloVerifactu` pasaría a `'N'`, con la responsabilidad del art. 201
  bis.2 LGT (150.000 €/ejercicio y tipo de sistema) extendida a un modo apenas usado.

**Beneficio de soportarlo**: privacidad de los datos hasta requerimiento y posible
demanda de algún cliente reticente a la remisión continua. Comercialmente débil para el
público de Kuentas (autónomos/micropymes): la presunción de cumplimiento del art. 16.2
RRSIF, la leyenda de verificabilidad y la visibilidad de las facturas en la sede son
argumentos de venta a favor de VERI*FACTU, y la propia app gratuita de la AEAT (art. 19
Orden) opera solo como VERI*FACTU.

**Conclusión**: el coste (≈25-35 % de esfuerzo adicional sobre el total del plan, más
operación y riesgo de seguridad permanentes) no se justifica sin demanda real. Se
re-evaluará **en fase F5 del plan maestro (2027)** solo si algún cliente lo exige
contractualmente.

### Terreno ya preparado (si algún día se activa)

Implementado y testeado, reduce el coste de una futura activación:

- Generador completo de registros de evento (V06, `lib/verifactu/registro-evento.ts`):
  11 tipos, cadena de huellas propia, punto de inyección `firmaXmlDs`, validado contra
  `EventosSIF.xsd`.
- Detector de anomalías con los códigos oficiales de `TipoAnomalia` (V12, SQL + TS) y
  evento de incidencia con huella verificada.
- QR con soporte `ValidarQRNoVerifactu` (V08, `lib/verifactu/qr.ts`).
- Esquema de BD con `modalidad` previsto y bloqueos explícitos reversibles.

Qué faltaría (contenido orientativo de un futuro ítem 14b, NO creado): firma XAdES de
registros y eventos conforme a la especificación de sede AEAT, bitácora de eventos con
resumen 6 h por tenant, detección periódica programada con evidencia, exportación/
volcado y remisión a requerimiento (art. 18 Orden), UI y textos, declaración responsable
con `TipoUsoPosibleSoloVerifactu='N'`, QA de conformidad del modo local.

---

*Fuentes: RD 1007/2023 (RRSIF) y Orden HAC/1177/2024, textos consolidados del BOE
(verificados en V02, 08/09/2026); documentación técnica de la sede AEAT (XSD y doc. QR
descargados en V05/V08, `docs/verifactu/xsd/FUENTES.md`). Detalle normativo ampliado en
`SPEC.md` §1 y §7.*

---

## DEC-V16 · Conservación: sin purga y retención de 6 años propuesta

**Fecha:** 20/09/2026 · **Ítem:** V16 · **Estado:** decisión técnica adoptada —
**[REVISIÓN IVAN/ASESOR]** plazo de retención y proceso de baja.

1. **Formato de export = formato de remisión.** El art. 8.5 Orden HAC/1177/2024 exige que
   lo exportado mantenga la estructura de los arts. 10-11, y el art. 18 fija la remisión a
   requerimiento con la estructura de VERI*FACTU: cada lote exportado es un mensaje
   `RegFactuSistemaFacturacion` (SuministroLR.xsd, ≤1000 registros) validado contra los
   XSD oficiales. Sin formatos propietarios para los registros.
2. **Sin purga.** Aunque el art. 8.2 Orden permite dejar de conservar en el sistema lo ya
   exportado, Kuentas conserva SIEMPRE los registros en BD (append-only): el export es una
   copia, no un traslado. Simplifica la trazabilidad y elimina el riesgo de pérdida.
3. **Períodos por fecha de generación.** El filtro de export se resuelve a un tramo
   contiguo de correlativos (la cadena sigue el orden de generación, art. 7 Orden): todo
   export es verificable por huellas, completo o parcial (anclado).
4. **Retención propuesta: 6 años** (art. 30 CCom ≥ 4 años LGT), registros supervivientes a
   la baja del cliente y export de despedida al causar baja — plazos y proceso pendientes
   de ratificación por Iván/asesor (detalle en CONSERVACION.md §4).
