# V12 · Incidencias e integridad (subsanación, detección de anomalías y verificador)

**Base legal:** doc. AEAT «Validaciones y errores» (campos `Subsanacion` y `RechazoPrevio`);
SPEC.md §5.4-§5.5 (estados tras la respuesta AEAT); arts. 8.2 y 12 RD 1007/2023 (integridad,
inalterabilidad y huella encadenada); art. 7 Orden HAC/1177/2024 (encadenamiento); art. 9
Orden (eventos — Kuentas v1 opera solo como VERI\*FACTU y está **exenta** por el art. 3;
el registro de eventos es interno, como producto total, y el XML firmado XAdES llega en V14).

## 1. Subsanación y reenvío (SPEC §5.4)

| Registro previo | Estado AEAT | Acción V12 | Marcadores | Estado terminal del previo |
|---|---|---|---|---|
| Alta | `accepted_with_errors` (AceptadoConErrores) | Nuevo registro de alta corregido | `Subsanacion=S` | `subsanado` |
| Alta | `rejected` (Incorrecto) | Nuevo registro de alta corregido | `Subsanacion=S` + `RechazoPrevio=S` | `resent` |
| Anulación | `rejected` | Nueva anulación | `RechazoPrevio=S` (el XSD no tiene `Subsanacion` en RegistroAnulacion) | `resent` |

Principios de diseño:

- **El IDFactura no cambia** (NIF emisor + NumSerieFactura + FechaExpedicion): se corrige el
  REGISTRO, no la factura. Una factura con contenido erróneo se rectifica (R1-R5) o se anula
  (flujos de V07); la RPC lo exige (`SIF_IDFACTURA`).
- **La factura sigue congelada** (art. 8.2 RRSIF): el registro subsanador se reconstruye
  desde la factura inmutable. Única corrección de datos admitida: el **destinatario**
  (p. ej. NIF no identificado/censado), pasado explícitamente en las opciones.
- **Misma transacción que la emisión** (`sif_subsanar_registro`, security definer): lock
  `FOR UPDATE` de `sif_cadena` (serializa y evita la doble subsanación), huella SQL con la
  fórmula oficial, registro append-only con `subsanacion`/`rechazo_previo`/`subsana_registro_id`,
  outbox en la misma transacción y estado terminal del registro previo. No consume número
  de serie (no hay factura nueva).
- **Estados nuevos** `subsanado` y `resent` añadidos al check de `estado_remision`
  (máquina de estados SPEC §5.5). `subsana_registro_id` es contenido inmutable (guard V03
  ampliado).
- Un registro subsanador rechazado de nuevo por la AEAT vuelve a quedar `rejected` y puede
  subsanarse otra vez (siempre el ÚLTIMO registro del IDFactura; los anteriores quedan en
  estado terminal).

Capa Next: `lib/verifactu/subsanacion.ts` (`subsanarFactura`, `reenviarAnulacion`, con
dry-run `construirRegistroAlta`/`construirRegistroAnulacion` antes de la RPC y fijación del
XML verificando huella TS ≡ SQL) y `POST /api/invoices/[id]/subsanar` (elige alta o
anulación según el estado de la factura; body opcional `{ destinatario, operacion_exenta,
ref_externa }`). El worker V10 remite el registro subsanador como uno más (los duplicados
idempotentes de V10 no aplican: `Subsanacion=S` es un envío nuevo para la AEAT).

## 2. Detección de huecos y roturas de cadena

Dos implementaciones INDEPENDIENTES que se contrastan entre sí (defensa en profundidad):

- **SQL** — `sif_detectar_anomalias(p_user_id default null)` (service_role): recalcula cada
  huella con `sif_sha256`/`sif_formatear_importe` (pgcrypto) y recorre la cadena con window
  functions.
- **TypeScript** — `lib/verifactu/integridad.ts` (`verificarRegistrosObligado`): recalcula
  con la librería V04 (`huellaAlta`/`huellaAnulacion`, node:crypto), sin depender de SQL.

Códigos de anomalía (con su TipoAnomaliaType oficial de EventosSIF.xsd para el evento 04):

| Código interno | Comprobación | TipoAnomalia |
|---|---|---|
| `HUECO_CORRELATIVO` | Correlativos no consecutivos o cadena que no empieza en 1 | 04 |
| `PRIMER_REGISTRO_INCOHERENTE` | Flag primer_registro ausente al inicio o presente en mitad | 06 |
| `ENCADENADO_ROTO` | `huella_anterior` ≠ huella del registro anterior (contiguos) | 08 |
| `FORMATO_HUELLA` (solo TS) | Huella que no es 64 hex mayúsculas | 03 |
| `HUELLA_NO_COINCIDE` | Huella recalculada ≠ almacenada | 01 |
| `JSONB_INCONSISTENTE` | Contenido oficial (jsonb) ≠ columnas (huella/fecha-hora) | 03 |
| `FECHA_RETROCEDIDA` | FechaHoraHusoGenRegistro anterior a la del registro previo | 11 |
| `FECHA_FUTURA` | FechaHoraHusoGenRegistro posterior a la hora del sistema (+5 min) | 13 |
| `CADENA_DESINCRONIZADA` | Puntero `sif_cadena` ≠ último registro real | 10 |

## 3. Verificador ejecutable

```
npm run verifactu:verificar                     # todos los obligados
npm run verifactu:verificar -- --user <uuid>    # un obligado
npm run verifactu:verificar -- --eventos        # anota eventos 03/04 en sif_eventos
npm run verifactu:verificar -- --json out.json  # informe a fichero
```

`scripts/verifactu-verificar.mjs` (Node type-stripping, sin dependencias nuevas): credenciales
de `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (entorno o `.env.local`), informa
por obligado (TS + contraste SQL) y sale con código 1 si hay anomalías. Mismo verificador vía
HTTP para operación: `GET /api/verifactu/integridad[?user=<uuid>&eventos=1]` (Bearer
`CRON_SECRET`).

## 4. Eventos de incidencia (`sif_registrar_evento`)

- Cadena de huellas **propia** por obligado (doc. AEAT huella §3.c, 9 pares `Campo=valor`),
  serializada con advisory lock; misma fórmula que `cadenaEntradaEvento()` de `huella.ts`
  (verificado SQL ≡ TS en tests). Constantes del bloque SistemaInformatico idénticas a
  `sistemaInformaticoKuentas()` (NIF productor B98407901, Id `01`, versión `1.0.0`).
- El verificador anota un evento `deteccion_anomalias_registros` (tipo oficial 03) por
  ejecución con `--eventos`, y un `anomalia_registro` (04) por anomalía (tope 50 por
  ejecución), con el detalle interno y el TipoAnomalia oficial en `datos`.
- `sif_eventos` sigue siendo append-only total; solo service_role registra eventos.

## 5. Verificado (2026-09-19)

- `npm test` 177/177 (18 nuevos V12, incl. XML subsanador validado contra los XSD oficiales).
- `npm run test:db` 57+74+70+37+62 = 300/300 (batería nueva `supabase/tests/v12-incidencias.test.mjs`:
  subsanación AWE/rechazo, reenvío de anulación, guardas multi-tenant y de IDFactura, doble
  subsanación imposible, detector SQL≡TS sobre una cadena corrupta fabricada, cadena de
  eventos con huella oficial).
- `npm run build` verde; migración NO aplicada a producción (solo fichero).

## 6. Pendiente (items futuros)

- UI del panel Verifactu para lanzar subsanaciones y ver anomalías (V13).
- XML firmado de eventos y modo no-VERI\*FACTU (V14).
- Programar la verificación periódica de integridad (decisión de operación; el endpoint y el
  script ya existen) y catálogo completo de errores AEAT en tests (V18).
