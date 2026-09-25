# Servicio de emisión Verifactu (V07)

**Fecha:** 2026-09-13 · **Rama:** `verifactu` · Implementa D-01, D-02, D-03, D-05, D-06, D-11, D-12 de `SPEC.md` y el punto de inserción nº 1-3 de `ARQUITECTURA-FACTURACION.md`.

## 1. Qué hace

Al **emitir** una factura (crear una factura con el módulo activo, o `POST /api/invoices/{id}/emitir` sobre un borrador) se ejecuta **una única transacción Postgres** (`sif_emitir_factura`, `security definer`) que:

1. Verifica el **feature flag por empresa** (`sif_config.activo`) y la modalidad (`verifactu`).
2. Bloquea la factura (`FOR UPDATE`) y exige estado `borrador` (emisión única, art. 9 RD 1007/2023).
3. Bloquea la **cadena del obligado** (`sif_cadena FOR UPDATE`) → las emisiones concurrentes del mismo NIF se serializan (art. 7 Orden HAC/1177/2024; D-05).
4. Reserva el **número correlativo** en servidor (`sif_reservar_numero`, serie `F` ordinaria / `R` rectificativa, formato `F-2026-000123`; D-01, corrige R1 de V01).
5. Calcula `FechaHoraHusoGenRegistro` (Europe/Madrid) y la **huella SHA-256 encadenada** en SQL (pgcrypto), con la misma cadena de entrada oficial que `lib/verifactu/huella.ts` (verificado contra el vector AEAT §6.1 y contra la implementación TS en los tests).
6. Inserta el registro **append-only** en `sif_registros` (contenido oficial completo en `registro` jsonb, fuente única para regenerar el XML) y lo **encola en `sif_outbox`** (patrón outbox; el worker de remisión es V10).
7. Actualiza el puntero de cadena y congela la factura: `borrador → emitida` (+ `numero_fiscal`, `serie`, `ejercicio`, `tipo_factura`, `emitida_at`, `registro_alta_id`). Si es rectificativa, la factura rectificada pasa `emitida → rectificada`.

O **todo** queda consistente o no se consume número ni eslabón (verificado en tests: un intento fallido no quema correlativos).

Tras el commit, el servidor Next (`lib/verifactu/emision.ts`) reconstruye el **XML oficial** desde el jsonb, verifica que la huella TypeScript coincide con la SQL (defensa en profundidad) y lo fija una única vez con `sif_fijar_xml` (NULL→valor; el trigger de V03 impide cambiarlo después). Si este paso fallara, el registro sigue siendo válido y V10 regenera el XML determinista desde `registro`.

## 2. Validación previa (dry-run, sin quemar números)

Antes de llamar a la RPC, `emitirFactura()` construye la entrada con `prepararEntradaAlta()` y ejecuta `construirRegistroAlta()` (V05) con un número provisional: NIF con dígito de control, listas oficiales, aritmética ±10 €, destinatarios, rectificativas… Si la factura no es conforme se devuelve **422 con el detalle de errores** y no se toca la numeración ni la cadena.

## 3. Anulación (D-12) e inmutabilidad

- `POST /api/invoices/{id}/anular` → `sif_anular_factura`: registro de **anulación** encadenado en la misma cadena (art. 11 RRSIF), factura `emitida → anulada`. El `DELETE` físico queda solo para borradores; para emitidas devuelve **409** con el motivo.
- `PATCH` sobre factura emitida: solo metadatos de cobro (`status`, `payment_*`, `due_date`, `notes`); tocar `client_email` devuelve **409** (el contenido fiscal es inmutable, art. 8.2 RRSIF — y el trigger de BD lo garantiza aunque el endpoint fallara).

## 4. API

| Endpoint | Comportamiento con `sif_config.activo` |
|---|---|
| `POST /api/invoices` | Crea y **emite** (ignora la numeración del cliente). `borrador: true` para guardar sin emitir. Si la emisión falla, retira el borrador y responde 422 con `detalles`. Sin config o `activo=false` → flujo legacy intacto. |
| `POST /api/invoices/{id}/emitir` | Emite un borrador. Body opcional: `serie`, `tipo_factura` (F1-F3/R1-R5), `operacion_exenta` (E1-E8). |
| `POST /api/invoices/{id}/anular` | Anula una emitida. Body opcional: `ref_externa`. |
| `PATCH /api/invoices/{id}` | Cobro siempre; contenido solo en borradores (409 si emitida). |
| `DELETE /api/invoices/{id}` | Solo borradores (409 si emitida, con indicación de usar anulación). |

Rectificativas: borrador con `rectifica_invoice_id` (+ `tipo_rectificativa` S/I) → emitir con `tipo_factura` R1-R5; usa serie `R` y marca la original como `rectificada`. La UI llegará en V13; la API y el motor quedan completos.

## 5. UI (ajuste mínimo, D-11 intacto)

`/dashboard/facturas`: badge **VERI*FACTU** junto al número en facturas emitidas (tooltip con el aviso de inmutabilidad), chip **Anulada**, y nota de inmutabilidad en el menú de acciones. El modo demo no cambia (sin sesión no hay API ni registros).

## 6. Verificación (2026-09-13)

- `npm test` → **87/87 PASS** (incluye `lib/verifactu/tests/v07-emision.test.mjs`: mapeo, dry-run, round-trip XML determinista).
- `npm run test:db` (PGlite; `npm i --no-save @electric-sql/pglite`) → `supabase/tests/v07-emision.test.mjs`: **74/74 PASS** — vector oficial de huella en SQL, formatos SQL≡TS (importes y fecha-hora-huso invierno/verano), emisión/encadenamiento/outbox, XML reconstruido **validado contra los XSD oficiales AEAT**, inmutabilidad, emisión única sin quemar números, anulación, rectificativa, flag por empresa, aislamiento multi-tenant y bloqueo de suplantación.
- `npm run build` verde; lint sin problemas nuevos (los 7 errores/25 warnings existentes vienen de HEAD).

## 7. Pendiente para items siguientes

- **V08**: QR + leyenda en el PDF (la factura emitida ya tiene `numero_fiscal` e `importe` oficiales para la URL de cotejo).
- **V10**: worker del outbox (lotes ≤1000, `TiempoEsperaEnvio`, reintentos, `Incidencia=S`); usa `reconstruirRegistroAlta/Anulacion` si `xml` es NULL.
- **V12**: subsanación/reenvío (los flags `subsanacion`/`rechazo_previo` existen; el flujo de reenvío genera registros nuevos).
- **V13**: UI completa (borradores, rectificativa, estados de remisión).
- La migración **NO se ha aplicado a producción** (solo fichero, regla del proyecto).
