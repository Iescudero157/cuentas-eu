# MIGRACIONES-BD.md — Esquema Verifactu (V03)

**Fecha:** 2026-09-11 · **Rama:** `verifactu` · **Estado:** migraciones creadas y verificadas en local. **NO aplicadas a producción** (regla del item V03: solo ficheros en `supabase/migrations`).

## 1. Ficheros

| Migración | Contenido |
|---|---|
| `20260911100000_sif_config.sql` | `sif_config`: configuración por obligado (NIF, razón social, modalidad `verifactu`/`no_verifactu`, entorno AEAT `pruebas`/`produccion`, `numero_instalacion`, `certificado_ref` opaca, fechas inicio/fin VERI*FACTU, control de flujo `tiempo_espera_envio` + `proximo_envio_desde`). RLS: el usuario solo ve/gestiona la suya. |
| `20260911100100_sif_series_numeracion.sql` | `sif_series` (contadores por obligado+serie+ejercicio) y función **`sif_reservar_numero()`** (SECURITY DEFINER, reserva atómica vía `INSERT … ON CONFLICT DO UPDATE`, formato D-01 `F-2027-000123`). Corrige el riesgo R1 de V01 (numeración en cliente). |
| `20260911100200_sif_cadena_registros.sql` | `sif_cadena` (puntero al último eslabón por obligado, para serializar con `FOR UPDATE`) y **`sif_registros`** (alta+anulación, append-only): campos oficiales, `registro` JSONB completo, `xml` set-once, `primer_registro`/`huella_anterior`/`huella` (CHECK 64 hex mayúsculas), `fecha_hora_huso_gen` (ISO 8601 con huso, CHECK de formato), `estado_remision`, `csv_aeat`, `respuesta_aeat`, flags `subsanacion`/`rechazo_previo`/`incidencia`. Triggers de inmutabilidad + guard en `sif_config`. |
| `20260911100300_sif_outbox_eventos.sql` | `sif_outbox` (cola de remisión: estado, lote, intentos, `proximo_intento_at`, `incidencia`) y `sif_eventos` (art. 9 Orden; **exento en VERI*FACTU** por art. 3 Orden, preparado para V14; cadena de huellas propia, inmutable total). |
| `20260911100400_invoices_estados_fiscales.sql` | `invoices`: `verifactu_estado` (`borrador`→`emitida`→`rectificada`\|`anulada`), `serie`/`ejercicio`/`numero_fiscal` (UNIQUE parcial por usuario), `emitida_at`, `tipo_factura` L2, `rectifica_invoice_id`+`tipo_rectificativa`, `registro_alta_id`/`registro_anulacion_id`, `pdf_path`. Trigger: DELETE solo borradores (D-12) y contenido fiscal congelado tras emitir (D-03), dejando libres los metadatos de cobro (`status`, `payment_*`, `due_date`, `notes`). |

## 2. Decisiones de diseño y mapeo con la SPEC

- **Nomenclatura `sif_*`** (la del item V03 de la cola de trabajo). Equivalencia con los nombres provisionales de SPEC §11: `verifactu_registros`→`sif_registros`, `verifactu_cola`→`sif_outbox`, `verifactu_cadena`→`sif_cadena`, `series_facturacion`→`sif_series`.
- **`verifactu_certificados` NO se crea en V03**: la custodia de certificados es del item **V11** (posible `verifactu-gateway` externo, SPEC §8); `sif_config.certificado_ref` guarda solo una referencia opaca. Prohibido material criptográfico en BD de app.
- **Tenant = `auth.users`** (`user_id`), igual que el esquema existente. La cadena de huellas es **por obligado** (art. 7 Orden): 1 fila `sif_cadena` por usuario; altas y anulaciones comparten cadena y numeración `correlativo` (UNIQUE `user_id+correlativo` = índice obligado+correlativo del item).
- **Inmutabilidad en 3 capas** (art. 8.2 RRSIF, art. 6 Orden): (1) RLS sin policies de escritura para `authenticated`; (2) `REVOKE INSERT/UPDATE/DELETE/TRUNCATE` explícito a `anon`/`authenticated`; (3) **triggers** que aplican a TODOS los roles, incluido `service_role` (que bypassa RLS pero no triggers). En `sif_registros` solo puede evolucionar el bloque de remisión (`estado_remision`, `csv_aeat`, `respuesta_aeat`, `codigo_error_registro`, `descripcion_error`, `remitido_at`, `incidencia`) y `xml` una única vez (NULL→valor).
- **FKs con `ON DELETE RESTRICT`** hacia `auth.users` e `invoices`: borrar un usuario o una factura no puede arrastrar registros de facturación (conservación, art. 8 RRSIF).
- **Compatibilidad con la app actual**: `verifactu_estado` default `borrador` ⇒ todas las filas existentes siguen editables/borrables; ningún endpoint actual cambia de comportamiento hasta V07. La unicidad de numeración se impone sobre la nueva columna `numero_fiscal` (el legacy `number` tiene duplicados históricos — R1 de V01 — y una UNIQUE sobre él rompería la aplicación de la migración).
- **Estados** según SPEC §5.5: registro `generated→queued→sending→accepted|accepted_with_errors|rejected` (subsanación/reenvío = **registros nuevos** con `subsanacion`/`rechazo_previo`, nunca mutación); factura `borrador→emitida→rectificada|anulada` con transiciones válidas impuestas por trigger.

## 3. Verificación realizada (2026-09-11)

Batería automatizada sobre **PGlite** (Postgres real embebido) simulando el entorno Supabase (schema `auth`, `auth.uid()`, roles `anon`/`authenticated`/`service_role`, default privileges): `supabase/tests/v03-migraciones.test.mjs`.

```bash
npm i --no-save @electric-sql/pglite
node supabase/tests/v03-migraciones.test.mjs
```

**Resultado: 57 PASS · 0 FAIL.** Cubre: aplicación limpia sobre `schema.sql`+`schema-update.sql`, re-aplicación idempotente de las 5 migraciones, numeración atómica y por serie, CHECKs (NIF, huella 64-hex-mayúsculas, encadenamiento primer registro, alta con importes, formato fecha-hora con huso), inmutabilidad (UPDATE de contenido, DELETE, TRUNCATE CASCADE, xml set-once), guard de `sif_config` con cadena iniciada, unicidad obligado+correlativo y `numero_fiscal` multi-tenant, outbox único por registro, eventos append-only, ciclo emitir→cobrar→anular con transiciones inválidas bloqueadas, y RLS (aislamiento entre usuarios, escrituras denegadas a `authenticated`, función de reserva rechaza suplantación).

## 4. Cómo aplicar (cuando toque — NO hecho)

Producción no se toca desde el repo. Cuando Iván decida aplicar: Supabase SQL Editor (o `supabase db push` si se vincula el CLI), ejecutando las 5 migraciones **en orden**. Prerrequisito: `schema.sql` + `schema-update.sql` ya aplicados (es el estado actual de producción). Son idempotentes (`if not exists` / `drop … if exists`) y **no alteran datos existentes** (solo columnas nuevas con default y tablas nuevas).

## 5. Pendiente para items siguientes

- V04/V07: funciones de emisión (bloqueo `sif_cadena FOR UPDATE`, cálculo de huella, inserción transaccional registro+outbox+update factura).
- V10: worker de despacho de `sif_outbox` (lotes ≤1000, `TiempoEsperaEnvio`, reintento ≥1/hora, `Incidencia=S`).
- V11: gestión real de certificados (aquí solo `certificado_ref`).
- V13: la UI aún no muestra nada de esto (ningún cambio de front en V03).
