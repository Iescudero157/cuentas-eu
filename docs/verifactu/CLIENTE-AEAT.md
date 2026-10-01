# V09 · Cliente SOAP del servicio AEAT (RegFactuSistemaFacturacion)

Cliente de remisión VERI*FACTU de Kuentas: `lib/verifactu/aeat-cliente.ts`
(+ `lib/verifactu/xml-ligero.ts`, parser XML propio de las respuestas).
Tests: `lib/verifactu/tests/v09-aeat-cliente.test.mjs` (20 tests, mock mTLS real).

## Fuentes oficiales

Todo lo normativo sale de los ficheros descargados de la sede AEAT en
`docs/verifactu/xsd/` (ver `FUENTES.md`):

| Fichero | Uso en V09 |
|---|---|
| `SistemaFacturacion.wsdl` | Binding **SOAP 1.1 document/literal**, `SOAPAction` vacío, endpoints por servicio/entorno/certificado. Los tests comparan las constantes con los 8 `soap:address` del WSDL. |
| `SuministroLR.xsd` | Mensaje de envío `RegFactuSistemaFacturacion` (lo construye V05: `xmlRegFactuSistemaFacturacion`). |
| `RespuestaSuministro.xsd` | Respuesta: CSV, `DatosPresentacion`, `TiempoEsperaEnvio`, `EstadoEnvio`, `RespuestaLinea[]` (con `RegistroDuplicado`). Parseada **al completo**. |

## Endpoints (confirmados contra el WSDL, cerrando la nota de SPEC §5.2)

- VERI*FACTU (`ENDPOINTS_VERIFACTU`): producción `www1`/`www10` (sello),
  pruebas `prewww1`/`prewww10` (sello), ruta `/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP`.
- Requerimiento (`ENDPOINTS_REQUERIMIENTO`, para V14): misma matriz con ruta `…/RequerimientoSOAP`.

## Diseño

- **`ClienteAeat`**: un envío → una respuesta tipada (`RespuestaRegFactu`).
  `enviarRegistros(cabecera, registrosXml[])` reutiliza la envoltura V05 (1..1000
  registros, altas y anulaciones del mismo obligado) y `enviarCuerpoXml()` acepta
  el mensaje ya reconstruido desde `sif_registros` (V07). La **cadencia** (obedecer
  `TiempoEsperaEnvio`, acumular, `Incidencia=S`, reintentos horarios) es del worker V10:
  este cliente solo le devuelve los datos que necesita.
- **mTLS inyectable**: `CertificadoCliente` admite PKCS#12 (`pfx`+`passphrase`, formato
  FNMT) o par PEM. El certificado real NO existe todavía: `certificadoDesdeEnv()` lo
  leerá de `VERIFACTU_CERT_PFX_BASE64`/`VERIFACTU_CERT_PFX_PASSWORD` (o
  `VERIFACTU_CERT_PEM_BASE64`+`VERIFACTU_CERT_KEY_PEM_BASE64`); custodia cifrada y
  multi-certificado en V11. Sin material, el cliente **no se construye** (error claro).
- **Config por entorno**: `VERIFACTU_ENTORNO` (**por defecto `pruebas`**; producción es
  opt-in explícito), `VERIFACTU_CERT_TIPO` (`normal`|`sello`), `VERIFACTU_URL_OVERRIDE`,
  `VERIFACTU_TIMEOUT_MS` (30 s por defecto).
- **Transporte**: `node:https` con TLS ≥ 1.2, certificado cliente y CAs del sistema
  (`ca` solo AÑADE confianza en tests). `TransporteHttp` es inyectable (mock de tests,
  futuro gateway).
- **Errores tipados** con semántica de reintento para V10:
  - `ErrorTransporteAeat` (red/TLS/timeout, **reintentable**);
  - `ErrorHttpAeat` (HTTP sin SOAP; reintentable si 5xx/429);
  - `ErrorSoapAeat` (Fault: estructura/certificado, **no** reintentable — aunque venga
    con HTTP 500 se parsea el Fault);
  - `ErrorRespuestaAeat` (cuerpo que no cumple el XSD de respuesta).
- **Estados** (§5.4-5.5 SPEC): `estadoInternoLinea()` mapea
  `Correcto|AceptadoConErrores|Incorrecto` → `accepted|accepted_with_errors|rejected`;
  `estadoSiDuplicado()` trata idempotentemente el rechazo por duplicado (si el registro
  almacenado está `Correcta`/`AceptadaConErrores`, el reenvío se da por completado).
- **Parser XML propio** (`xml-ligero.ts`): sin dependencias, independiente de los
  prefijos que elija la AEAT y **anti-XXE por construcción** (rechaza DOCTYPE y
  entidades no predefinidas).

## Decisión técnica V09 (SPEC §8): Vercel vs `verifactu-gateway`

El runtime **Node** de Vercel (el que usan las rutas API de cuentas-app) ejecuta
`node:https` con certificado cliente sin limitaciones conocidas, así que **no se
despliega gateway en v1**. Cobertura del riesgo: el cliente ya acepta
`VERIFACTU_URL_OVERRIDE` + transporte inyectable, de modo que si las pruebas reales
contra la AEAT (V17) revelaran un problema de mTLS saliente en Vercel, el
`verifactu-gateway` (VPS Raiola) se insertaría sin tocar motor ni worker. Se
revalida en V17 con el certificado real.

## Verificación

- 20 tests V09 (123/123 en `npm test`): endpoints contra el WSDL; envoltura SOAP con
  mensaje validado contra `SuministroLR.xsd`; fixtures de respuesta **validados contra
  `RespuestaSuministro.xsd`** antes de parsearlos; parseo de Correcto / ParcialmenteCorrecto /
  Incorrecto / duplicado / Fault; config por env; y servidor HTTPS local que **exige
  certificado cliente** (fixtures autofirmados en `tests/fixtures/certs-prueba/`, solo
  tests): intercambio completo con PFX y con PEM, rechazo sin certificado, timeout,
  HTTP 500+Fault y HTTP 503/HTML.
- No se ha llamado al servicio real de la AEAT (no hay certificado): eso es V17
  (portal de pruebas externas).
