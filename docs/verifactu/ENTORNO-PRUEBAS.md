# V17 · Entorno de pruebas AEAT (preproducción VERI*FACTU)

Cómo conectar Kuentas al portal de pruebas de la AEAT y qué hace falta para
pasar a preproducción completa. Verificado EN VIVO el 20-09-2026 con el
certificado de representante de Mercadonet Global S.L. (B98407901).

## 1. Endpoints (WSDL oficial, servicio sfVerifactu)

| Entorno | Certificado | Remisión |
|---|---|---|
| Pruebas | obligado/representante | `https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` |
| Pruebas | sello de entidad | `https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` |
| Cotejo QR pruebas | — (público) | `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR` |

El entorno de pruebas NO tiene efectos tributarios, pero exige un certificado
REAL (FNMT/…) y un NIF censado. Los registros enviados quedan consultables en
el servicio de cotejo de pruebas (prewww2).

## 2. Script de prueba de conexión

- **`npm run verifactu:prueba-aeat`** — construye un alta F2 de prueba
  (serie `PRUEBA-V17-<timestamp>`, 12,10 €, descripción explícita de prueba)
  y la remite al portal de pruebas con el cliente V09 (mTLS). Solo entorno de
  pruebas: aborta si `VERIFACTU_ENTORNO=produccion`.
  - `-- --envelope <f.xml>` genera solo el Envelope SOAP (sin red).
  - `-- --parsear <resp.xml>` informe de una respuesta guardada.
  - `-- --anular --num <NumSerie> --fecha <dd-mm-aaaa> --huella <h>` anula
    el alta de prueba indicada (round-trip completo).
- **`scripts/verifactu-prueba-aeat.ps1`** — mismo flujo cuando el certificado
  vive en el almacén de Windows con clave privada **no exportable** (caso del
  certificado actual de Mercadonet en el equipo ARES2): genera el envelope con
  el `.mjs`, hace el POST con `curl.exe --cert "CurrentUser\MY\<thumbprint>"`
  (backend Schannel) y parsea la respuesta con el `.mjs`. Exit 0 = `Correcto`.

## 3. Certificado: estado y opciones

El certificado FNMT de **representante** de Mercadonet (CN `45484023M IVAN
ESCUDERO (R: B98407901)`, caduca 23/03/2028) está instalado en
`Cert:\CurrentUser\My` de ARES2 con la clave privada **marcada como NO
exportable** → no se puede generar el PFX que necesitan la app (V11) ni
Vercel. Opciones (decisión de Iván):

1. **Reinstalar desde la copia de seguridad FNMT** (fichero .p12 descargado al
   obtener el certificado) marcando «clave exportable», o usar directamente ese
   .p12 como `VERIFACTU_CERT_PFX_BASE64`. Es la vía recomendada.
2. Solicitar un **certificado de sello de entidad** para automatización
   (endpoints www10/prewww10, `VERIFACTU_CERT_TIPO=sello`).
3. Mientras tanto: las pruebas manuales funcionan con el almacén de Windows
   vía `verifactu-prueba-aeat.ps1` (Schannel usa la clave sin exportarla).

## 4. Checklist de preproducción (orden recomendado)

- [x] Conectividad mTLS con prewww1 verificada (20-09-2026, HTTP 200).
- [x] Alta de prueba aceptada: `EstadoEnvio Correcto`, CSV emitido,
      `TiempoEsperaEnvio 60`.
- [x] Cotejo QR en pruebas: la factura de prueba aparece como «Encontrada».
- [x] Anulación de prueba aceptada (round-trip completo).
- [ ] **[IVAN]** PFX exportable del certificado (opción 1 ó 2 de §3) →
      `VERIFACTU_CERT_PFX_BASE64` + `VERIFACTU_CERT_PFX_PASSWORD` en `.env.local`
      (local) y en Vercel (preview). Verificar después con
      `npm run verifactu:prueba-aeat` (cliente Node puro, sin Schannel).
- [ ] **[IVAN]** Generar KEK de custodia V11: `openssl rand -base64 32` →
      `VERIFACTU_CERT_KEK_BASE64` (Vercel) y subir el PFX desde Ajustes.
- [ ] **[IVAN]** Proyecto Supabase de preproducción: aplicar las 9 migraciones
      de `supabase/migrations` (`supabase db push` o SQL editor, en orden).
- [ ] Configurar `sif_config` del tenant de prueba: `activo=true`,
      `entorno='pruebas'`, NIF/razón del obligado.
- [ ] `CRON_SECRET` en el entorno y cron `/api/cron/verifactu-remision`
      activo (Vercel Pro `* * * * *`, o disparo externo con el Bearer).
- [ ] Emitir facturas desde la app (preview) y comprobar en el panel
      `/dashboard/verifactu`: registros `accepted`, CSV, cadena sin anomalías
      (`npm run verifactu:verificar`).
- [ ] Batería de conformidad completa (V18): casos de error, rechazos,
      subsanación, encadenamiento multi-envío contra el portal de pruebas.

## 5. Decisión V09 revalidada (gateway)

La prueba en vivo confirma que el transporte directo (sin verifactu-gateway)
funciona contra la AEAT: TLS 1.2+ con certificado cliente aceptado y SOAP 1.1
document/literal correcto. Para Vercel sigue valiendo `node:https` con el PFX
de env/V11 (el flujo Schannel es solo para el certificado no exportable del
equipo local). Sin cambios sobre DEC de V09.

## 6. Resultados de la prueba en vivo (20-09-2026)

- Alta `PRUEBA-V17-20260920110715` (12,10 €) → `Correcto`,
  CSV `A-C6S33GZ3TE6SUS`, presentador B98407901, `TiempoEsperaEnvio` 60 s.
- Cotejo `ValidarQR` (prewww2) → «Encontrada».
- Anulación del mismo registro → ver `verifactu-logs/17-…-resultado.md`
  (repo verifactu-engine) con la traza completa; artefactos en
  `verifactu-logs/v17-prueba-viva/`.
