# V21 · Documentación de usuario del módulo Verifactu

Fecha: 2026-09-21. Ítem V21 del plan Verifactu: guía «Activa Verifactu en Kuentas»,
preguntas frecuentes y sección de ayuda dentro de la app, en lenguaje llano y riguroso.

## Dónde vive el contenido

| Pieza | Ubicación | Acceso |
|---|---|---|
| Sección de ayuda (guía + FAQ + estados) | `app/dashboard/verifactu/ayuda/page.tsx` | `/dashboard/verifactu/ayuda` |
| Enlace «Ayuda» | Cabecera del panel `/dashboard/verifactu` (junto a «Actualizar») y en la tarjeta del modo demo («Qué es Verifactu») | — |

La página de ayuda es un componente de servidor **estático** (sin fetch ni estado):
el mismo contenido para todos los usuarios, incluido el modo demo. La FAQ usa
`<details>/<summary>` nativos (sin JavaScript).

## Fuente de verdad del contenido

Todos los datos normativos proceden de `docs/verifactu/SPEC.md` (verificado contra
BOE consolidado y sede AEAT en V02–V20). En concreto:

- **Obligados y plazos**: art. 3.1 RD 1007/2023; DF 4.ª en la redacción del
  **RD-ley 15/2025** → IS 01/01/2027, resto (autónomos IRPF, IRNR con EP, entidades
  en atribución) 01/07/2027. Excluidos: SII, territorios forales (TicketBAI/Navarra;
  Kuentas declara conformidad para territorio común), facturación sin SIF.
- **Remisión voluntaria (rodaje)** desde 2025: art. 15 RRSIF.
- **Inalterabilidad / prohibición de borrado**: art. 8.2 RD 1007/2023 (corrección =
  rectificativa R1–R5 o anulación, art. 11).
- **Reintentos si falla el envío**: art. 16 Orden HAC/1177/2024 (reintento ≥1/hora,
  `Incidencia=S`) — implementado en V10 (backoff 2→60 min, cadencia
  `TiempoEsperaEnvio`).
- **QR y leyenda**: arts. 20–21 Orden; «Factura verificable en la sede electrónica
  de la AEAT»; servicio de cotejo de la sede (verificado en vivo en V08/V17).
- **Permanencia/renuncia VERI*FACTU**: art. 17 Orden (hasta 31/12 del año en curso;
  renuncia antes de fin de año).
- **Sanciones**: art. 201 bis LGT (usuario: hasta 50.000 €/ejercicio; productor:
  régimen propio, 150.000 €).
- **Declaración responsable**: art. 13 RRSIF (no existe homologación AEAT); enlaza a
  la página pública `/verifactu` (V19).
- **Conservación/exportación**: art. 8 Orden; export ZIP del panel (V16).

Si en el futuro cambia la normativa o el flujo de la app, actualizar la página de
ayuda **y** este documento a la vez.

## Decisiones de redacción

- **Tuteo y lenguaje llano**, como el resto de la app; cada afirmación legal lleva su
  artículo entre paréntesis para poder auditarla, pero la frase se entiende sin él.
- **Canal de activación**: la página dice que la activación del módulo la realiza el
  equipo de Kuentas (coincide con el texto ya existente del panel V13; la decisión de
  cuándo/cómo activar `sif_config.activo` por cliente sigue siendo de Iván) y da como
  contacto `hola@kuentas.eu`, el email de contacto ya usado en portada, privacidad y
  términos de la app.
- **Sin promesas inventadas**: no se describe ningún flujo de autoactivación, alta
  online ni precios del módulo. No se menciona la app gratuita de la AEAT ni
  TicketBAI como servicios de Kuentas.
- Cierre con aviso «no constituye asesoramiento fiscal» y remisión al asesor.

## REVISIÓN IVAN (no bloquea)

- Confirmar que `hola@kuentas.eu` es el canal deseado para pedir la activación del
  módulo (¿o kuentas@mercadonet.es, usado en Precios→Business?).
- Cuando se defina el flujo comercial de alta del módulo (decisión pendiente desde
  V07), actualizar el paso 2 de la guía.
- Opcional: publicar una versión de esta guía en kuentas.eu al salir de mantenimiento
  (hoy solo existe dentro de la app).
