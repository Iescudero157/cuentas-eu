// Planes de KUENTAS.EU y caducidad mensual (8-nov-2026).
//
// Cada pago confirmado cubre UN mes, lo cobre Stripe (desde el 13-nov-2026) o el TPV de BBVA (Redsys), según
// lib/pasarela.ts; los dos avisos aplican el pago con lib/pago-plan.ts. La nueva caducidad es la mayor entre
// «ahora» y la caducidad vigente, más un mes. No hay cargos automáticos: antes de caducar se avisa por email con
// el enlace para renovar. Una cuenta caducada conserva las funciones de pago DIAS_GRACIA días y después la app la
// trata como Gratis (sin borrar nada). Sin caducidad (null o columna aún sin crear) = cuenta anterior a este
// sistema o con una suscripción de Stripe de las de antes: no caduca, como hasta ahora.
//
// Sin dependencias: lo importan la app y los tests de Node (type-stripping), así que solo sintaxis borrable.

export type Plan = "gratis" | "autonomo" | "creator" | "business";

export const PLANES_DE_PAGO: readonly Plan[] = ["autonomo", "creator", "business"];

/** Importe de cada plan en céntimos, IVA incluido: lo que se cobra por cada mes, con Stripe o con el TPV de BBVA. */
export const IMPORTE_CENTIMOS: Record<string, number> = {
  autonomo: 999,
  creator: 1999,
  business: 2999,
};

export const NOMBRE_PLAN: Record<Plan, string> = {
  gratis: "Gratis",
  autonomo: "Autónomo",
  creator: "Creator",
  business: "Business",
};

export const DIAS_GRACIA = 7;
const DIA_MS = 86_400_000;
const ZONA = "Europe/Madrid";

export interface DatosPlan {
  plan?: string | null;
  plan_expires_at?: string | null;
}

export function esPlanDePago(plan: string | null | undefined): plan is Plan {
  return plan === "autonomo" || plan === "creator" || plan === "business";
}

function fechaValida(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Suma un mes natural. Si ese día no existe en el mes siguiente (31 de enero), usa el último día del mes. */
export function sumarUnMes(fecha: Date): Date {
  const anio = fecha.getUTCFullYear();
  const mes = fecha.getUTCMonth();
  const ultimoDiaMesSiguiente = new Date(Date.UTC(anio, mes + 2, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      anio,
      mes + 1,
      Math.min(fecha.getUTCDate(), ultimoDiaMesSiguiente),
      fecha.getUTCHours(),
      fecha.getUTCMinutes(),
      fecha.getUTCSeconds(),
      fecha.getUTCMilliseconds(),
    ),
  );
}

/** Caducidad tras un pago confirmado: la mayor entre ahora y la caducidad vigente, más un mes. */
export function nuevaCaducidad(vigente: string | null | undefined, ahora: Date = new Date()): Date {
  const actual = fechaValida(vigente);
  const base = actual && actual.getTime() > ahora.getTime() ? actual : ahora;
  return sumarUnMes(base);
}

/** Fecha natural en Madrid (AAAA-MM-DD) de un instante. */
export function fechaMadrid(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

/** Días naturales (en Madrid) desde hoy hasta la fecha dada: 0 = hoy, 1 = mañana, -1 = ayer. */
export function diasNaturalesHasta(fecha: Date, ahora: Date = new Date()): number {
  const hoy = Date.parse(`${fechaMadrid(ahora)}T00:00:00Z`);
  const objetivo = Date.parse(`${fechaMadrid(fecha)}T00:00:00Z`);
  return Math.round((objetivo - hoy) / DIA_MS);
}

export type Situacion = "gratis" | "sin_caducidad" | "vigente" | "gracia" | "caducado";

export interface EstadoPlan {
  /** Plan pagado (o Gratis). */
  contratado: Plan;
  /** Plan que aplica la app hoy: Gratis si caducó hace más de DIAS_GRACIA días. */
  efectivo: Plan;
  situacion: Situacion;
  caducaEl: Date | null;
  finGracia: Date | null;
  /** Días naturales hasta la caducidad (negativo si ya caducó); null si no hay caducidad. */
  diasParaCaducar: number | null;
}

export function estadoPlan(datos: DatosPlan | null | undefined, ahora: Date = new Date()): EstadoPlan {
  const planGuardado = datos?.plan;
  const contratado: Plan = esPlanDePago(planGuardado) ? planGuardado : "gratis";
  const vacio = { caducaEl: null, finGracia: null, diasParaCaducar: null };
  if (contratado === "gratis") {
    return { contratado, efectivo: "gratis", situacion: "gratis", ...vacio };
  }
  const caducaEl = fechaValida(datos?.plan_expires_at);
  if (!caducaEl) {
    return { contratado, efectivo: contratado, situacion: "sin_caducidad", ...vacio };
  }
  const finGracia = new Date(caducaEl.getTime() + DIAS_GRACIA * DIA_MS);
  const diasParaCaducar = diasNaturalesHasta(caducaEl, ahora);
  const t = ahora.getTime();
  if (t < caducaEl.getTime()) {
    return { contratado, efectivo: contratado, situacion: "vigente", caducaEl, finGracia, diasParaCaducar };
  }
  if (t < finGracia.getTime()) {
    return { contratado, efectivo: contratado, situacion: "gracia", caducaEl, finGracia, diasParaCaducar };
  }
  return { contratado, efectivo: "gratis", situacion: "caducado", caducaEl, finGracia, diasParaCaducar };
}

/** Plan que aplica la app (lo que deciden las rutas de pago y la interfaz). */
export function planEfectivo(datos: DatosPlan | null | undefined, ahora: Date = new Date()): Plan {
  return estadoPlan(datos, ahora).efectivo;
}

export type TipoAviso = "d7" | "d1" | "d0";

/**
 * Aviso por email que toca según los días que faltan para caducar: «d7» de 7 a 2 días, «d1» el día antes y
 * «d0» el día de la caducidad o, si ese día no salió, durante la gracia. Cada aviso sale una vez por caducidad.
 */
export function avisoQueToca(dias: number | null): TipoAviso | null {
  if (dias === null) return null;
  if (dias >= 2 && dias <= 7) return "d7";
  if (dias === 1) return "d1";
  if (dias <= 0 && dias >= -DIAS_GRACIA) return "d0";
  return null;
}

/** Clave con la que se anota un aviso enviado para una caducidad concreta (la lista se vacía en cada pago). */
export function claveAviso(tipo: TipoAviso, caducaEl: Date): string {
  return `${tipo}@${fechaMadrid(caducaEl)}`;
}
