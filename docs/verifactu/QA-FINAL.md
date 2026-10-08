# QA-FINAL — QA integral del Módulo Verifactu de Kuentas (V25)

Fecha: 2026-09-24 · Rama: `verifactu` (HEAD tras V24 + recuperación V18/V23) · Equipo: ARES2.

Alcance: recorrido completo del módulo (alta empresa → configuración SIF → emisión →
QR → remisión → panel → export), checklist contra `SPEC.md` (V02) y la Orden
HAC/1177/2024, y veredicto final. Complementa, no sustituye, las verificaciones por
ítem documentadas en `docs/verifactu/*.md` y en `PROGRESO.md` del motor.

---

## 1. Veredicto

**CONFORME** (software). El módulo Verifactu de Kuentas cumple, con evidencia
verificable, los requisitos del RD 1007/2023 (RRSIF), de la Orden HAC/1177/2024 y del
doc. técnico de la AEAT para la modalidad VERI\*FACTU elegida (DEC-V14).

El veredicto es de **conformidad del software**: la puesta en producción sigue
condicionada a los pasos operativos y de negocio de la sección 7, que son de Iván
(ninguno es un defecto del código).

## 2. Metodología y entorno

- Verificación automática completa sobre el árbol de trabajo (working tree = HEAD
  de `verifactu` + trabajo recuperado de V18/V23, ver §6).
- Recorrido funcional local con `next start` (build de producción, puerto 3100) con
  el entorno real de la app; **solo lecturas** (las migraciones SIF no están aplicadas
  a la BD de producción, a propósito).
- Batería de conformidad EN VIVO contra el portal de pruebas de la AEAT
  (prewww1.aeat.es) con el certificado FNMT de representante de Mercadonet
  (almacén de Windows, curl/Schannel como en V17): ver §5.
- Flujo con base de datos verificado con las baterías PGlite (Postgres embebido con
  entorno Supabase simulado: roles, RLS, auth.uid()), que ejercitan las migraciones
  reales fichero a fichero.

## 3. Resultados de la verificación automática

| Verificación | Resultado |
|---|---|
| `npm run build` (Next.js 16, producción) | ✅ exit 0 |
| `npm test` (unitarias + XSD oficiales + vectores AEAT) | ✅ 247/247 |
| `npm run test:db` (PGlite: V03+V07+V10+V11+V12+V15+V24) | ✅ 416/416 (57+74+70+37+62+80+36) |
| `npm run lint` | ⚠️ 6 errores **preexistentes y ajenos al módulo** en `app/(auth)/registro/page.tsx` (documentados desde V09, commit e1a685d); 0 errores en código Verifactu |
| Validación XML contra XSD oficiales AEAT (7 esquemas, `docs/verifactu/xsd/`) | ✅ integrada en `npm test` (xmllint-wasm) |
| Vectores oficiales de huella (doc AEAT v0.1.2 §6.1-6.3) | ✅ en `npm test` (V04) y en SQL (pgcrypto, V07) |

## 4. Recorrido funcional (paso → evidencia)

Recorrido del ítem V25 («alta empresa → config SIF → emitir → QR → remisión →
panel → export») con la evidencia que lo cubre. La parte con BD corre sobre las
migraciones reales en PGlite porque la BD de producción no tiene (a propósito) el
esquema SIF aplicado; la parte HTTP/UI se probó EN VIVO en local (`next start`).

| Paso | Evidencia | Estado |
|---|---|---|
| Alta empresa + config SIF (`sif_config`, series, plano de control) | PGlite V03 (57) + V24 (36): RLS, grants, activación solo backend, tenant no puede auto-activarse ni pasarse a producción AEAT | ✅ |
| Certificado (subida PKCS#12, custodia cifrada AES-256-GCM) | PGlite V11 (37) + unit V11 (22); API `/api/verifactu/certificado` responde 401 sin sesión (vivo) | ✅ |
| Emitir (transacción única, correlativo, huella, outbox, borrador→emitida) | PGlite V07 (74) + V15 (80: carreras, 100 facturas en ráfaga sin huecos); huella SQL≡TS | ✅ |
| Rectificativa / anulación / subsanación | PGlite V07+V12 (62); casos 05, 06, 10, 12 de la batería en vivo (§5) | ✅ |
| QR + leyenda en PDF | unit V08 (16, ejemplos oficiales byte a byte); cotejo ValidarQR EN VIVO (§5, caso 14); PDF de servidor fuente única | ✅ |
| Remisión (lotes ≤1000, TiempoEsperaEnvio, backoff, duplicados, circuit breaker) | PGlite V10 (70) + unit V09/V10 (34, mock mTLS que exige certificado); remisión REAL en §5 con control de flujo respetado | ✅ |
| Panel Verifactu + ayuda | build de las rutas ✅; APIs `/api/verifactu/panel|registros|eventos` 401 sin sesión (vivo); UI verificada en V13/V21 | ✅ |
| Export conservación (ZIP formato oficial + verificación independiente) | unit V16 (14): re-verificación de huellas sobre el fichero exportado; `/api/verifactu/export` 401 sin sesión (vivo) | ✅ |
| Export contable ClassicConta/AIG | unit V22 (22, layout contrastado con ficheros reales importados en CC7) | ✅ |
| Declaración responsable visible (art. 13.2 RRSIF) | EN VIVO local: `/verifactu` 200 con noindex + marca BORRADOR; PDF `application/pdf` 200 sin sesión; enlace en footer | ✅ (borrador, §7) |
| App Android (QR/leyenda) | `APP-ANDROID.md` (V23): wrapper Capacitor sobre app.kuentas.eu en vivo → hereda QR/leyenda del PDF de servidor sin rebuild | ✅ |
| Seguridad en vivo (V24) | Headers globales presentes (nosniff, DENY, HSTS, Referrer-Policy, Permissions-Policy); cron/integridad/estado-remision 401 fail-closed; POST /api/invoices 401 | ✅ |
| Web kuentas.eu | EN VIVO: sigue en mantenimiento (no retirado); legales V19/V20 committeados a la espera de revisión | ✅ |

## 5. Batería de conformidad EN VIVO (V18, completada en V25)

La sesión V18 (20-sep) dejó la batería a medias (solo casos 01-02 con respuesta).
En V25 se ha reejecutado COMPLETA con plan nuevo (series `PRUEBA-V18*-20260924171013`)
contra prewww1.aeat.es. Casos y metodología: `CONFORMIDAD.md`.

<!-- RESULTADOS-BATERIA -->

## 6. Estado del árbol: trabajo recuperado de V18/V23

Las sesiones V18 (batería) y V23 (app Android) murieron sin commitear. V25 ha
auditado ese trabajo, lo ha verificado (tests V18 incluidos en los 247; catálogo de
errores AEAT con test de sincronía SHA-256 contra el fichero oficial) y lo ha
commiteado de forma diferenciada antes del commit de QA. Incluye además el fix de
migraciones «grants explícitos» (cambio de Supabase del 30-oct-2026: las tablas
nuevas de `public` ya no reciben grants por defecto), cubierto por asserts en PGlite.

## 7. Pendientes que condicionan la puesta en producción (ninguno es defecto del software)

Decisiones/acciones de **Iván** (consolidado de PROGRESO.md):

1. **Aplicar las 11 migraciones** de `supabase/migrations` a producción (o a un
   Supabase preprod primero, recomendado) — hasta entonces el módulo no puede
   activarse para ningún cliente.
2. **Certificado en la app**: PFX exportable (copia FNMT o sello de entidad) para
   custodia V11 en Vercel; el del almacén de Windows no es exportable.
3. **KEK V11**: `openssl rand -base64 32` → env `VERIFACTU_CERT_KEK_BASE64` en Vercel.
4. **CRON_SECRET** en Vercel y **plan Vercel Pro** (cron `* * * * *` de remisión; en
   Hobby solo diarios; alternativa: disparo externo con el mismo Bearer).
5. **Declaración responsable**: revisión jurídica y ratificación
   (`DECLARACION_ES_BORRADOR=false`), IdSistemaInformatico «01», domicilio, firmante.
6. **Legales kuentas.eu** (V19/V20): revisión Iván/asesor y levantar el mantenimiento.
7. **Ratificar DEC-V14** (solo VERI\*FACTU en v1) y el flujo comercial de
   activación por cliente (`sif_config.activo`, canal hola@kuentas.eu vs kuentas@).
8. **Higiene** (V24 §4): retirar los volcados `.env.*` del árbol de trabajo, CSP
   report-only, rate limit global con KV si crece el tráfico.
9. **ClassicConta**: importación real de un ZIP Kuentas cuando se reactive la
   suscripción CC7 (layout ya contrastado con ficheros reales).

Limitaciones de prueba documentadas (aceptadas): multi-tenant contra el portal AEAT
no ejercitable con un solo NIF censado (cubierto por V15 en PGlite); concurrencia
multi-sesión contra Postgres real pendiente de preprod (guardas de orden de locks +
V15); recorrido de UI con sesión y BD SIF real pendiente del preview con Supabase
preprod (paso 1).

## 8. Referencias

- `SPEC.md` (V02) — especificación con citas normativas (BOE consolidado + sede AEAT).
- `CONFORMIDAD.md` (V18) — casos y resultados de la batería en vivo.
- `SEGURIDAD.md` (V24), `SEGURIDAD-CERTS.md` (V11) — hardening y modelo de amenazas.
- `DECISIONES.md` — DEC-V14 (solo VERI\*FACTU), DEC-V16 (conservación).
- Artefactos de la batería: `verifactu-engine/verifactu-logs/v18-conformidad/` (ARES2).
