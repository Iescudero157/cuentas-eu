# Seguridad del módulo Verifactu (V24 · Hardening)

Revisión de seguridad integral del módulo (2026-09-24): RLS y migraciones,
secretos, validación XML/SOAP, custodia de certificados, rate limiting y
logging. Complementa el modelo de amenazas de la custodia en
`SEGURIDAD-CERTS.md`. Todo lo corregido en V24 lleva la etiqueta **[V24]**.

## 1. Resumen ejecutivo

La auditoría (3 pasadas independientes: rutas API, secretos/logging, XML/RLS)
no encontró fugas de material criptográfico ni IDOR entre tenants. Se
corrigieron en V24 dos hallazgos de severidad alta y una docena de media/baja:

| Sev. | Hallazgo | Corrección [V24] |
|------|----------|------------------|
| ALTA | `POST /api/invoices/[id]/email` era un relay: destinatario arbitrario + HTML sin escapar, firmado por DKIM de kuentas.eu | Destinatario restringido al cliente de la factura o al propio emisor; escape HTML de TODO dato de usuario en la plantilla; display name saneado; mensaje ≤1000 chars; 20 envíos/h/usuario |
| ALTA | `sif_registros.xml` fijado vía `sif_fijar_xml` (ejecutable por `authenticated`, sin validación posible en SQL) se remitía a AEAT y se exportaba SIN verificar | `remision.ts` y `export.ts` tratan el XML fijado como caché: SIEMPRE regeneran el XML determinista desde el jsonb, verifican la huella y exigen coincidencia byte a byte; divergencia = error de integridad y el lote no sale |
| ALTA | `GRANT UPDATE` de tabla completa en `sif_config` permitía al tenant desactivar su remisión (activo/proximo_envio_desde/circuito), saltarse el control de flujo o auto-activarse contra producción AEAT | Migración `20260924100000_sif_hardening.sql`: trigger `sif_config_guard_control` reserva el plano de control al backend (auth.uid() nulo); el usuario solo gestiona identificación. 36 tests PGlite |
| MEDIA | `cron/fiscal-alerts` quedaba ABIERTO si `CRON_SECRET` no estaba definido (`Bearer undefined`) | `autorizacionCronValida()`: fail-closed + comparación timing-safe, aplicada a los 4 endpoints con CRON_SECRET |
| MEDIA | Sin rate limiting en ninguna ruta (PKCS#12 como oráculo de contraseña, export ZIP, PDF, email) | Limitador en memoria por ventana fija (`lib/verifactu/seguridad-http.ts`) en certificado POST, export, export CC, PDF, email y declaración responsable (por IP) |
| MEDIA | `error.message` de Postgres devuelto al navegador en ~12 rutas (incl. errores sobre `sif_certificados`) | Mensajes genéricos al cliente; detalle a `console.error` de servidor |
| MEDIA | Cuerpos JSON sin tope (el límite de 256 KB del certificado se comprobaba DESPUÉS de bufferizar) | Pre-check por `Content-Length` (`cuerpoExcedeLimite`), try/catch de JSON y tope de 500 líneas en `items` |
| MEDIA | En Node, `ca` SUSTITUYE el almacén de confianza (el comentario decía «añade») | El transporte concatena `tls.rootCertificates` + CA extra; `rejectUnauthorized` sigue activo |
| MEDIA | Respuesta HTTP de la AEAT acumulada sin límite; timeout solo de inactividad de socket | Tope de 20 MB con destroy + temporizador de petición completa (anti slow-drip) |
| BAJA | `cuerpo`/`causa` de los errores del cliente AEAT (XML con NIF/importes) se volcarían ante un futuro `console.error(e)`/`JSON.stringify(e)` | Propiedades NO enumerables (siguen accesibles explícitamente) |
| BAJA | Parser XML: sin tope de tamaño/anidamiento; `&#x110000;` lanzaba `RangeError` no tipado | Topes 20 MB / 256 niveles; solo code points válidos en XML 1.0 (→ `ErrorXml`) |
| BAJA | Caracteres de control ilegales en XML 1.0 en textos libres → la AEAT rechazaría el lote entero | `validarTexto` los rechaza en la validación previa a la emisión |
| BAJA | `.gitignore` no cubría `*.pfx`/`*.p12`; `GET /api/invoices` sin límite ni enum; `?user=` de integridad sin validar UUID; `contact` serializaba la respuesta OAuth completa | Todo corregido |

Sin cabeceras de seguridad globales → añadidas en `next.config.ts` (nosniff,
X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS 2 años).

## 2. Controles por capa

### 2.1 Base de datos (RLS, inmutabilidad)

- **RLS multi-tenant** en todas las tablas `sif_*`: policies `auth.uid() = user_id`
  solo de SELECT (append-only); escritura revocada a `anon`/`authenticated`.
  `sif_certificados` es deny-all real (ni SELECT). **[V24]** `anon` sin
  privilegio alguno en las 7 tablas (revocación explícita, inmune a default
  privileges heredados).
- **Inmutabilidad por triggers de tabla** (`sif_registros`, `sif_eventos`,
  `sif_certificados`): aplican a TODOS los roles, incluido `service_role`.
- **`FORCE ROW LEVEL SECURITY`: evaluado y descartado a propósito.** Las
  funciones `sif_*` SECURITY DEFINER se ejecutan como propietario y necesitan
  escribir en tablas sin policies de escritura; con FORCE, la emisión dejaría
  de funcionar. La inalterabilidad la garantizan los triggers (capa que sí
  cubre al owner) — decisión documentada también en la propia migración V24.
- **Funciones SECURITY DEFINER**: todas con `set search_path` y referencias
  schema-calificadas; las de remisión/eventos son service-only (`EXECUTE`
  revocado + guard `SIF_SOLO_SERVICIO`).
- **[V24] Plano de control de `sif_config`** (activo, entorno_aeat, modalidad,
  tiempo_espera_envio, proximo_envio_desde, fallos_consecutivos,
  circuito_abierto_hasta, certificado_ref, fechas inicio/fin): solo backend.
- **Riesgo residual aceptado (documentado):** el patrón
  `auth.uid() is not null and auth.uid() <> p_user_id` de las funciones de
  usuario confía en `p_user_id` cuando `auth.uid()` es NULL. Solo explotable
  con un JWT `authenticated` sin claim `sub`, que GoTrue no emite. Pendiente
  de endurecer si se añade otra vía de emisión de tokens.

### 2.2 XML / SOAP

- Parser propio `xml-ligero.ts`: DOCTYPE/DTD **rechazados** (inmune a XXE y
  billion-laughs por construcción), iterativo (sin stack overflow), CDATA sin
  re-decodificar. **[V24]** topes de 20 MB / 256 niveles y validación de
  referencias numéricas contra los rangos de XML 1.0.
- Generación: TODO texto pasa por `escaparXml` (5 caracteres reservados, `&`
  primero) vía el serializador único; verificado con grep exhaustivo de
  template literals. **[V24]** caracteres de control rechazados en validación.
- `firmaXmlDs` (eventos V06) es un punto de inyección deliberado para la firma
  XAdES de V14: solo se acepta de fuentes de servidor confiables (hoy solo
  tests; sin llamadores en producción).
- **[V24]** El XML fijado en BD nunca se remite/exporta sin regenerar y
  contrastar (ver §1).

### 2.3 Transporte AEAT (mTLS)

- TLS ≥ 1.2, `rejectUnauthorized` activo (verificado: no se desactiva en
  ninguna parte), endpoints SOLO de constantes del WSDL (sin SSRF: el tenant
  únicamente elige entre los enum `entorno`/`tipoCertificado`;
  `VERIFACTU_URL_OVERRIDE` solo de entorno). Node https no sigue redirects.
- **[V24]** CA extra ADITIVA (root store + extra), tope de respuesta 20 MB,
  timeout de petición completa.

### 2.4 Secretos y custodia de certificados

- Ningún `.env*` trackeado en git (verificado en los 64 commits del histórico);
  fixtures de tests verificados como autofirmados de prueba. **[V24]**
  `*.pfx`/`*.p12` en `.gitignore` con excepción explícita del fixture.
- Custodia V11: AES-256-GCM, KEK solo en env, AAD por fila/tenant, sobres con
  rotación de KEK; ni la KEK ni el material aparecen en logs/errores (auditado
  módulo a módulo). Riesgo residual A6 (material en heap sin zeroizar) ya
  documentado en SEGURIDAD-CERTS.md.
- **[V24]** Subida de PKCS#12 con rate limit (5/15 min/usuario): el parseo con
  contraseña es un oráculo; el throttling corta la fuerza bruta casual.
- **PENDIENTE IVAN (operación, no código):** retirar del árbol de trabajo los
  volcados `vercel env pull` (`.env.local.kuentas`, `.env.vercel.current`,
  `.env.vercel.test`) — están ignorados por git pero contienen secretos reales
  en disco. No los borra este ítem por prudencia (pueden ser la copia de
  trabajo actual).

### 2.5 Autenticación de rutas y rate limiting

- Rutas de usuario: sesión Supabase + filtro `user_id` explícito + RLS (doble
  capa; sin IDOR — auditadas las 16 rutas). Rutas internas: Bearer
  `CRON_SECRET` **[V24]** fail-closed y timing-safe (`autorizacionCronValida`).
- **[V24] Rate limiting** (`lib/verifactu/seguridad-http.ts`, ventana fija en
  memoria): certificado POST 5/15min · export Verifactu 3/10min · export CC
  6/h · PDF factura 60/h · email factura 20/h · declaración responsable
  10/min/IP. **Limitación conocida:** el estado es por instancia serverless
  (en Vercel el límite efectivo es N × instancias). Suficiente contra abuso
  casual y bucles del frontend; un límite global exigiría KV/Upstash (recurso
  de pago → decisión de Iván si el volumen lo justifica).
- Cuerpos: pre-check por Content-Length; Vercel corta a ~4,5 MB en plataforma.

### 2.6 Logging y fugas de información

- Cero `console.*` en `lib/verifactu` (política deliberada); los scripts CLI
  no imprimen credenciales; los `.ps1` usan el almacén de Windows (clave no
  exportable, solo thumbprint).
- **[V24]** Errores de BD nunca al cliente (mensaje genérico + log servidor);
  cuerpos AEAT no enumerables en errores; `contact` ya no serializa la
  respuesta del endpoint OAuth de Google.
- Nota operativa: los scripts de conformidad (V18) dejan XML de facturas DE
  PRUEBA en `%TEMP%` sin limpiar, y `verifactu-conformidad.mjs` contiene un
  NIF personal como destinatario de pruebas. Ambos ficheros pertenecen al
  trabajo V18 sin commitear (no se tocan desde V24); anotado para su sesión.

### 2.7 Cabeceras HTTP globales **[V24]**

`next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
(cámara/micro/geo off), `Strict-Transport-Security` 2 años + subdominios.
**CSP pendiente a propósito**: exige inventariar los inline scripts/styles de
Next/Tailwind; añadirla a ciegas rompería la app. Candidata a un ítem futuro
(empezar con `Content-Security-Policy-Report-Only`).

## 3. Verificación

- `npm test`: 247/247 (17 nuevos en `lib/verifactu/tests/v24-seguridad.test.mjs`:
  timing-safe/fail-closed, limitador, Content-Length, escape HTML del email,
  topes del parser, caracteres de control, no-enumerabilidad de cuerpos AEAT;
  además los tests V10 ahora exigen el contrato «XML fijado = regenerado»).
- `npm run test:db`: 57+74+70+37+62+80+36 = **416/416** (36 nuevos en
  `supabase/tests/v24-hardening.test.mjs`: guard de sif_config por columna,
  INSERT solo con valores seguros, control total del backend, anon sin
  privilegios en las 7 tablas, idempotencia de la migración).
- `npm run build` verde; lint limpio en todos los ficheros tocados.
- Migración `20260924100000_sif_hardening.sql` NO aplicada a producción
  (regla V03: solo ficheros).

## 4. Pendientes / riesgos aceptados

1. **Rate limit global** (KV/Upstash/WAF) si el volumen lo pide — coste.
2. **CSP** (report-only primero) — ítem propio.
3. **KMS/HSM para la KEK** — ya anotado en V11 como evolución.
4. Guard `auth.uid()` NULL en funciones de usuario (§2.1) — defensa en
   profundidad adicional, sin vector conocido hoy.
5. Retirada de los volcados `.env.*` del árbol (Iván, ver §2.4).
6. Limpieza de `%TEMP%` y NIF de pruebas en los scripts V18 (sesión V18).
