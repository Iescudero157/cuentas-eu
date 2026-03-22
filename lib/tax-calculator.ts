import type { Transaction, TaxEstimation, FiscalAlert } from "./types";

const IVA_GENERAL = 0.21;
const IRPF_AUTONOMO = 0.20;

export function calculateQuarterlyTax(
  transactions: Transaction[],
  quarter: number,
  year: number
): TaxEstimation {
  const quarterMonths = getQuarterMonths(quarter);
  const quarterTransactions = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && quarterMonths.includes(d.getMonth() + 1);
  });

  const ingresos = quarterTransactions.filter((t) => t.type === "ingreso");
  const gastos = quarterTransactions.filter((t) => t.type === "gasto");

  const ingresosBrutos = ingresos.reduce((sum, t) => sum + t.amount, 0);
  const ivaRepercutido = ingresos.reduce((sum, t) => sum + t.iva, 0);
  const gastosDeducibles = gastos.reduce((sum, t) => sum + t.amount, 0);
  const ivaSoportado = gastos.reduce((sum, t) => sum + t.iva, 0);

  const ivaAPagar = Math.max(0, ivaRepercutido - ivaSoportado);
  const beneficioNeto = ingresosBrutos - gastosDeducibles;
  const irpfAPagar = Math.max(0, beneficioNeto * IRPF_AUTONOMO);

  const quarterNames = ["Q1 (Ene-Mar)", "Q2 (Abr-Jun)", "Q3 (Jul-Sep)", "Q4 (Oct-Dic)"];

  return {
    quarter: quarterNames[quarter - 1],
    ivaRepercutido,
    ivaSoportado,
    ivaAPagar,
    ingresosBrutos,
    gastosDeducibles,
    beneficioNeto,
    irpfAPagar,
    totalImpuestos: ivaAPagar + irpfAPagar,
  };
}

function getQuarterMonths(quarter: number): number[] {
  switch (quarter) {
    case 1: return [1, 2, 3];
    case 2: return [4, 5, 6];
    case 3: return [7, 8, 9];
    case 4: return [10, 11, 12];
    default: return [1, 2, 3];
  }
}

export function getCurrentQuarter(): number {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

export function getFiscalAlerts(): FiscalAlert[] {
  const now = new Date();
  const year = now.getFullYear();

  const deadlines = [
    { modelo: "303", description: "IVA Trimestral (Q4 anterior)", date: `${year}-01-20`, quarter: 4 },
    { modelo: "130", description: "IRPF Trimestral (Q4 anterior)", date: `${year}-01-20`, quarter: 4 },
    { modelo: "303", description: "IVA Trimestral (Q1)", date: `${year}-04-20`, quarter: 1 },
    { modelo: "130", description: "IRPF Trimestral (Q1)", date: `${year}-04-20`, quarter: 1 },
    { modelo: "100", description: "Declaracion Renta Anual", date: `${year}-06-30`, quarter: 0 },
    { modelo: "303", description: "IVA Trimestral (Q2)", date: `${year}-07-20`, quarter: 2 },
    { modelo: "130", description: "IRPF Trimestral (Q2)", date: `${year}-07-20`, quarter: 2 },
    { modelo: "303", description: "IVA Trimestral (Q3)", date: `${year}-10-20`, quarter: 3 },
    { modelo: "130", description: "IRPF Trimestral (Q3)", date: `${year}-10-20`, quarter: 3 },
    { modelo: "390", description: "Resumen Anual IVA", date: `${year + 1}-01-30`, quarter: 0 },
  ];

  return deadlines
    .map((d, i) => {
      const dueDate = new Date(d.date);
      const diff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: `alert-${i}`,
        modelo: `Modelo ${d.modelo}`,
        description: d.description,
        dueDate: d.date,
        daysLeft: diff,
        urgent: diff <= 15 && diff >= 0,
      };
    })
    .filter((a) => a.daysLeft >= 0 && a.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function calculateMonthlyTaxReserve(
  monthlyIncome: number,
  monthlyExpenses: number
): { iva: number; irpf: number; total: number } {
  const ivaRepercutido = monthlyIncome * IVA_GENERAL;
  const ivaSoportado = monthlyExpenses * IVA_GENERAL;
  const iva = Math.max(0, ivaRepercutido - ivaSoportado);

  const beneficio = monthlyIncome - monthlyExpenses;
  const irpf = Math.max(0, beneficio * IRPF_AUTONOMO);

  return { iva, irpf, total: iva + irpf };
}
