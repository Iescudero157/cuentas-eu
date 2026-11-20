# Cumplimiento 20-nov-2026 · exentas, rectificativas/anulación y series de simplificadas

**Rama:** `cumplimiento-20261120` (desde `origin/main` 21f42b7) · **Estado:** código y migración
listos; **la migración NO está aplicada a producción** y la rama no está fusionada (lo hace Iván).

Tres huecos hallados el 20-nov-2026 al contrastar las páginas nuevas de kuentas.eu con el código
de la app (main 71ab027). Había que cerrarlos antes de dar de alta al primer obligado.

## 1. Fuentes comprobadas (20-nov-2026)

| Fuente | Versión / fecha | Para qué |
|---|---|---|
| RD 1619/2012, Reglamento de facturación (BOE-A-2012-14696) | Consolidado, última actualización 31/03/2026 | Arts. 4 (simplificadas), 6.1.a) y 7.1.a) (series), 6.1.j) y 7.1.i) (mención de exención), 15 (rectificativas) |
| RD 1007/2023, RRSIF (BOE-A-2023-24840) | Consolidado, última actualización 03/12/2025 | Art. 11 (registro de anulación), art. 13 (declaración responsable) |
| Orden HAC/1177/2024 (BOE-A-2024-22138) | Consolidado 28/10/2024 | Art. 1.2.b) (componente de facturación), art. 15 (contenido de la declaración) |
| Ley 37/1992 del IVA (BOE-A-1992-28740) | Consolidado, última actualización 07/10/2026 | Arts. 20 a 25 (exenciones) y 80 (modificación de la base imponible) |
| AEAT · «Validaciones» (`Validaciones_Errores_Veri-Factu.pdf`) | v1.2.2, 08/04/2026 · SHA-256 `426eb926…3513440` (sin cambios desde la copia de V18) | Reglas de negocio §13, §15.5, §15.5.1, §15.6.1, §15.8; lista L10 por impuesto (§5.2) |
| AEAT · Diseños de registro (`DsRegistroVeriFactu.xlsx`) | v1.0 · SHA-256 `40ce191a…252dac2ca` | Listas L2, L3, L8A y L10 |
| AEAT · `SuministroInformacion.xsd` y `SuministroLR.xsd` | SHA-256 `ee4c1655…f18c8aa1` y `cbdac8d4…10aeba36`: idénticos a `docs/verifactu/xsd/` (FUENTES.md) | Validación estructural de los registros |
| AEAT · «Aclaraciones a dudas de los desarrolladores» (`FAQs-Desarrolladores.pdf`) | v1.3, 4-dic-2025 | N.º 8 y 9 (versiones y declaración), n.º 17 (rectificar, subsanar o anular) |

## 2. Operaciones exentas

**Antes:** el IVA «0 % (Exento)» se registraba como operación **sujeta** al 0 % (`CalificacionOperacion`
S1, `TipoImpositivo` 0), sin causa de exención, y el PDF imprimía «IVA (0 %)» sin mención.

**Ahora:**

- Con IVA al 0 % hay que elegir la **causa de exención**, de la lista L10 para IVA: E1 (art. 20), E2
  (art. 21), E3 (art. 22), E4 (arts. 23 y 24), E5 (art. 25) y E6 (otros). E7 y E8 existen en el XSD
  pero son solo de IGIC (Validaciones §15.5). Se puede añadir el precepto concreto (obligatorio en E6).
- Se guarda con la factura (`invoices.operacion_exenta`, `invoices.exencion_detalle`), queda
  congelada al emitir (trigger `invoices_fiscal_guard`) y la emisión exige que el registro lleve
  exactamente esa causa (`SIF_EXENTA` en `sif_emitir_factura`).
- El registro lleva `OperacionExenta` (sin `CalificacionOperacion`, `TipoImpositivo` ni
  `CuotaRepercutida`). Clave de régimen 02 para E2 y E3 (con la 01 la AEAT las rechaza, §15.5;
  la 02 solo admite exentas, §15.6.1) y 01 para el resto.
- El PDF imprime «IVA: Exento» y la mención: «Operación exenta de IVA (artículo 20 de la Ley
  37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido).» más el precepto escrito
  (art. 6.1.j) RD 1619/2012; también en simplificadas, art. 7.1.i)).
- Un 0 % sin causa **no se emite**. Kuentas no registra operaciones «sujetas al 0 %».
- **E5 no está disponible**: la AEAT exige que el destinatario vaya en `IDOtro` (NIF-IVA,
  §15.5.1) y la app solo admite NIF español. El selector lo muestra desactivado.

## 3. Rectificativas y anulación

La app decía «emite una rectificativa o anúlala» y ninguna pantalla lo hacía. Ahora, en
`/dashboard/facturas`, el menú de cada factura emitida tiene **Emitir rectificativa** y **Anular factura**.

**Rectificativa** (`POST /api/invoices/{id}/rectificar`, `lib/verifactu/rectificacion.ts`):

- Es una **factura nueva** con fecha de hoy que identifica a la rectificada (art. 15.4), en serie
  específica (art. 6.1.a).2.º) y con los importes como **diferencias** (art. 15.5: «indicando
  directamente el importe de la rectificación, con independencia de su signo»). Registro de alta
  con `TipoRectificativa` = I y `FacturasRectificadas`. La original no se toca: pasa a `rectificada`.
- Dos modos: dejar sin efecto todo el importe que sigue vigente, o indicar la base imponible
  correcta. Si ya hay rectificativas anteriores sobre la misma factura, se descuentan.
- Tipo (lista L2): el usuario elige R1 a R4; si la rectificada es simplificada (F2 o R5) es siempre
  **R5**, sin destinatario (Validaciones §13). La base de datos rechaza la combinación cruzada.
- Hereda el tipo de IVA y la causa de exención de la original.
- El motivo es obligatorio y se imprime en la factura (referencia a lo que se modifica, art. 7.1.h)).
- No consume cupo del plan Gratis.
- **No incluida:** la modalidad por sustitución (S). El motor la admite; la pantalla no la ofrece.
  Cambiar el tipo de IVA, la causa de exención o el cliente se hace con una rectificativa por el
  importe íntegro y una factura nueva.

**Anulación** (`POST /api/invoices/{id}/anular`, ya existía): la ventana explica cuándo procede
(art. 11.1 RRSIF: «cuando se haya emitido erróneamente una factura»; FAQ AEAT n.º 17: no si la
operación es real y lo que procede es rectificar) y exige confirmarlo. El PDF de una factura
anulada lleva la banda «FACTURA ANULADA». Las anuladas no cuentan en los totales ni en los exports.

## 4. Series de las simplificadas

**Norma:** art. 7.1.a) RD 1619/2012, último párrafo: «Cuando el empresario o profesional expida
facturas conforme a este artículo y al artículo 6 para la documentación de las operaciones
efectuadas en un mismo año natural, será obligatoria la expedición mediante series separadas de
unas y otras». Y art. 6.1.a).2.º: las rectificativas, en serie específica «en todo caso».

**Antes:** todo lo que no era rectificativa iba a la serie F, y todas las rectificativas a la R.

**Ahora:** una serie por clase de factura, impuesta en la base de datos (`sif_series.tipo`,
`sif_reservar_numero`):

| Clase | Tipos | Serie por defecto | Título del PDF |
|---|---|---|---|
| ordinaria | F1, F3 | `F` | FACTURA |
| simplificada | F2 | `S` | FACTURA SIMPLIFICADA |
| rectificativa | R1-R4 | `R` | FACTURA RECTIFICATIVA |
| rectificativa_simplificada | R5 | `RS` | FACTURA SIMPLIFICADA RECTIFICATIVA |

- Una serie no admite facturas de otra clase (`SIF_SERIE_CLASE`), ni en el mismo ejercicio ni en otro.
- La cadena de huellas sigue siendo **una** por obligado (art. 7 Orden): las series solo numeran.
- Simplificada = factura sin NIF del cliente. Límites del art. 4: 400 € IVA incluido, o 3.000 € en
  las actividades del art. 4.2. El formulario lo avisa; por encima de 3.000 € la emisión se rechaza
  (la AEAT también: Validaciones §15.8).
- Un NIF escrito que no es un NIF español válido ya no convierte la factura en simplificada en
  silencio: la emisión se rechaza (`nif_cliente_invalido`).

## 5. Migración

`supabase/migrations/20261120100000_sif_cumplimiento_exentas_series.sql` — idempotente, no toca
filas existentes: columnas `operacion_exenta` y `exencion_detalle` (+ CHECK), guard de inmutabilidad,
clases de `sif_series`, `sif_reservar_numero` y `sif_emitir_factura` (mismas firmas y permisos).

**Orden de despliegue: primero la migración, después el código.** Con el código desplegado y la
migración sin aplicar, crear una factura exenta falla (la columna no existe) y, con un obligado
activo, también la emisión.

## 6. Verificación

- `npm test`: 314 tests (311 correctos, 3 omitidos que ya lo estaban); 24 nuevos en
  `lib/verifactu/tests/v28-cumplimiento.test.mjs`.
- `npm run test:db`: 8 baterías en verde; la nueva `supabase/tests/v28-cumplimiento.test.mjs`
  (87 comprobaciones) emite en PGlite, con todas las migraciones, una completa, una simplificada,
  una exenta, rectificativas R1/R4/R5 y una anulación, y valida cada XML y el mensaje de remisión
  completo contra los XSD oficiales. Las baterías anteriores pasan también con la migración nueva
  aplicada encima.
- Sin envíos a la AEAT de producción.

## 7. Declaración responsable

Este cambio modifica el componente de facturación (contenido del registro de alta, numeración y
validaciones previas). La versión del sistema sigue en `1.0.0` en esta rama: **decidir si procede
una versión nueva y, con ella, una declaración responsable nueva es de Iván** (art. 13 RRSIF,
art. 15.1.c) Orden, FAQ AEAT de desarrolladores n.º 8 y 9). Hay que decidirlo antes de activar al
primer obligado, porque la versión viaja en cada registro (`SistemaInformatico.Version`).

## 8. Fuera de alcance (no cubierto)

Inversión del sujeto pasivo y operaciones no sujetas (S2, N1, N2), recargo de equivalencia,
retenciones del 1 % y del 19 %, clientes identificados con documento extranjero (`IDOtro`: NIF-IVA,
pasaporte), entregas intracomunitarias (E5), VIES/349, Facturae, rectificativa por sustitución,
factura en sustitución de simplificadas (F3), varios tipos de IVA en una factura.
