# V22 · Export contable «ClassicConta (AIG)» — plan Business

Función del plan Business (decisión D3 del plan maestro «Kuentas × ClassicConta —
Plan de Integración y Verifactu», 07/09/2026): exportar las facturas de venta de un
período a los dos ficheros ASCII de ancho fijo que acepta el **Importador de
Asientos** de ClassicConta 6/7 (Herramientas > Importación de datos), para que la
gestoría del cliente los contabilice sin teclear nada.

## Piezas

| Pieza | Fichero |
|---|---|
| Generador (puro, sin BD) | `lib/export-contable/classicconta.ts` |
| API (auth + plan Business) | `GET /api/invoices/export-classicconta?desde&hasta&asiento&digitos` |
| UI | Facturas → «Exportar a contabilidad» → **ClassicConta (AIG)** (modal con rango de fechas y primer asiento) |
| Tests | `lib/export-contable/tests/v22-classicconta.test.mjs` (en `npm test`) |

El ZIP descargado contiene `CC_subcuentas.txt`, `CC_diario.txt` y `LEEME.txt`
(instrucciones de importación; **siempre subcuentas primero, diario después**).

## Formato (fuente normativa del layout)

Protocolo de Comunicación Conta6 de AIG, documento público
(`aigclassic.com/download/pdf/Protocolo_Comunicacion_Conta6.pdf`, copia en este
directorio, SHA-256 `901c56a6236fbbe39f01a7b543ffd8dd53785d637f653de33a46798b56133baf`):

- **Diario**: 16 campos, **869 caracteres/registro** (pág. 6): Asien N6, Fecha F8
  (aaaammdd), Subcta C12, reservado 28, Concepto C25, reservado 50, Documento C10,
  reservado 3, Clave C6, reservado 90, EuroDebe N16, EuroHaber N16, reservado 68,
  Rectifica L1, reservado 529, TipoFac C1.
- **Subcuentas**: 20 campos, **444 caracteres/registro** (pág. 4): Cod C12,
  Titulo C40, NIF C15, Domicilio C35, Poblacion C25, Provincia C20, CodPostal C5,
  reservado 8, TipoIVA C1, reservado 46, TPC N5, RecEquiv N5, Fax C15, Email C50,
  reservado 100, IdNif N1, CodPais C2, Rep14NIF C9, reservado 45, nIRPF N5.

El formato exacto de cada campo se verificó **posición a posición contra los
ficheros reales** `CC_diario.txt` (2.001 apuntes) y `CC_subcuentas.txt` (93
subcuentas) que se importaron con éxito en la contabilidad interna de Mercadonet
(647 asientos sin incidencias). Donde el protocolo es ambiguo se sigue el formato
probado:

- Importes N16 **con punto decimal** y 2 decimales, ceros a la izquierda, signo
  negativo delante de los ceros (`-000000003693.95`). (La regla práctica «importes
  sin separador decimal» del Anexo A del plan maestro es una errata: los ficheros
  realmente importados llevan punto decimal.)
- Registros separados por **CRLF**, con CRLF también tras el último.
- Codificación **ANSI (Windows-1252)**; lo no representable se translitera
  (`…`→`...`, `€`→`EUR`, tipográficas→ASCII, diacríticos fuera de latin1 se
  despojan).
- En subcuentas, TPC/RecEquiv/nIRPF a `00000` también en las de IVA y TipoIVA en
  blanco, como en el fichero probado (el importador de CC7 calcula el registro de
  IVA a partir de la estructura del asiento).

## Mapeo factura → asiento (Anexo A.2 del plan maestro)

Un asiento por factura (la app almacena un único tipo de IVA por factura):

| Subcuenta (plan de 9 dígitos por defecto) | D/H | Importe |
|---|---|---|
| `430HHHHHH` cliente | Debe | total a cobrar (base + IVA − IRPF) |
| `473000000` HP retenciones y pagos a cuenta | Debe | retención IRPF (solo si la hay) |
| `705000000` prestaciones de servicios | Haber | base imponible |
| `4770000TT` HP IVA repercutido (TT = tipo: 21/10/04) | Haber | cuota de IVA (solo si ≠ 0) |

- **El asiento cuadra siempre por construcción**: el Debe del cliente se deriva de
  base/cuota/retención. Si el `total` almacenado difiere en más de 1 céntimo se
  añade un AVISO al LEEME (nunca se genera un fichero descuadrado).
- **Rectificativas R1–R5**: mismos apuntes con los importes tal cual están
  almacenados (negativos) y `Rectifica='T'`. `TipoFac='E'` (factura emitida) en
  todos los apuntes de venta.
- **Códigos de cliente estables**: `430` + hash FNV-1a de la clave del cliente
  (client_id > NIF normalizado > nombre) dentro del espacio de sufijos del plan;
  las colisiones se resuelven por sondeo lineal. El mismo cliente recibe el mismo
  código en todos los exports, aunque cambie el período.
- Concepto = `Fra. <número>` (25 c), Documento = últimos 10 caracteres del número.
- Dígitos de subcuenta configurables (6–12; por defecto 9, el desglose de la
  contabilidad interna de Mercadonet). Número del primer asiento configurable
  (correlativo del ejercicio destino, requisito práctico validado del importador).

## Alcance del export

- Rango por **fecha de expedición** (`date`); número = `numero_fiscal` (Verifactu)
  o `number` (legacy).
- Con el módulo Verifactu **activo**: solo facturas `emitida` y `rectificada`
  (las `anulada` y los borradores no entran en contabilidad).
- Sin Verifactu (flujo legacy): todas las facturas del período, que en ese flujo
  son las facturas reales del usuario.
- Gating: `profiles.plan === 'business'` (403 con mensaje de upsell en caso
  contrario). El modo demo no tiene sesión: la UI lo comunica sin llamar a la API.

## Límites conocidos (documentados a propósito)

- Solo facturas de venta (el espejo de compras/gastos del Anexo A.2 queda fuera de
  V22: los gastos de la app no tienen hoy NIF de proveedor ni desglose de IVA
  estructurado con garantías).
- Población/provincia/CP de la subcuenta van en blanco (la dirección de la app no
  está estructurada); el domicilio completo va en el campo Domicilio.
- La importación real en CC7 de un ZIP generado por Kuentas queda pendiente de
  verificarse cuando la suscripción de ClassicConta esté reactivada (D2 del plan
  maestro): el modo demo caducado de CC7 es solo-consulta y no permite importar.
  El formato es idéntico byte a byte al validado con 647 asientos reales.
