# Esquemas oficiales AEAT — Verifactu (V05)

Descargados el **2026-09-12** de la sede electrónica de la AEAT (Sistemas
Informáticos de Facturación y VERI*FACTU → Información técnica), ruta base:

`https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/<fichero>`

Los ficheros se conservan **INTACTOS** tal como los sirve la AEAT (no editar:
cualquier actualización se hace re-descargando y anotando aquí fecha y hash).

| Fichero | Qué define | SHA-256 |
|---|---|---|
| `SuministroLR.xsd` | Mensaje de envío `RegFactuSistemaFacturacion` (Cabecera + 1..1000 RegistroFactura) | `cbdac8d427cc5ab5d77ca48974cab0f35d6bb819c4c66db361681e3710aeba36` |
| `SuministroInformacion.xsd` | Tipos comunes: `RegistroAlta`, `RegistroAnulacion`, listas L1-L12, países | `ee4c1655175644de44c4c25055ffeb8e5f4bb4bc3834ce8254d4222ef18c8aa1` |
| `RespuestaSuministro.xsd` | Respuesta del servicio (CSV, TiempoEsperaEnvio, RespuestaLinea) | `82acf80f785643caac13087aae66808ed721a13f08ca5218cf8ae81b695549ef` |
| `ConsultaLR.xsd` | Consulta de registros remitidos | `bf2cdb8fc4b95b291757a72b76d8fffca06a6d30d9329122ca2fd6b2d5f8f1b1` |
| `RespuestaConsultaLR.xsd` | Respuesta de la consulta | `de35063acb8d9ba0d6ae51acc6b595de9c2b12333250e95e13108ef5f2670d45` |
| `EventosSIF.xsd` | Registro de eventos (solo no-VERI*FACTU; referencia V14) | `cc7347c6a9a57a0c8edbc6b9ddcce55176452d0db0e68369477e207e9fbdd7e7` |
| `SistemaFacturacion.wsdl` | WSDL del servicio SOAP (endpoints; se verifica en V09) | `05919120708ff7650612fa6683c9336eaf919335d9a4db10e86759190af48602` |
| `xmldsig-core-schema.xsd` | Esquema XMLDSig del W3C (importado por SuministroInformacion.xsd); descargado de `https://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd` | `d102ad3df7664c307e0c2c776ba4a90513b1969974d8a940bae1a77f9f21e15d` |

## Discrepancias detectadas respecto a SPEC.md (V02) al leer el XSD real

1. **`OperacionExenta` admite E1-E8** (el anexo de la Orden HAC/1177/2024
   publicó E1-E6; el XSD vigente añade E7 y E8). SPEC §2.2 corregido en V05.
2. **`ClaveRegimen` (L8A) incluye el valor `21`** además de 01-11, 14, 15,
   17-20. SPEC §2.2 corregido en V05.
3. `FechaHoraHusoGenRegistro` es `xs:dateTime` (ISO 8601 con huso), como
   preveía el SPEC. `NumSerieFactura` es `TextoIDFacturaType` (1-60 chars).
4. `Destinatarios` admite hasta **1000** `IDDestinatario` (el registro exige
   al menos el destinatario obligatorio; SPEC hablaba de 1..n).
5. `IDOtro.CodigoPais` es **opcional** en el XSD (nota AEAT: con IDType=02 el
   país va implícito en el NIF-IVA); prohibido `ES` salvo con IDType=07.

## Validación en tests

`lib/verifactu/tests/helpers/xsd-validator.mjs` valida los XML generados
contra estos ficheros con `xmllint-wasm` (libxml2 → WASM, devDependency, sin
red). Únicos ajustes EN MEMORIA (los ficheros de disco no se tocan): el
`schemaLocation` remoto del import de XMLDSig se apunta a la copia local, y a
esa copia W3C se le retira el DOCTYPE (evita resolver el DTD externo).
