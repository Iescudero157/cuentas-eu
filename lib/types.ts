export type TransactionType = "ingreso" | "gasto";
export type TransactionSource = "stripe" | "paypal" | "transferencia" | "efectivo" | "wise" | "banco";
export type InvoiceStatus = "cobrada" | "pendiente" | "vencida";
export type ExpenseCategory =
  | "software"
  | "hardware"
  | "coworking"
  | "transporte"
  | "comida"
  | "marketing"
  | "telefono"
  | "formacion"
  | "seguros"
  | "material"
  | "servicios"
  | "otros";

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  iva: number;
  date: string;
  source: TransactionSource;
  category?: ExpenseCategory;
  aiCategorized?: boolean;
  client?: string;
}

export interface Invoice {
  id: string;
  number: string;
  clientName: string;
  clientNif: string;
  clientAddress: string;
  items: InvoiceItem[];
  subtotal: number;
  iva: number;
  ivaRate: number;
  irpf: number;
  irpfRate: number;
  total: number;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface TaxEstimation {
  quarter: string;
  ivaRepercutido: number;
  ivaSoportado: number;
  ivaAPagar: number;
  ingresosBrutos: number;
  gastosDeducibles: number;
  beneficioNeto: number;
  irpfAPagar: number;
  totalImpuestos: number;
}

export interface MonthlyData {
  month: string;
  ingresos: number;
  gastos: number;
  beneficio: number;
}

export interface CashFlowProjection {
  month: string;
  ingresos: number;
  gastos: number;
  saldo: number;
  projected: boolean;
}

export interface FiscalAlert {
  id: string;
  modelo: string;
  description: string;
  dueDate: string;
  daysLeft: number;
  urgent: boolean;
}

export interface UserProfile {
  name: string;
  nif: string;
  email: string;
  address: string;
  activity: string;
  plan: "gratis" | "autonomo" | "creator" | "business";
}
