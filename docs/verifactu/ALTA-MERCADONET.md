# V26 · Alta de Mercadonet Global S.L. como primer cliente real de Kuentas

Fecha: 2026-09-25 · Rama `verifactu` · Equipo ARES2. Decisión de Iván (11-sep-2026):
Mercadonet Global S.L. (B98407901) factura con Kuentas desde 2027 (~20 facturas/año)
y contabiliza en ClassicConta 7 vía el export AIG (V22).

## 1. Qué se ha hecho (y verificado EN VIVO el 25-09-2026)

El `/registro` público de la app está cerrado y la BD de producción no tiene
aplicadas las migraciones SIF (a propósito), así que el alta se ejercitó con el
instrumental de V26 en un sandbox Postgres real (PGlite) que aplica el `schema.sql`
y las 13 migraciones/ficheros del repo **fichero a fichero — el mismo SQL que se
aplicará en Supabase** — y la remisión se hizo EN VIVO contra el entorno de
**PRUEBAS** de la AEAT con el certificado FNMT de representante de Mercadonet
(almacén de Windows, flujo curl/Schannel de V17).

- **Alta**: usuario + `sif_config` (NIF B98407901, razón social, instalación
  `KU-B98407901`, modalidad `verifactu`, entorno `pruebas`, activo) con el SQL de
  `npm run … --sql` (fuente única). Serie de facturación propia.
- **2 facturas de PRUEBA** (F2 simplificadas, «PRUEBA - NO VALIDA», 1,21 € y 1,10 €)
  emitidas con `sif_emitir_factura`: serie propia `MN-PRUEBA-2609250515` →
  `…-2026-000001` y `…-2026-000002`, correlativos de cadena 1 y 2.
- **Ciclo completo verificado** (28/28 comprobaciones, ver
  `verifactu-logs/v26-alta-mercadonet/` del motor):
  - Numeración correlativa en servidor y facturas `emitida` con `numero_fiscal`.
  - Huella: regenerada en TS === persistida en SQL; encadenamiento intacto;
    `sif_detectar_anomalias` = 0.
  - XML de cada registro y `RegFactuSistemaFacturacion` validados contra los XSD
    oficiales AEAT antes de enviar.
  - QR + leyenda VERI\*FACTU en el PDF real de cada factura (35 mm, URL de cotejo
    con los 4 parámetros).
  - **Remisión EN VIVO**: `EstadoEnvio=Correcto`, **CSV `A-4SB93Z8KVTZVVW`**, las
    2 líneas `Correcto`; lote cerrado con la lógica del worker V10
    (`sif_outbox_resolver_lote`), cola a cero, registros `accepted` con CSV.
  - **Cotejo del QR en prewww2**: las 2 facturas **«Encontrada»** en el portal
    (evidencia `cotejo-1.html` / `cotejo-2.html`).
  - **Export ClassicConta (V22)** de las 2 facturas: diario 869 / subcuentas 444,
    asientos cuadrados (`CC_diario.txt`, `CC_subcuentas.txt`).

Instrumental reproducible:

```
node scripts/verifactu-alta-mercadonet.mjs --preparar  --dir <dir>   # sandbox + envelope, sin red
powershell -File scripts/verifactu-alta-mercadonet.ps1               # ciclo completo en vivo (pruebas)
node scripts/verifactu-alta-mercadonet.mjs --sql                     # SQL del alta real
```

## 2. Cómo se hace el alta REAL (cuando toque)

1. Aplicar las migraciones `supabase/migrations/2026*.sql` al proyecto Supabase
   (preprod primero; producción cuando Iván lo decida). NO desde este repo a mano:
   con el flujo de despliegue que se acuerde.
2. Dashboard Supabase → Authentication → **Invite user** → `info@mercadonet.es`
   *(buzón a confirmar por Iván)*. Copiar el `id` del usuario creado.
3. SQL editor (service_role): ejecutar la salida de
   `node scripts/verifactu-alta-mercadonet.mjs --sql` sustituyendo `:user_id`.
   Deja `entorno_aeat='pruebas'`; el paso a `'produccion'` y la
   `fecha_inicio_verifactu` (art. 17 Orden HAC/1177/2024) son decisión de Iván.
4. Subir el certificado de Mercadonet en la app (Ajustes → certificado, V11) —
   requiere el PFX **exportable** (ver §3).
5. Serie real propuesta: `MN` (la primera emisión de 2027 creará
   `MN-2027-000001` automáticamente; no hay que dar de alta la serie).

## 3. Qué falta para que Mercadonet facture DE VERDAD en 2027 (todo de Iván)

| # | Pendiente | Detalle |
|---|---|---|
| 1 | Supabase preprod/producción con las migraciones SIF | Hoy la BD viva no tiene el esquema `sif_*` (decisión deliberada). |
| 2 | PFX exportable del certificado (o sello de entidad FNMT) | El de este equipo tiene la clave NO exportable: vale para pruebas locales (Schannel) pero la app en Vercel necesita el PKCS#12 (V11). |
| 3 | `VERIFACTU_CERT_KEK_BASE64` en Vercel | `openssl rand -base64 32` (custodia V11). |
| 4 | `CRON_SECRET` en Vercel + cron por minuto | El cron `verifactu-remision` cada minuto exige Vercel Pro (o disparo externo con el mismo Bearer, V10). |
| 5 | Ratificar la declaración responsable (V19) y los legales (V20) | Quitar `DECLARACION_ES_BORRADOR` tras revisión de Iván/asesor. |
| 6 | Decisión de paso a producción AEAT | `entorno_aeat='produccion'` + `fecha_inicio_verifactu`; obligación legal: IS 01-01-2027, resto 01-07-2027 (RD-ley 15/2025). |
| 7 | Confirmar buzón del usuario (info@ vs kuentas@) | El alta usa `info@mercadonet.es` como propuesta. |

Nota del entorno de pruebas compartido: al abrir una cadena nueva el portal puede
responder `AceptadoConErrores 2007` («no debe informarse como primer registro»)
por los envíos históricos del mismo obligado+SIF (visto en V18; en esta tanda no
ocurrió). El instrumental lo admite SOLO para ese código y lo deja anotado; en
producción la primera factura real sí será primer registro.
