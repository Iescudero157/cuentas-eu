# Auditoría del flujo de facturación actual (V01)

**Fecha:** 2026-09-07 · **Rama:** `verifactu` · **Ámbito:** cómo emite facturas `cuentas-app` HOY.
Documento de solo lectura: no se cambió código en este item. Base para el diseño del Módulo
Verifactu (RD 1007/2023, Orden HAC/1177/2024, RD-ley 15/2025).

---

## 1. Visión general del stack

- **Framework:** Next.js 16.2.1 (App Router), despliegue en Vercel (`main` → app.kuentas.eu).
- **BD:** Supabase (Postgres + RLS por `user_id`). El cliente del navegador y las API routes
  usan `@supabase/ssr` (`lib/supabase/client.ts` y `lib/supabase/server.ts`) con la sesión del
  usuario (anon key + RLS); no hay service-role en el flujo de facturación.
- **PDF:** `@react-pdf/renderer` en dos variantes: cliente (`components/InvoicePDF.tsx`,
  botón de descarga) y servidor (`lib/pdf/invoice-pdf-server.tsx`, adjunto de email).
- **Email:** Resend (`resend`), remitente `hola@kuentas.eu`, plantilla en `lib/email/templates.ts`.
- **Esquema BD:** NO hay `supabase/migrations/`; solo dos ficheros manuales que se ejecutan a
  mano en el SQL Editor: `supabase/schema.sql` (base) y `supabase/schema-update.sql` (v2).
- **Modo demo:** sin sesión, todo vive en `localStorage` (`lib/storage.ts`, claves `kuentas_*`)
  mezclado con `lib/demo-data.ts` (6 facturas ficticias, 5 de la serie `FACT-2026-…`).

## 2. Diagrama textual del flujo de emisión

```
Usuario (dashboard)
   │
   ▼
/dashboard/facturas/nueva  (app/dashboard/facturas/nueva/page.tsx, "use client")
   │  · calcula nº de factura EN EL CLIENTE (ver §4)
   │  · calcula subtotal/IVA/IRPF/total EN EL CLIENTE
   │  · fecha = "hoy" del navegador; vencimiento = hoy + N días
   ▼
POST /api/invoices  (app/api/invoices/route.ts)
   │  · auth.getUser() → 401 si no hay sesión
   │  · límite plan "gratis": máx. 5 facturas/mes (contadas por rango de `date`)
   │  · INSERT en `invoices` aceptando number/importes TAL CUAL los manda el cliente
   ▼
Tabla `invoices` (Supabase, RLS por user_id)
   │
   ├─► PDF descarga:  components/InvoicePDF.tsx (cliente, on-the-fly, NO se persiste)
   ├─► Email:  POST /api/invoices/[id]/email → Resend + PDF servidor adjunto (NO se persiste)
   ├─► Cobro:  PATCH /api/invoices/[id] {status: cobrada, payment_date}
   │        └─► useInvoices.updateInvoiceStatus crea además una transacción "ingreso"
   │            vía POST /api/transactions (sync cash-flow, no atómico, best-effort)
   └─► Borrado:  DELETE /api/invoices/[id]  (borrado físico, sin restricción)
```

Listado y acciones: `/dashboard/facturas` (`app/dashboard/facturas/page.tsx`) vía hook
`lib/hooks/useInvoices.ts` (GET `/api/invoices`, marca "vencida" automáticamente en cliente
cuando `due_date` pasa, modal de "cobrada" con fecha de pago).

## 3. Modelo de datos implicado

### 3.1 `invoices` (schema.sql + schema-update.sql)

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | `uuid_generate_v4()` |
| user_id | UUID FK auth.users | RLS: select/insert/update/delete propios |
| number | TEXT NOT NULL | **SIN UNIQUE** (ni por user ni global), **SIN serie** |
| client_name / client_nif / client_address / client_email | TEXT | NIF sin validar |
| client_id | UUID FK clients | nullable, ON DELETE SET NULL |
| items | JSONB `[]` | `{description, quantity, unitPrice, total}` — sin desglose de IVA por línea |
| subtotal, iva, irpf, total | DECIMAL(12,2) | los manda el cliente; el servidor no recalcula |
| iva_rate, irpf_rate | INTEGER | **un solo tipo de IVA por factura** (21/10/4/0) |
| date | DATE | fecha de expedición; **no hay hora** (Verifactu exige fecha-hora huso) |
| due_date, payment_date | DATE | vencimiento / cobro |
| status | TEXT CHECK | `cobrada | pendiente | vencida` — no existe "borrador" ni "anulada" |
| payment_method | TEXT CHECK | transferencia/tarjeta/efectivo/domiciliacion/cheque/otro |
| notes | TEXT | notas internas |
| created_at, updated_at | TIMESTAMPTZ | updated_at se pisa a mano en los endpoints |

Índices: `(user_id, date)`, `(user_id, payment_date)`, `(user_id, client_id)`.

### 3.2 Tablas relacionadas

- **`profiles`**: emisor (name, nif, address, tipo_iva/retencion_irpf por defecto, plan).
  El NIF del emisor es opcional y sin validar → una factura puede emitirse sin NIF de emisor.
- **`clients`**: agenda de clientes (los datos se COPIAN a la factura al crearla — bien para
  inmutabilidad del snapshot).
- **`transactions`**: espejo de cash-flow; al marcar "cobrada" se inserta un "ingreso" suelto
  (sin FK a la factura, deduplicación imposible).
- No existe ninguna tabla de series, contadores, registros de facturación, eventos ni huellas.

## 4. Numeración — cómo se genera HOY (crítico)

`app/dashboard/facturas/nueva/page.tsx:179-181`:

```ts
const existingInvoices = loadData<Invoice[]>("kuentas_facturas", []); // localStorage
const nextSeq = existingInvoices.length + 6;                          // +6 = tras las 5 demo de 2026
const nextNumber = `FACT-2026-${String(nextSeq).padStart(3, "0")}`;
```

Consecuencias:

1. **El número se calcula en el navegador contra `localStorage`, NO contra la BD.** Para un
   usuario real (no demo) `kuentas_facturas` está vacío, así que `nextNumber` es **siempre
   `FACT-2026-006`**: todas sus facturas reales salen con el mismo número.
2. `POST /api/invoices` acepta cualquier `number` sin comprobar unicidad, correlatividad ni
   formato; la BD tampoco tiene `UNIQUE (user_id, number)`.
3. El año está **hardcodeado a 2026** y el arranque en 6 depende de los datos demo.
4. No hay concepto de serie (ordinaria/rectificativa) ni numeración por ejercicio.
5. Carrera trivial: dos pestañas generan el mismo número; nada lo impide.

## 5. Endpoints de facturación

| Endpoint | Método | Qué hace | Notas Verifactu |
|---|---|---|---|
| `/api/invoices` | GET | Lista facturas del usuario (filtro `?status=`) | — |
| `/api/invoices` | POST | Crea factura; límite 5/mes en plan gratis; inserta lo que llega | Punto de inserción nº 1 |
| `/api/invoices/[id]` | PATCH | Actualiza status, payment_method/date, client_email, notes, due_date | No permite editar importes/número (bien), pero tampoco registra eventos |
| `/api/invoices/[id]` | DELETE | **Borrado físico** de la factura | Prohibido para facturas emitidas bajo Verifactu |
| `/api/invoices/[id]/email` | POST | Genera PDF servidor y envía por Resend; solo toca `updated_at` | El PDF deberá llevar QR + leyenda |

No hay endpoint de edición de importes ni de rectificativa: una factura mal emitida hoy se
borra y se rehace (patrón incompatible con Verifactu).

Otros flujos que tocan facturación indirectamente:
- `app/api/transactions` (ingresos manuales/OCR): ingresos SIN factura — relevante para el
  modo de negocio, no para el registro de facturación.
- Stripe/Redsys (`app/api/stripe`, `app/api/redsys`): cobro de suscripciones de Kuentas a sus
  usuarios; la facturación de Kuentas como empresa NO pasa por este módulo (fuera de alcance
  de esta auditoría, pero Mercadonet Global S.L. también necesitará cumplir Verifactu por sus
  propias facturas — decisión de negocio aparte).

## 6. PDF y plantillas

- **Cliente** (`components/InvoicePDF.tsx`, 295 líneas): botón "Descargar PDF" con
  `@react-pdf/renderer` en el navegador. **Servidor** (`lib/pdf/invoice-pdf-server.tsx`):
  mismo layout para el adjunto del email.
- Dos implementaciones paralelas del mismo documento → cualquier cambio (QR, leyenda
  "VERI*FACTU", datos obligatorios) hay que hacerlo en DOS sitios, o unificar antes.
- El PDF **no se persiste** en ningún sitio (ni Storage ni BD): se regenera cada vez a partir
  de la fila de `invoices`. Si la fila cambia o se borra, el documento "emitido" deja de ser
  reproducible → conflicto directo con conservación (art. 8 RD 1007/2023).
- Contenido actual: marca KUENTAS.EU fija, emisor (nombre/NIF/dirección de `profiles`),
  cliente, tabla de conceptos, subtotal/IVA/IRPF/total, estado. **Faltan:** QR tributario,
  leyenda VERI*FACTU, serie, y soporta un único tipo impositivo.

## 7. Emails

- `lib/email/templates.ts`: `invoiceEmailTemplate` (HTML de factura) y `fiscalAlertTemplate`.
- `POST /api/invoices/[id]/email` envía con Resend (`from: <nombre emisor> <hola@kuentas.eu>`)
  y adjunta el PDF de servidor. Si el PDF falla, envía sin adjunto (silencioso).
- No queda constancia estructurada del envío (solo pisa `updated_at`; no hay tabla de eventos).

## 8. Riesgos detectados (ordenados por gravedad)

| # | Riesgo | Evidencia |
|---|---|---|
| R1 | **Numeración rota en producción**: todos los usuarios reales generan `FACT-2026-006` repetido; sin UNIQUE en BD; sin serie; año hardcodeado; no atómica (localStorage en cliente) | `nueva/page.tsx:179-181`, `schema.sql:107` |
| R2 | **Borrado físico de facturas emitidas** (`DELETE /api/invoices/[id]`): incompatible con inalterabilidad/trazabilidad exigidas a un SIF | `[id]/route.ts:42-63` |
| R3 | **El servidor confía en los importes del cliente**: subtotal/IVA/IRPF/total llegan calculados del navegador y se insertan tal cual (pueden ser incoherentes entre sí y con `items`) | `invoices/route.ts:90-115` |
| R4 | **Sin fecha-hora de expedición** (`date` es DATE); Verifactu exige fecha, hora y huso del registro de alta | `schema.sql:118` |
| R5 | **PDF no reproducible/conservado**: se regenera on-the-fly; sin QR ni leyenda; lógica duplicada cliente/servidor | §6 |
| R6 | **Sin estados de ciclo de vida fiscal**: no hay borrador/emitida/rectificada/anulada; "pendiente/cobrada/vencida" son estados de cobro, no de emisión. La factura se considera emitida en el INSERT | `schema.sql:120` |
| R7 | **Un solo tipo de IVA por factura** y sin campos de régimen (exención, recargo de equivalencia, operación exenta art. 20…), sin `ImporteTotal` desglosado por tipo como exige el registro de alta | esquema `items` JSONB |
| R8 | **NIF emisor/receptor opcionales y sin validar** (ni formato ni censo); el registro de alta exige NIF emisor válido | `profiles.nif`, `invoices.client_nif` |
| R9 | **Sin migraciones versionadas**: el esquema real de producción solo es reconstruible ejecutando 2 SQL a mano; riesgo de deriva. V03 debe inaugurar `supabase/migrations/` | `supabase/` |
| R10 | Sync factura→transacción no atómico y sin FK (posibles ingresos duplicados/huérfanos en cash-flow) | `useInvoices.ts:163-190` |
| R11 | Modo demo comparte tipos y claves con el modo real (la serie demo contamina la numeración real, ver R1) | `nueva/page.tsx:179`, `demo-data.ts` |
| R12 | Facturación propia de Kuentas (suscripciones Stripe/Redsys) fuera del módulo: pendiente decisión de negocio sobre su cumplimiento Verifactu | §5 |

## 9. Puntos de inserción del Módulo Verifactu

1. **`POST /api/invoices` (emisión)** — punto único de entrada al registro de alta:
   - mover numeración al servidor (secuencia atómica por usuario+serie+ejercicio, vía función
     SQL/RPC con bloqueo), recalcular importes en servidor, validar NIF;
   - generar huella encadenada + registro de alta XML y encolar la remisión AEAT **en la misma
     transacción lógica** que el INSERT (outbox pattern: tabla `verifactu_registros` +
     `verifactu_cola`);
   - separar "guardar borrador" de "emitir": solo emitir dispara Verifactu.
2. **`PATCH /api/invoices/[id]`** — mantener solo campos de cobro para facturas emitidas;
   cualquier corrección de contenido pasa a ser **factura rectificativa** (nuevo flujo + serie
   propia + registro de alta con tipo rectificativa).
3. **`DELETE /api/invoices/[id]`** — eliminar para facturas emitidas; sustituir por **registro
   de anulación** Verifactu + estado `anulada`. El borrado físico solo para borradores.
4. **Generadores de PDF (los dos)** — unificar en el generador de servidor, persistir el PDF
   emitido (Supabase Storage) e incorporar QR tributario + leyenda "VERI*FACTU" (Orden
   HAC/1177/2024) — item V08.
5. **`/dashboard/facturas` y `/nueva`** — UI: selector de serie, estado de remisión AEAT,
   flujo de rectificativa/anulación, bloqueo de edición post-emisión — item V13.
6. **BD** — nuevas tablas (registros, cola, eventos, certificados, series/contadores) SOLO como
   ficheros en `supabase/migrations/` (item V03); sin aplicar contra producción.
7. **Email** — sin cambios estructurales; el adjunto pasará a ser el PDF persistido con QR.

## 10. Inventario de ficheros del flujo actual

| Fichero | Rol |
|---|---|
| `app/api/invoices/route.ts` | GET listado / POST creación (límite plan gratis) |
| `app/api/invoices/[id]/route.ts` | PATCH campos de cobro / DELETE físico |
| `app/api/invoices/[id]/email/route.ts` | Envío Resend + PDF adjunto |
| `app/dashboard/facturas/page.tsx` | Listado, cobrar/pendiente/vencida, descarga PDF |
| `app/dashboard/facturas/nueva/page.tsx` | Formulario de emisión + numeración cliente + preview |
| `lib/hooks/useInvoices.ts` | Hook CRUD + sync cash-flow + envío email |
| `components/InvoicePDF.tsx` | PDF en navegador (descarga) |
| `lib/pdf/invoice-pdf-server.tsx` | PDF en servidor (adjunto email) |
| `lib/email/templates.ts` | Plantillas HTML (factura, alertas fiscales) |
| `lib/types.ts` | Tipos `Invoice`, `InvoiceItem`, `InvoiceStatus`, `PaymentMethod` |
| `lib/storage.ts`, `lib/demo-data.ts` | Modo demo (localStorage) |
| `supabase/schema.sql`, `supabase/schema-update.sql` | Esquema manual (sin migraciones) |
