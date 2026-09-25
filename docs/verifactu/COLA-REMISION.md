# Cola de remisión VERI*FACTU (V10)

Worker que remite a la AEAT los registros encolados en `sif_outbox` por la
emisión (V07), usando el cliente SOAP mTLS de V09. Base legal: art. 16.1 RRSIF
(remisión continua) y art. 16 Orden HAC/1177/2024 (control de flujo
`TiempoEsperaEnvio`, lotes ≤1000, reintentos al menos una vez por hora,
`Incidencia=S`). SPEC.md §5.3–§5.5.

## Piezas

| Pieza | Fichero |
|---|---|
| Funciones SQL atómicas | `supabase/migrations/20260918100000_sif_remision.sql` |
| Worker TypeScript | `lib/verifactu/remision.ts` |
| Cron de procesado | `app/api/cron/verifactu-remision/route.ts` (+ `vercel.json`) |
| Endpoint interno de estado | `app/api/verifactu/estado-remision/route.ts` |
| Tests worker (sin red) | `lib/verifactu/tests/v10-remision.test.mjs` |
| Tests SQL (PGlite) | `supabase/tests/v10-remision.test.mjs` |

## Flujo de un tick del cron

1. `sif_remision_pendientes()`: obligados con trabajo listo. Excluye a los que
   tienen el módulo inactivo, el control de flujo en espera
   (`sif_config.proximo_envio_desde` en el futuro) o el circuit breaker abierto.
2. Por obligado, `sif_outbox_reclamar_lote(user_id, ≤1000)`: transacción que
   pasa outbox `pendiente→en_envio` con un `lote_id` nuevo (`FOR UPDATE SKIP
   LOCKED`: dos ticks concurrentes no reclaman lo mismo), `intentos+1`, y
   `sif_registros → 'sending'`. Devuelve XML fijado + jsonb del registro.
3. El worker construye `RegFactuSistemaFacturacion` (cabecera de `sif_config`;
   `Incidencia=S` si alguna fila viene de un fallo previo) con el XML fijado en
   la emisión o regenerado determinista desde el jsonb **verificando que la
   huella coincide** (si no coincide, integridad rota: el lote NO se remite).
4. Con respuesta AEAT parseada → `sif_outbox_resolver_lote`: por línea
   `accepted` / `accepted_with_errors` / `rejected` (duplicados idempotentes,
   SPEC §5.4), CSV y `respuesta_aeat` en `sif_registros`, outbox
   `enviado`/`error`, y control de flujo: obedece el **último**
   `TiempoEsperaEnvio` (`proximo_envio_desde = now() + espera`) y resetea el
   breaker. Filas sin línea de respuesta vuelven a `pendiente` con backoff.
5. Sin respuesta interpretable (red/timeout/5xx/Fault) →
   `sif_outbox_fallar_lote`: filas a `pendiente` con **backoff exponencial
   2·4·8·16·32·60 min (cap 60 min: garantiza el reintento ≥1/hora del art. 16
   Orden)**, `incidencia=true` (el reenvío irá con `Incidencia=S`), registros a
   `queued`, y `fallos_consecutivos+1`.

## Decisiones de diseño

- **Circuit breaker por obligado**: 5 envíos consecutivos sin respuesta
  interpretable abren el circuito 15 minutos (`sif_config.circuito_abierto_hasta`);
  cualquier respuesta AEAT parseada lo cierra y resetea el contador. Compatible
  con el mínimo de 1 reintento/hora.
- **Idempotencia**: los reenvíos (backoff o rescate) pueden duplicar un envío
  ya registrado; el rechazo por duplicado se traduce al estado del registro ya
  almacenado (`estadoSiDuplicado`), incluida una anulación ya `Anulada`.
- **Rescate de lotes zombis**: filas `en_envio` sin resolver en >15 min (worker
  caído entre envío y cierre) vuelven a ser reclamables.
- **Rechazo definitivo (`rejected`)**: outbox a `error` y FUERA de la cola
  automática; el reenvío corregido con `RechazoPrevio=S` es de V12
  (subsanación/incidencias).
- **La emisión nunca se detiene** por fallos de remisión (art. 16 Orden): la
  cola solo acumula.
- **Cadencia**: el cron corre cada minuto, pero la cadencia real la impone
  `TiempoEsperaEnvio` en SQL; ejecutar el cron más a menudo no acelera nada.
- **Sin certificado configurado** (custodia en V11), el cron responde
  `procesado:false` y la cola acumula; al llegar el certificado, todo lo
  retenido sale con `Incidencia=S`.

## Operación

- Cron: `GET /api/cron/verifactu-remision` con `Authorization: Bearer
  $CRON_SECRET` (programado en `vercel.json`, `* * * * *`).
- Estado: `GET /api/verifactu/estado-remision` (mismo Bearer): contadores de
  outbox/registros, pendiente más antiguo y situación por obligado (flujo,
  fallos, breaker).
- Env necesarias: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL`, y las del certificado V09/V11
  (`VERIFACTU_CERT_*`, `VERIFACTU_ENTORNO` — `pruebas` por defecto).

## [REVISIÓN IVAN]

- El plan **Hobby** de Vercel solo permite crons **diarios**; la cadencia
  `* * * * *` requiere plan **Pro**. Alternativa sin coste hasta decidir:
  disparar el endpoint desde el Programador de Windows del equipo ARES2 o un
  cron externo, con el mismo Bearer.
- `maxDuration = 60` en el cron: suficiente para lotes normales; si un día hay
  >1000 registros acumulados en muchos obligados, revisar (drena 1000/obligado
  y minuto).
