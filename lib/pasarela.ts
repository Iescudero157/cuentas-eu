// Pasarela con la que KUENTAS.EU cobra sus planes (13-nov-2026).
//
// INTERRUPTOR DE UNA LÍNEA (la de PASARELA_COBRO):
//   "stripe" → Stripe Checkout, pago único (decisión de Iván del 13-nov-2026).
//   "redsys" → TPV Virtual de BBVA (Redsys), como hasta el 13-nov-2026. Su código sigue intacto.
// Decide a qué ruta llaman los botones de pago de Precios y Ajustes y qué pasarela nombran los textos (precios,
// términos, privacidad y el aviso de caducidad por email). Los avisos de las dos pasarelas (/api/stripe/webhook y
// /api/redsys/notify) siguen activos siempre, para los pagos que se confirmen tarde. Con cualquiera de las dos,
// cada pago cubre un mes del plan y no hay cargos automáticos (lib/plan.ts y lib/pago-plan.ts).
//
// Sin dependencias: lo importan componentes de cliente, rutas de servidor y los tests de Node.

export type Pasarela = "stripe" | "redsys";

export const PASARELA_COBRO = "stripe" as Pasarela;
