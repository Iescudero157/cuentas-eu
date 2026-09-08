# SPEC.md — Especificación técnica del Módulo Verifactu de Kuentas (V02)

**Fecha:** 2026-09-08 · **Rama:** `verifactu` · **Estado:** biblia de referencia para los items V03–V26.
**Modalidad elegida:** VERI*FACTU (remisión continua a la AEAT). El modo no-VERI*FACTU se evalúa en V14.

Este documento fija QUÉ exige la normativa (con cita de artículo/apartado) y CÓMO lo va a
implementar `cuentas-app`. Cuando un dato procede de un documento técnico de la sede AEAT y no
del BOE, se indica. Los puntos que requieren decisión de negocio o validación jurídica van
marcados **[REVISIÓN IVAN/ASESOR]**.

---

## 0. Fuentes normativas y jerarquía

| Norma | Qué regula | Publicación |
|---|---|---|
| **RD 1007/2023**, de 5 de diciembre (aprueba el **RRSIF**, Reglamento de requisitos de los sistemas informáticos de facturación) | Requisitos de los SIF, registros de alta/anulación, huella, declaración responsable, VERI*FACTU | BOE 06/12/2023, BOE-A-2023-24840 (consolidado) |
| **Orden HAC/1177/2024**, de 17 de octubre | Especificaciones técnicas y funcionales: 21 artículos + anexo «Estructura de los ficheros» | BOE 28/10/2024, BOE-A-2024-22138 (consolidado) |
| **RD 254/2025** (BOE 02/04/2025) y **RD-ley 15/2025** (BOE 03/12/2025, convalidado) | Modifican plazos del RRSIF | — |
| **RD 1619/2012** (Reglamento de facturación), arts. **6.5, 7.5 y 8.4** añadidos por la DF 1.ª del RD 1007/2023 | QR y leyenda como contenido de la factura | consolidado |
| **Art. 29.2.j) LGT** (Ley 58/2003) y **art. 201 bis LGT** (sanciones, Ley 11/2021) | Obligación de fondo y régimen sancionador (hasta 50.000 €/ejercicio por tenencia de SIF no conforme; 150.000 € para el productor por sistema y año) | consolidado |
| **Doc. técnica sede AEAT** (Sistemas Informáticos de Facturación y VERI*FACTU → Información técnica) | Diseños de registro, XSD, WSDL, algoritmo de huella, especificación del QR, validaciones y errores, portal de pruebas | sede.agenciatributaria.gob.es |

**Plazos vigentes** (RRSIF DF 4.ª tras RD 254/2025 y RD-ley 15/2025): obligados del art. 3.1
contribuyentes del IS → **01/01/2027**; resto (autónomos IRPF, IRNR con EP, entidades en
atribución) → **01/07/2027**. Para el **productor/comercializador** de software (Kuentas) la
obligación de ofrecer solo SIF conformes con declaración responsable es efectiva ya: todo lo
que se comercialice hoy debe cumplir. La AEAT admite remisión voluntaria desde 2025 (art. 15
RRSIF): es la fase de rodaje que usaremos en V17.

> Nota de erratas del plan maestro: la declaración responsable es **art. 13 RRSIF + art. 15
> Orden HAC/1177/2024** (el plan maestro cita "art. 6 Orden" por error; el art. 6 de la Orden
> es integridad e inalterabilidad).

### Índice de la Orden HAC/1177/2024 (para citas rápidas)

Art. 1 objeto/definiciones · 2 mismo SIF para varios obligados · **3 particularidades
VERI*FACTU** · 4 capacidad de remisión · 5 identificación/autenticación · **6 integridad e
inalterabilidad** · **7 trazabilidad** · **8 conservación/accesibilidad/legibilidad** ·
**9 registro de eventos** · **10 registro de alta** · **11 registro de anulación** · 12 casos de
autorización/no aplicación · **13 huella** · **14 firma electrónica** · **15 declaración
responsable** · **16 especificaciones de la remisión VERI*FACTU** · **17 inicio/renuncia
VERI*FACTU** · 18 remisión por requerimiento · 19 app gratuita AEAT · **20 representación
gráfica (leyenda)** · **21 código QR** · DA 1.ª publicación de detalles en sede AEAT · Anexo
«Estructura de los ficheros».

### Índice del RRSIF (RD 1007/2023)

Art. 1 objeto · 2 régimen jurídico · **3 ámbito subjetivo** · **4 ámbito objetivo** · 5 solicitud
de no aplicación · 6 delegación · 7 recursos informáticos · **8 requisitos de los sistemas
(integridad, inalterabilidad, trazabilidad, conservación, accesibilidad, legibilidad; 8.4
registro de eventos)** · **9 generación del registro de alta** · **10 contenido del registro de
alta** · **11 registro de anulación** · **12 huella y firma electrónica** · **13 declaración
responsable** · 14 verificación por la Administración · **15 remisión voluntaria** ·
**16 sistemas VERI*FACTU** · 17 remisión voluntaria por el receptor.

---

## 1. Modalidad VERI*FACTU: qué implica exactamente

Un SIF es **VERI*FACTU** cuando remite a la AEAT, de forma continua, segura, correcta,
íntegra, automática, consecutiva, instantánea y fehaciente, **todos** los registros de
facturación generados (art. 16.1 RRSIF). Consecuencias (art. 3.1 Orden):

1. **Exención de firma electrónica** de los registros: basta la huella encadenada
   (art. 12 RRSIF; art. 3 Orden exime del art. 14 Orden).
2. **Exención del registro de eventos** (art. 3 Orden exime del art. 9 Orden y art. 8.4 RRSIF).
3. **Exención de las verificaciones locales de cadena** (letras de los arts. 6 y 7 Orden
   relativas a comprobación de huellas): la AEAT valida el encadenamiento al recibir.
4. **Presunción de cumplimiento** de los requisitos del art. 8 RRSIF (art. 16.2 RRSIF).
5. La factura lleva la **leyenda** «Factura verificable en la sede electrónica de la AEAT» o
   «VERI*FACTU» (art. 20 Orden; art. 6.5 RD 1619/2012).
6. **Permanencia**: iniciado el funcionamiento como VERI*FACTU, debe mantenerse **al menos
   hasta el 31 de diciembre del año en curso**; la renuncia se comunica en el propio mensaje de
   remisión (campo de fin de remisión voluntaria) **antes de fin de año natural**, indicando la
   última fecha de funcionamiento (art. 17 Orden).
7. El obligado debe **conservar** igualmente los registros (art. 8 RRSIF sigue aplicando al
   obligado; la presunción no elimina la conservación de las facturas — reglas generales de
   facturación) → item V16 (export y conservación).

**Decisión Kuentas (D1 del plan maestro):** `cuentas-app` operará **exclusivamente** como
VERI*FACTU en v1 (`TipoUsoPosibleSoloVerifactu = S`). El soporte no-VERI*FACTU (firma XAdES +
eventos) queda descartado salvo re-evaluación en V14.

---

## 2. Registro de facturación de alta

**Base legal:** arts. 9-10 RRSIF (generación y contenido) + art. 10 Orden + Anexo Orden +
XSD `SuministroInformacion.xsd` (sede AEAT, diseños de registro). Se genera **en el momento de
expedir la factura** — simultánea o inmediatamente anterior a la expedición (art. 9 RRSIF).
Aplica a factura completa y simplificada (art. 4 RRSIF).

### 2.1 Campos del registro de alta (`RegistroAlta`)

Obligatoriedad: **O** obligatorio · **C** condicional · **Op** opcional. Formatos del XSD
vigente (los tamaños exactos se re-verifican contra el XSD descargado en V05).

| Campo XML | Obl. | Contenido / formato | Fuente |
|---|---|---|---|
| `IDVersion` | O | Versión del esquema; actualmente `1.0` | XSD |
| `IDFactura/IDEmisorFactura` | O | NIF del obligado a expedir (9 caracteres, validado) | art. 10.1.a RRSIF |
| `IDFactura/NumSerieFactura` | O | Nº de factura **y serie** en un solo campo (≤60 chars, alfanumérico ASCII visible) | art. 10.1.a RRSIF |
| `IDFactura/FechaExpedicionFactura` | O | `dd-mm-aaaa` | art. 10.1.a RRSIF |
| `NombreRazonEmisor` | O | Nombre-razón social del obligado (≤120) | art. 10.1.b RRSIF |
| `Subsanacion` | C | `S`/`N` (por defecto N). `S` = reenvío que subsana un registro previamente aceptado con errores o erróneo | doc. validaciones AEAT |
| `RechazoPrevio` | C | `N`/`S`/`X` — S: hubo rechazo previo de este registro; X: sin registro previo aceptado | doc. validaciones AEAT |
| `TipoFactura` | O | Lista L2: `F1` completa (art. 6 RD 1619/2012) · `F2` simplificada (art. 7) · `F3` sustitutiva de simplificadas sin rectificativa · `R1`-`R4` rectificativas (R1 error fundado en derecho/art. 80.1-2 LIVA, R2 concurso art. 80.3, R3 incobrable art. 80.4, R4 resto) · `R5` rectificativa de simplificada | art. 10.1.c RRSIF; XSD L2 |
| `TipoRectificativa` | C | Si TipoFactura=R*: `S` (por sustitución) o `I` (por diferencias) | XSD |
| `FacturasRectificadas` | C | Lista de facturas rectificadas (IDEmisor, NumSerie, FechaExpedicion), si R* | XSD |
| `FacturasSustituidas` | C | Lista de facturas sustituidas, si F3 | XSD |
| `ImporteRectificacion` | C | Si TipoRectificativa=S: `BaseRectificada`, `CuotaRectificada`, `CuotaRecargoRectificado` | XSD |
| `FechaOperacion` | C | `dd-mm-aaaa`, si difiere de la de expedición | art. 10.1.d RRSIF |
| `DescripcionOperacion` | O | Texto libre (≤500) | art. 10.1.e RRSIF |
| `FacturaSimplificadaArt7273` | C | `S` si simplificada arts. 7.2/7.3 RD 1619/2012 | XSD |
| `FacturaSinIdentifDestinatarioArt61d` | C | `S` si acogida a art. 6.1.d) RD 1619/2012 | XSD |
| `Macrodato` | C | `S` si importe total ≥ 100.000.000 € | doc. validaciones |
| `EmitidaPorTerceroODestinatario` | C | `T` (tercero) / `D` (destinatario) | art. 10.1.g RRSIF |
| `Tercero` | C | NombreRazon + NIF/IDOtro del tercero emisor | XSD |
| `Destinatarios` (1..n `IDDestinatario`) | C | Obligatorio salvo F2/F1 sin destinatario: `NombreRazon` + `NIF` **o** `IDOtro` (`CodigoPais` ISO-3166, `IDType` L7: 02 NIF-IVA, 03 pasaporte, 04 doc. país, 05 cert. residencia, 06 otro, 07 no censado) | art. 10.1.f RRSIF |
| `Cupon` | C | `S` en F1/R* con cupón | XSD |
| `Desglose` (1..12 `DetalleDesglose`) | O | Ver §2.2 | art. 10.1.h-i RRSIF |
| `CuotaTotal` | O | Suma de cuotas; decimal, punto, 2 dec. | art. 10.1.i RRSIF |
| `ImporteTotal` | O | Importe total de la factura; decimal, punto, 2 dec. | art. 10.1.j RRSIF |
| `Encadenamiento` | O | `PrimerRegistro=S` **o** `RegistroAnterior{IDEmisorFactura, NumSerieFactura, FechaExpedicionFactura, Huella}` | art. 10.1.k RRSIF; art. 7 Orden |
| `SistemaInformatico` | O | Ver §2.4 | art. 10.1.l RRSIF |
| `FechaHoraHusoGenRegistro` | O | ISO 8601 con huso: `aaaa-mm-ddThh:mm:ss±hh:mm` (ej. `2027-01-15T10:21:33+01:00`) | art. 10.1.m RRSIF |
| `NumRegistroAcuerdoFacturacion` | C | Solo con acuerdo de facturación autorizado | art. 10.1.n RRSIF |
| `IdAcuerdoSistemaInformatico` | C | Solo SIF con autorización art. 5 RRSIF | art. 10.1.ñ RRSIF |
| `TipoHuella` | O | `01` = SHA-256 (único valor admitido) | art. 10.1.o RRSIF; XSD L12 |
| `Huella` | O | 64 hex mayúsculas — ver §4 | art. 12 RRSIF |
| `Signature` | C | Firma XMLDSig — **solo no-VERI*FACTU** (exentos por art. 3 Orden) | art. 14 Orden |

### 2.2 Desglose por tipo impositivo (`DetalleDesglose`, 1 a 12 líneas)

Cada línea de desglose (art. 10.1.h-i RRSIF; XSD):

| Campo | Obl. | Valores |
|---|---|---|
| `Impuesto` | Op (defecto 01) | L1: `01` IVA · `02` IPSI · `03` IGIC · `05` otros |
| `ClaveRegimen` | C (obligatorio si Impuesto 01/03) | Lista L8A (IVA): `01` régimen general · `02` exportación · `03` REBU · `04` oro de inversión · `05` agencias de viajes · `06` grupo de entidades · `07` criterio de caja · `08` operaciones IPSI/IGIC · `09` mediación agencias de viaje · `10` cobros por cuenta de terceros · `11` arrendamiento de local de negocio · `14` IVA pendiente (certificaciones AAPP) · `15` IVA pendiente (tracto sucesivo) · `17` OSS/IOSS · `18` recargo de equivalencia · `19` REAGYP · `20` régimen simplificado. (Lista completa y vigente: XSD L8A/L8B — re-verificar en V05) |
| `CalificacionOperacion` | C (excluyente con OperacionExenta) | `S1` sujeta no exenta sin inversión · `S2` sujeta no exenta con inversión del sujeto pasivo · `N1` no sujeta (arts. 7, 14, otros) · `N2` no sujeta por reglas de localización |
| `OperacionExenta` | C | `E1` (art. 20 LIVA) · `E2` (art. 21) · `E3` (art. 22) · `E4` (arts. 23-24) · `E5` (art. 25) · `E6` (otras) |
| `TipoImpositivo` | C | % (S1; ej. 21, 10, 4, 0) |
| `BaseImponibleOimporteNoSujeto` | O | Decimal 2 dec. |
| `BaseImponibleACoste` | C | Grupos de entidades |
| `CuotaRepercutida` | C | Decimal 2 dec. (S1) |
| `TipoRecargoEquivalencia` | C | % recargo (5.2, 1.4, 0.5, 1.75, 0.62, 0.26) |
| `CuotaRecargoEquivalencia` | C | Decimal 2 dec. |

**Validación aritmética AEAT** (doc. «Validaciones y errores»): `CuotaRepercutida ≈ Base ×
Tipo/100` (tolerancia ±10 € por línea, ±1 céntimo en redondeos), `CuotaTotal = Σ cuotas`,
`ImporteTotal = Σ bases + cuotas + recargos` (tolerancia). El servidor de Kuentas debe
recalcular y validar SIEMPRE antes de generar el registro (corrige el riesgo R3 de V01).

### 2.3 Reglas de generación (art. 9 RRSIF, art. 6 Orden)

- El registro se genera **en el momento de expedir la factura**, no después (art. 9.1 RRSIF).
- Los registros son **inmutables**: sin UPDATE ni DELETE (art. 8.2 RRSIF; art. 6 Orden).
  Cualquier corrección posterior = **nuevo** registro (subsanación, rectificativa o anulación).
- Un registro por factura expedida, también las simplificadas.
- **No** se genera registro por documentos que no son factura (presupuestos, proformas,
  albaranes) — pero el SIF no debe poder emitir «tickets» paralelos fuera de registro
  (integridad, art. 8 RRSIF).

### 2.4 Bloque `SistemaInformatico` (identificación del SIF)

Art. 10.1.l RRSIF + art. 15 Orden (los mismos datos de la declaración responsable):

| Campo | Valor para Kuentas |
|---|---|
| `NombreRazon` (productor) | Mercadonet Global S.L. |
| `NIF` (productor) | B98407901 |
| `NombreSistemaInformatico` | `Kuentas` |
| `IdSistemaInformatico` | Código de 2 caracteres asignado por el productor — propuesta: `01` **[REVISIÓN IVAN]** |
| `Version` | Versión del módulo (semver, p.ej. `1.0.0`); debe coincidir con la declaración responsable |
| `NumeroInstalacion` | ≤100 chars. Al ser SaaS multi-tenant: identificador único por obligado tributario (propuesta: `KU-<uuid-corto-del-user>`) |
| `TipoUsoPosibleSoloVerifactu` | `S` (v1 solo opera como VERI*FACTU) |
| `TipoUsoPosibleMultiOT` | `S` (una instalación puede dar soporte a varios obligados) |
| `IndicadorMultiplesOT` | `S` (de hecho los soporta) |

---

## 3. Registro de facturación de anulación

**Base legal:** art. 11 RRSIF + art. 11 Orden + XSD (`RegistroAnulacion`). Se usa cuando se
anula una factura **erróneamente emitida** (nunca se borra: la anulación es un nuevo registro
encadenado). Si lo que procede es corregir, se usa **rectificativa** (nuevo registro de alta
R1-R5), no anulación.

| Campo XML | Obl. | Contenido |
|---|---|---|
| `IDVersion` | O | `1.0` |
| `IDFactura/IDEmisorFacturaAnulada` | O | NIF emisor de la factura anulada |
| `IDFactura/NumSerieFacturaAnulada` | O | Nº+serie de la factura anulada |
| `IDFactura/FechaExpedicionFacturaAnulada` | O | `dd-mm-aaaa` |
| `RefExterna` | Op | Referencia interna |
| `SinRegistroPrevio` | C | `S` si se anula una factura de la que no consta registro de alta previo |
| `RechazoPrevio` | C | `S`/`N` |
| `GeneradoPor` | C | `E` emisor · `D` destinatario · `T` tercero |
| `Generador` | C | Identificación de quien genera, si D/T |
| `Encadenamiento` | O | Igual que en alta (la anulación se encadena en la MISMA cadena del obligado) |
| `SistemaInformatico` | O | Igual que §2.4 |
| `FechaHoraHusoGenRegistro` | O | ISO 8601 con huso |
| `TipoHuella` | O | `01` |
| `Huella` | O | Ver §4.2 |

---

## 4. Huella («hash») encadenada — algoritmo oficial

**Base legal:** art. 12 RRSIF + art. 13 Orden. La Orden delega el detalle en el documento de
la sede AEAT **«Detalle de las especificaciones técnicas para generación de la huella o
"hash" de los registros de facturación y de eventos»** (DA 1.ª Orden). Especificación vigente:

- **Algoritmo:** SHA-256. `TipoHuella = 01`.
- **Entrada:** cadena UTF-8 formada concatenando pares `Campo=valor` separados por `&`, en el
  **orden exacto** de abajo.
- **Reglas por valor:** se toma el valor del campo del XML **sin espacios iniciales ni
  finales** (trim); si el campo no existe o va vacío, se deja vacío tras el `=`; los importes
  con punto decimal y 2 decimales tal como van en el XML; fechas tal como van en el XML.
- **Salida:** los 32 bytes del digest en **hexadecimal, 64 caracteres, MAYÚSCULAS**.

### 4.1 Registro de alta — cadena de entrada (8 campos, en este orden)

```
IDEmisorFactura=<v>&NumSerieFactura=<v>&FechaExpedicionFactura=<v>&TipoFactura=<v>&CuotaTotal=<v>&ImporteTotal=<v>&Huella=<huella del registro anterior>&FechaHoraHusoGenRegistro=<v>
```

Ejemplo oficial del documento AEAT (primer registro de la cadena, `Huella=` vacío):

```
IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00
```

### 4.2 Registro de anulación — cadena de entrada (5 campos)

```
IDEmisorFacturaAnulada=<v>&NumSerieFacturaAnulada=<v>&FechaExpedicionFacturaAnulada=<v>&Huella=<huella del registro anterior>&FechaHoraHusoGenRegistro=<v>
```

### 4.3 Encadenamiento (art. 7 Orden)

- La cadena es **por obligado tributario (NIF emisor) y sistema**: cada usuario emisor de
  Kuentas tiene SU cadena. Altas y anulaciones se encadenan **juntas** en orden de generación.
- Primer registro de la cadena: bloque `Encadenamiento/PrimerRegistro = S` y en la cadena de
  huella `Huella=` (vacío).
- Registros siguientes: `Encadenamiento/RegistroAnterior` con `IDEmisorFactura`,
  `NumSerieFactura`, `FechaExpedicionFactura` y `Huella` del registro inmediatamente anterior;
  esa misma huella anterior se usa en el campo `Huella=` de la cadena de entrada.
- La `FechaHoraHusoGenRegistro` usada en la huella debe ser **idéntica** a la del XML
  remitido; el huso será el vigente en España peninsular (`Europe/Madrid`: `+01:00`/`+02:00`).
- En VERI*FACTU la verificación de la cadena la hace la AEAT al recibir (art. 3 Orden); aún
  así Kuentas verificará localmente antes de encolar (defensa en profundidad, coste ≈ 0).

---

## 5. Flujo VERI*FACTU de remisión (cadencia, control de flujo, CSV)

**Base legal:** art. 16 RRSIF (remisión continua) + arts. 4, 5, 16 y 17 Orden + doc. sede
AEAT «Especificaciones del servicio web de remisión».

### 5.1 Protocolo y mensajes

- **SOAP sobre HTTPS con autenticación mutua TLS** (certificado electrónico cliente:
  certificado de representante de la sociedad, de sello, o de la persona física; también
  admite **colaborador social** y apoderamiento — art. 5 Orden). Ver §8 y V11.
- WSDL: `SistemaFacturacion.wsdl`. Esquemas: `SuministroLR.xsd` (envío),
  `SuministroInformacion.xsd` (tipos comunes), `RespuestaSuministro.xsd` (respuesta),
  `ConsultaLR.xsd` (consulta de registros remitidos), `EventosSIF.xsd` (eventos, no aplica en
  VERI*FACTU).
- Mensaje de envío: `RegFactuSistemaFacturacion` con `Cabecera` (`ObligadoEmision`
  {NombreRazon, NIF}, opcional `Representante`, opcional `RemisionVoluntaria`
  {`FechaFinVeriFactu`, `Incidencia`}) + 1..1000 `RegistroFactura` (cada uno un
  `RegistroAlta` o `RegistroAnulacion`).
- Un envío puede mezclar altas y anulaciones **del mismo obligado**.

### 5.2 Endpoints

| Entorno | Certificado normal | Certificado de sello |
|---|---|---|
| **Pruebas** (Portal de Pruebas Externas, sin trascendencia tributaria) | `https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` | `https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` |
| **Producción** | `https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` | `https://www10.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` |

(Confirmar contra el WSDL descargado en V09; portal de pruebas: `preportal.aeat.es`.)

### 5.3 Cadencia y control de flujo (art. 16 Orden)

1. El registro se genera al expedir la factura y se remite **de inmediato** (art. 16.1 RRSIF).
2. La respuesta de la AEAT devuelve un **tiempo de espera** (`TiempoEsperaEnvio`, valor
   inicial **60 segundos**): el SIF NO debe enviar el siguiente mensaje antes de que
   transcurra, **acumulando** mientras tanto los registros generados.
3. Se envía el lote acumulado cuando (a) vence el tiempo de espera y hay registros, o
   (b) se alcanzan **1.000 registros** (máximo por envío) — lo que ocurra primero.
4. La AEAT puede ajustar el tiempo de espera en cada respuesta; el SIF debe obedecer el
   último valor recibido.
5. **Incidencias** (caída de red/servicio): reintentos periódicos, **al menos una vez cada
   hora**, hasta remitir todo lo pendiente; los registros generados durante la incidencia se
   marcan con `Incidencia = S` en la remisión (art. 16 Orden). No se detiene la emisión de
   facturas por fallo de remisión.

### 5.4 Respuesta de la AEAT y estados

Respuesta (`RespuestaSuministro.xsd`): `CSV` (Código Seguro de Verificación del envío
aceptado), `TiempoEsperaEnvio`, `EstadoEnvio` global y una `RespuestaLinea` por registro:

| Nivel | Estados | Acción de Kuentas |
|---|---|---|
| Envío | `Correcto` · `ParcialmenteCorrecto` · `Incorrecto` | Persistir CSV y respuesta completa |
| Registro | `Correcto` | Marcar registrado (estado final) |
| Registro | `AceptadoConErrores` | Registrado, pero con errores admisibles → generar **subsanación** (`Subsanacion=S`) cuando se corrija |
| Registro | `Incorrecto` (con `CodigoErrorRegistro` + descripción) | NO registrado → corregir y reenviar (`RechazoPrevio=S`); la factura ya expedida sigue siendo válida, el registro queda pendiente |

Errores de duplicado (registro ya remitido) devuelven el estado del registro almacenado; el
cliente debe tratar el reenvío idempotentemente. Catálogo completo: doc. «Validaciones y
errores» de la sede AEAT (se incorpora a tests en V18).

### 5.5 Estados internos del registro en Kuentas (máquina de estados, item V07/V10)

`draft` (factura borrador, sin registro) → `generated` (registro + huella generados, en
outbox) → `queued`/`sending` → `accepted` | `accepted_with_errors` | `rejected` →
(`accepted_with_errors`→) `subsanado` · (`rejected`→) `resent`. Aparte, la factura:
`borrador` → `emitida` → `rectificada` | `anulada`. Ningún estado permite mutar el registro ya
generado; las transiciones añaden registros nuevos.

---

## 6. QR tributario y leyenda en factura

**Base legal:** arts. 20-21 Orden + arts. 6.5 y 7.5 RD 1619/2012 + doc. sede AEAT
«Especificaciones técnicas del código QR de las facturas».

- **Todas** las facturas (completas y simplificadas) expedidas por el SIF llevan QR.
- **Características** (art. 21 Orden): ISO/IEC 18004, corrección de errores **nivel M**,
  tamaño **30×30 a 40×40 mm**, impreso con resolución adecuada y legible. Se coloca **antes**
  del contenido de la factura (parte superior). En factura electrónica estructurada (p.ej.
  Facturae) puede sustituirse el QR por la URL en un campo (art. 20 Orden).
- **Leyenda** (solo VERI*FACTU, art. 20 Orden): «**Factura verificable en la sede electrónica
  de la AEAT**» o «**VERI*FACTU**», con tipo y tamaño de letra bien visibles.
  Decisión Kuentas: usar la frase larga + «VERI*FACTU» como marca corta bajo el QR.
- **Contenido del QR = URL del servicio de cotejo** con 4 parámetros, en este orden,
  con valores URL-encoded:

```
Producción: https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=<NIF>&numserie=<NumSerieFactura>&fecha=<dd-mm-aaaa>&importe=<ImporteTotal>
Pruebas:    https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=<NIF>&numserie=<NumSerieFactura>&fecha=<dd-mm-aaaa>&importe=<ImporteTotal>
```

  - `nif`: NIF del emisor · `numserie`: número+serie exacto del registro (URL-encode de `/`,
    espacios, etc.) · `fecha`: `dd-mm-aaaa` · `importe`: decimal con punto, 2 decimales,
    idéntico a `ImporteTotal` del registro.
  - La **huella NO va en el QR** (FAQ oficial AEAT, sección huella).
- El receptor puede escanear y cotejar; si el emisor es VERI*FACTU la sede confirma que la
  factura está registrada.

---

## 7. Registro de eventos (solo no-VERI*FACTU — referencia para V14)

**Base legal:** art. 8.4 RRSIF + art. 9 Orden. **Kuentas v1 está exento** (art. 3 Orden)
mientras opere solo como VERI*FACTU; se especifica por si V14 activa el modo local:

- Eventos obligatorios (art. 9.1 Orden): a) inicio de funcionamiento como no-VERI*FACTU;
  b) fin de dicho funcionamiento; c) lanzamiento de la detección de anomalías sobre registros
  de facturación; d) anomalías detectadas (integridad/inalterabilidad/trazabilidad);
  e) lanzamiento de detección sobre registros de evento; f) anomalías en eventos;
  g) restauración de copia de seguridad; h) exportación de registros de facturación;
  i) exportación de registros de evento.
- Además, un **registro resumen de eventos cada 6 horas** de funcionamiento (art. 9.2 Orden).
- Los eventos se huellan (misma mecánica §4, cadena propia) y se **firman** electrónicamente
  (art. 14 Orden). Esquema `EventosSIF.xsd`.

---

## 8. Certificados, identificación y remisión (resumen para V09/V11)

- Autenticación ante el servicio: **certificado electrónico** (art. 5 Orden). Opciones:
  (a) certificado del propio obligado (cada cliente de Kuentas sube el suyo);
  (b) certificado de **representante** de Mercadonet actuando como **colaborador social** en
  la remisión (requiere alta en el censo de colaboradores sociales + apoderamiento de cada
  cliente) **[REVISIÓN IVAN/ASESOR: modelo elegido y proceso de alta]**;
  (c) certificado de sello (endpoints www10/prewww10).
- El plan maestro contempla que si Vercel no soporta con garantías SOAP saliente con
  certificado cliente (mTLS), se despliegue un microservicio **`verifactu-gateway`** (VPS
  Raiola) como única pieza con acceso a certificados, con API interna autenticada para
  `cuentas-app` → decisión técnica en V09, custodia de claves en V11 (cifrado en reposo,
  nunca en el repo ni en el cliente).
- Portal de pruebas externas: acceso con certificado; validación obligada antes de
  producción (V17-V18).

---

## 9. Declaración responsable (referencia para V19)

**Base legal:** art. 13 RRSIF + art. 15 Orden. Autocertificación del **productor**
(Mercadonet Global S.L.) por cada sistema y versión — no existe homologación previa AEAT:

- Contenido mínimo (art. 15 Orden): nombre del SIF, código identificador (`IdSistemaInformatico`),
  versión, componentes hw/sw, si es solo-VERI*FACTU, si soporta múltiples obligados, datos
  del productor (razón social, NIF, domicilio), y declaración expresa de conformidad con el
  art. 29.2.j) LGT y el RRSIF.
- Debe estar **visible de manera legible e individualizada dentro del propio sistema** (art.
  15.2 Orden): página `/verifactu` en la app + PDF descargable. Texto final
  **[REVISIÓN IVAN/ASESOR]** — placeholder hasta entonces, sin publicar.
- Los datos deben coincidir 1:1 con el bloque `SistemaInformatico` (§2.4) de cada registro.

---

## 10. Decisiones de diseño para `cuentas-app` (vinculan a V03-V13)

| # | Decisión | Justificación |
|---|---|---|
| D-01 | **Numeración en servidor**: tabla de series+contadores por (obligado, serie, ejercicio) con reserva atómica (función SQL con bloqueo). Series v1: `F` ordinaria y `R` rectificativa (formato `F-2027-000123`); `NumSerieFactura` = concatenación serie+número ≤60 ASCII | R1 de V01; art. 6 RD 1619/2012 (correlatividad) |
| D-02 | **Separar borrador de emisión**: solo «Emitir» genera número + registro + huella + outbox, en la misma transacción Postgres | art. 9 RRSIF (registro al expedir) |
| D-03 | **Append-only**: tablas `verifactu_registros` (registro completo + XML + huella + estado) sin UPDATE de campos de contenido ni DELETE (trigger de bloqueo); factura emitida → inmutable, correcciones = rectificativa/anulación | arts. 8.2 RRSIF, 6 Orden |
| D-04 | **Outbox + cola**: `verifactu_cola` con lotes ≤1000, respeto de `TiempoEsperaEnvio`, reintento ≥1/hora con backoff, flag `Incidencia=S` tras fallo | art. 16 Orden |
| D-05 | **Cadena por obligado**: huella encadenada por NIF emisor (tenant); punteros `ultimo_registro` por cadena con bloqueo para serializar generación | art. 7 Orden |
| D-06 | **Fecha-hora con huso**: `FechaHoraHusoGenRegistro` en `Europe/Madrid` generada en servidor; guardar también epoch UTC | art. 10.1.m RRSIF |
| D-07 | **Importes recalculados en servidor** y desglose por tipo impositivo multi-línea (hasta 12); UI v1 mantiene 1 tipo IVA + IRPF pero el modelo de datos ya es multi-tipo | §2.2; R3/R7 de V01 |
| D-08 | **PDF único de servidor**, persistido en Supabase Storage al emitir, con QR (§6) y leyenda; el cliente solo descarga | R5 de V01; arts. 20-21 Orden |
| D-09 | **Validación NIF** del emisor (obligatoria para emitir) y del destinatario (si F1); formato + dígito de control; opcional censo AEAT en V18 | art. 10.1.a/f RRSIF; doc. validaciones |
| D-10 | **Identificación del SIF** fija en código/config según §2.4; `NumeroInstalacion` por tenant | art. 10.1.l RRSIF |
| D-11 | **Modo demo aislado**: la demo no genera registros ni comparte serie con datos reales; sin huellas falsas en UI real | LÍNEA ROJA (no inventar); R11 de V01 |
| D-12 | **Anulación** sustituye al DELETE para facturas emitidas (registro §3 + estado `anulada`); DELETE físico solo borradores | art. 11 RRSIF; R2 de V01 |
| D-13 | Config de **entorno AEAT** (`pruebas`/`produccion`) por variable de entorno; TODO el desarrollo y QA contra pruebas; producción solo tras V17-V18 y decisión de Iván | regla dura 2 |

## 11. Mapa de dependencias hacia los items siguientes

- **V03** migraciones: tablas `verifactu_registros`, `verifactu_cola`, `verifactu_cadena`,
  `series_facturacion`, `verifactu_certificados`, estados de factura (según §5.5, §10).
- **V04** huella: implementación exacta de §4 (+ vectores de prueba del doc. AEAT).
- **V05/V06** XML alta/anulación: §2 y §3 contra XSD oficial descargado.
- **V07** servicio de emisión: D-01, D-02, D-03, §2.3.
- **V08** QR+leyenda: §6. **V09** SOAP: §5.1-5.2, §8. **V10** cola: §5.3-5.5.
- **V11** certificados: §8. **V12** incidencias/subsanación: §5.4-5.5.
- **V13** UI: estados §5.5. **V14** no-VERI*FACTU: §7. **V16** conservación: art. 8 Orden.
- **V17/V18** pruebas AEAT: §5.2 pruebas, doc. validaciones. **V19** declaración: §9.

---

*Documento generado en V02 a partir de los textos consolidados del BOE (08/09/2026) y de la
documentación técnica de la sede AEAT. Cualquier discrepancia detectada al descargar los
XSD/WSDL oficiales (V05/V09) se corrige aquí y se anota en PROGRESO.md.*
