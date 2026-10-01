# Lanzamiento del módulo Verifactu — PR, checklist y plan de salida de mantenimiento

Fecha: 2026-09-25 · Rama `verifactu` · Equipo ARES2.
**Estado: BLOQUEADO — listo para lanzar, necesita OK de Iván.** Este documento
prepara el lanzamiento; NO ejecuta merge ni despliegue (regla del ítem 26-lanzamiento).

---

## 1. Changelog `verifactu` → `main` (V01–V26)

Todo verificado con build verde y suites completas: **247/247 `npm test` · 416/416
`npm run test:db` (PGlite)**. Prueba EN VIVO contra el portal de pruebas AEAT superada
(V17 y V26: `EstadoEnvio Correcto`, CSV, cotejo QR «Encontrada»).

| Ítem | Qué aporta |
|---|---|
| V01 | Auditoría de la facturación existente (`docs/verifactu/ARQUITECTURA-FACTURACION.md`): riesgos (numeración en cliente, DELETE físico, importes del cliente) y 7 puntos de inserción. |
| V02 | Especificación técnica `SPEC.md` con cita normativa BOE/AEAT (RD 1007/2023, Orden HAC/1177/2024) y decisiones D-01..D-13. |
| V03 | 5 migraciones SIF: `sif_config`, `sif_series` + reserva atómica de número, `sif_cadena`/`sif_registros` append-only (inmutabilidad en 3 capas), `sif_outbox`, `sif_eventos`, estados fiscales en `invoices`. |
| V04 | Librería de huella encadenada SHA-256 (`lib/verifactu/huella.ts`) exacta al doc oficial AEAT v0.1.2; vectores oficiales en tests. |
| V05 | XML `RegistroAlta` validado contra los XSD oficiales (descargados a `docs/verifactu/xsd/`), validación completa (NIF, listas, rectificativas, aritmética) y adaptador invoices→registro. |
| V06 | XML `RegistroAnulacion` y `RegistroEvento` (11 tipos) con sus cadenas; la anulación sustituye al DELETE (D-12). |
| V07 | Servicio de emisión: UNA transacción Postgres (`sif_emitir_factura`) con lock de cadena, correlativo, huella SQL≡TS, outbox; APIs `/emitir`, `/anular`; PATCH/DELETE de emitidas → 409. |
| V08 | QR tributario oficial (doc AEAT v0.5.0) + leyenda en el PDF de servidor (`GET /api/invoices/[id]/pdf`, fuente única); cotejo verificado en vivo. |
| V09 | Cliente SOAP AEAT con mTLS (`aeat-cliente.ts`), endpoints confirmados contra el WSDL oficial, parseo completo de respuestas y errores tipados. |
| V10 | Cola de remisión: worker con lotes ≤1000, `TiempoEsperaEnvio`, backoff, circuit breaker, rescate de zombis; cron `GET /api/cron/verifactu-remision` (vercel.json, CRON_SECRET; cadencia: §2.4). |
| V11 | Custodia de certificados PKCS#12 cifrados AES-256-GCM (KEK en env, rotación), subida en Ajustes, cliente AEAT por obligado. |
| V12 | Subsanación/reenvío (`Subsanacion=S`, `RechazoPrevio=S`), detección de anomalías SQL≡TS, eventos de incidencia, CLI `verifactu:verificar`. |
| V13 | Panel `/dashboard/verifactu`: config, cadena, cola, registros con filtros/CSV, eventos, botón «Subsanar y reenviar». |
| V14 | Decisión DEC-V14: v1 solo VERI*FACTU (`TipoUsoPosibleSoloVerifactu='S'`); modo local pospuesto a F5/2027. |
| V15 | Multi-tenant y concurrencia: orden global de locks (elimina un interbloqueo real), aislamiento entre obligados, carreras y ráfaga de 100 facturas sin huecos. |
| V16 | Conservación y export ZIP en formato oficial de remisión con manifest SHA-256 y re-verificación de huellas independiente de BD; `CONSERVACION.md`. |
| V17 | Prueba EN VIVO portal de pruebas AEAT (alta+anulación `Correcto`, cotejo QR); scripts `verifactu:prueba-aeat`; `ENTORNO-PRUEBAS.md`. |
| V19 | Declaración responsable (art. 15 Orden): fuente única TS, página pública `/verifactu`, PDF descargable, **BORRADOR** hasta ratificación. |
| V20 | Legales de kuentas.eu (aviso legal §8, privacidad §9, términos §13) + 19 redirecciones 301; **[REVISIÓN IVAN/ASESOR]**, mantenimiento intacto. |
| V21 | Ayuda de usuario `/dashboard/verifactu/ayuda`: guía de activación en 5 pasos, 6 estados de remisión, FAQ (13). |
| V22 | Export contable ClassicConta/AIG (Protocolo Conta6: diario 869 / subcuentas 444), gated a plan Business, verificado contra importación real en CC7. |
| V24 | Hardening: email sin relay, XML fijado re-verificado byte a byte, `sif_config` plano de control solo backend, CRON_SECRET fail-closed, rate limiting, headers de seguridad; `SEGURIDAD.md`. |
| V26 | Alta de Mercadonet (primer cliente real) ensayada con las migraciones reales + 2 facturas de PRUEBA remitidas EN VIVO (`Correcto`, cotejo «Encontrada»); `ALTA-MERCADONET.md`. |

**Qué NO incluye el PR** (trabajo de otra sesión aún sin commitear en el árbol local:
V18 batería de conformidad, V23 app Android, V25 QA integral — `docs/verifactu/CONFORMIDAD.md`,
`APP-ANDROID.md`, `QA-FINAL.md`, `lib/verifactu/errores-aeat.ts`, tests v18, scripts de
conformidad y retoques a migraciones/SPEC). Se commiteará desde su propia sesión; el PR
puede actualizarse después (mientras no se mergee, sigue entrando en la misma rama).

---

## 2. Checklist de despliegue (ejecutar EN ORDEN el día del lanzamiento)

### 2.1 Base de datos (Supabase producción)
- [ ] Backup/branch previo de la BD de producción.
- [ ] Aplicar las **11 migraciones SIF** de `supabase/migrations/` en orden de timestamp:
  `20260911100000_sif_config` → `100100_sif_series_numeracion` → `100200_sif_cadena_registros`
  → `100300_sif_outbox_eventos` → `100400_invoices_estados_fiscales` → `20260913100000_sif_emision`
  → `20260918100000_sif_remision` → `110000_sif_certificados` → `20260919100000_sif_incidencias`
  → `110000_sif_multitenant` → `20260924100000_sif_hardening`.
  (Ojo: si el trabajo pendiente de V18 retoca migraciones, commitearlo ANTES y aplicar la versión final.)
- [ ] Verificar: tablas `sif_*` presentes, RLS activo, `SELECT sif_emitir_factura` existe,
  y `sif_config` vacío (ningún tenant activo aún).

### 2.2 Variables de entorno (Vercel, entorno Production)
| Variable | Obligatoria | Notas |
|---|---|---|
| `CRON_SECRET` | Sí | Bearer de los crons y endpoints internos; fail-closed (V24). Generar: `openssl rand -hex 32`. |
| `VERIFACTU_CERT_KEK_BASE64` | Sí | KEK de custodia de certificados (V11). Generar: `openssl rand -base64 32`. Guardar copia en el gestor de secretos de Iván. |
| `VERIFACTU_CERT_KEK_ANTERIOR_BASE64` | No | Solo durante rotación de KEK. |
| `VERIFACTU_CERT_PFX_BASE64` + `VERIFACTU_CERT_PFX_PASSWORD` | No* | Certificado global de respaldo (modelo B, representante). *Necesaria si algún obligado remite sin certificado propio custodiado. |
| `VERIFACTU_CERT_TIPO` | No | `normal` (defecto) o `sello` (endpoint www10). |
| `VERIFACTU_URL_OVERRIDE` / `VERIFACTU_TIMEOUT_MS` | No | Solo diagnóstico/plan B de transporte (DEC V09). |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Ya existen | Sin cambios. |
| `RESEND_API_KEY` | Ya existe | Email de facturas (PDF con QR adjunto). |

### 2.3 Certificado digital (decisión + material de Iván)
- [ ] PFX **exportable** del certificado FNMT de representante de Mercadonet (el del equipo
  ARES2 tiene clave NO exportable: solo vale para pruebas locales) **o** sello de entidad FNMT.
- [ ] Decidir modelo: certificado por obligado subido en Ajustes (A) vs. respaldo global en env (B).
- [ ] Subir el PKCS#12 en Ajustes → tarjeta Verifactu del tenant (valida contraseña, NIF y caducidad).

### 2.4 Cron de remisión
- **Verificado 25-09-2026**: con el cron a `* * * * *`, el deploy de Vercel **FALLA por completo**
  en plan Hobby («Hobby accounts are limited to daily cron jobs») — el preview del PR #1 falló con
  ese error (comentario de vercel[bot] en el PR). No era solo una limitación de cadencia: bloqueaba
  cualquier despliegue de la rama, incluido el de producción el día del merge.
- `vercel.json` trae ahora `/api/cron/verifactu-remision` a `0 3 * * *` (diario, válido en Hobby,
  red de seguridad). La cadencia por minuto que exige la remisión VERI*FACTU se cubre con UNA de:
  - [ ] **Opción A (Pro)**: contratar Vercel Pro y devolver el schedule a `* * * * *` (decisión de
    gasto de Iván).
  - [ ] **Opción B (sin coste)**: disparo externo por minuto con `Authorization: Bearer $CRON_SECRET`
    desde el Programador de Windows de ARES2 o el NAS — script listo:
    `scripts/verifactu-cron-externo.ps1` (`-Instalar` registra la tarea `KuentasVerifactu-Remision`;
    NO instalada aún: el endpoint no está desplegado).
- [ ] Tras desplegar: `GET /api/verifactu/estado-remision` (Bearer) responde y la cola está a cero.
- [ ] Tras desplegar: `GET /api/verifactu/estado-remision` (Bearer) responde y la cola está a cero.

### 2.5 Merge y despliegue de la app
- [ ] **OK explícito de Iván** (este es el bloqueo).
- [ ] Commitear antes el trabajo pendiente V18/V23/V25 desde su sesión (o decidir excluirlo del v1).
- [ ] Ratificar declaración responsable (V19: poner `DECLARACION_ES_BORRADOR=false` tras revisión
  jurídica) y legales V20 — pueden ir en el mismo PR antes del merge.
- [ ] Mergear el PR `verifactu` → `main` (squash NO recomendado: el historial por ítem documenta la trazabilidad SIF). Vercel despliega `main` a app.kuentas.eu.
- [ ] Smoke test en producción: login, `/dashboard/verifactu` (módulo inactivo), `/verifactu` pública, PDF de declaración responsable, emisión legacy intacta (ningún tenant con `sif_config.activo`).
- [ ] Alta de Mercadonet como primer obligado según `ALTA-MERCADONET.md` §2 (SQL de `--sql`), `entorno_aeat='pruebas'` primero; a `produccion` cuando Iván lo decida (obligación: IS 01-01-2027, resto 01-07-2027).

### 2.6 Rollback
- El módulo es **opt-in por tenant**: sin filas activas en `sif_config` la app se comporta como el flujo legacy → riesgo de regresión bajo.
- Si falla el despliegue: revert del merge en `main` (Vercel redespliega). Las migraciones son aditivas (tablas/funciones nuevas + triggers sobre `invoices`); no borrar datos SIF una vez haya registros reales (append-only legal).

---

## 3. Plan de retirada del mantenimiento de kuentas.eu (repo GitLab)

Estado actual: `.gitlab-ci.yml` publica SOLO `mantenimiento.html` y `_redirects` tiene el
bloque `MANTENIMIENTO ACTIVO (7-sep-2026)`. **Nada de esto se toca hasta el OK.**

Pasos (≈15 min, tras el merge de la app):
1. `git pull` del repo `kuentas-2026-03-22-zmq64`.
2. Activar la landing de relanzamiento: `cp index-relanzamiento.html index.html`
   (la landing ya está commiteada SIN publicar; conservar el index anterior, p. ej. `git mv index.html index-pre-verifactu.html` antes si se quiere referencia).
3. `.gitlab-ci.yml`: en los DOS jobs (`pages` y `aviso-rama-no-desplegable`) borrar el bloque
   `script` de mantenimiento y descomentar el `script ORIGINAL` (están marcados con
   `===== MANTENIMIENTO ACTIVO =====`).
4. `_redirects`: eliminar el bloque completo desde `# ===== MANTENIMIENTO ACTIVO` hasta `# =====fin=====`.
5. (V19) Cuando la declaración responsable esté ratificada: quitar el `noindex` de `verifactu.html`.
6. Commit + push a `main` → esperar pipeline `success`.
7. Verificar EN VIVO: `https://kuentas.eu/` sirve la landing nueva (no el aviso), `/precios.html`,
   `/aviso-legal.html`, `/verifactu.html` responden 200, y el 404 vuelve a ser `404.html`.
8. Reabrir el registro de la app: revertir el commit `0c76605` («Mantenimiento: suspender altas»)
   en `cuentas-app` para restaurar `/registro`.
9. SEO: ping sitemap en Search Console + IndexNow (clave en el repo).

---

## 4. PR `verifactu` → `main`

- PR en **borrador** (draft) en `github.com/Iescudero157/cuentas-eu` con este changelog como
  descripción. Marcarlo «Ready for review» y mergear = paso 2.5, SOLO con el OK de Iván.
- La rama `verifactu` sigue siendo la de trabajo: cualquier commit posterior (V18/V23/V25,
  ratificación V19) entra automáticamente al mismo PR.
