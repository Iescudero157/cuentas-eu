import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// useGrouping "always" (26-nov-2026, Iván): es-ES agrupa por defecto solo desde 10.000 («1066,12 €»);
// así sale siempre «1.066,12 €». Los navegadores antiguos que no lo conocen siguen con su agrupación.
export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    useGrouping: "always",
  } as Intl.NumberFormatOptions).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(date));
}

export function getMonthName(date: Date | string): string {
  return new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(date));
}
