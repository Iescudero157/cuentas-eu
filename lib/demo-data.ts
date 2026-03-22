import type {
  Transaction, Invoice, MonthlyData, CashFlowProjection, UserProfile
} from "./types";

export const demoUser: UserProfile = {
  name: "Carlos Martinez Lopez",
  nif: "12345678A",
  email: "carlos@freelance.es",
  address: "Calle Gran Via 42, 3B, 28013 Madrid",
  activity: "Desarrollo web y diseno digital",
  plan: "autonomo",
};

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();

function dateStr(m: number, d: number): string {
  const y = m < 0 ? year - 1 : year;
  const realMonth = ((m % 12) + 12) % 12;
  return `${y}-${String(realMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const relMonth = (offset: number) => month + offset;

export const demoTransactions: Transaction[] = [
  // --- MES ACTUAL ---
  { id: genId(), type: "ingreso", description: "Desarrollo web - Restaurante La Tasca", amount: 2500, iva: 525, date: dateStr(relMonth(0), 3), source: "transferencia", client: "Restaurante La Tasca S.L." },
  { id: genId(), type: "ingreso", description: "Mantenimiento mensual - Clinica Dental Sonrie", amount: 450, iva: 94.5, date: dateStr(relMonth(0), 5), source: "stripe", client: "Clinica Dental Sonrie" },
  { id: genId(), type: "ingreso", description: "Diseno logo + branding - Startup XYZ", amount: 1800, iva: 378, date: dateStr(relMonth(0), 10), source: "paypal", client: "Startup XYZ" },
  { id: genId(), type: "ingreso", description: "Landing page - Inmobiliaria Costa", amount: 1200, iva: 252, date: dateStr(relMonth(0), 15), source: "transferencia", client: "Inmobiliaria Costa" },
  { id: genId(), type: "ingreso", description: "Consultoria UX - Banco Digital", amount: 3200, iva: 672, date: dateStr(relMonth(0), 18), source: "wise", client: "Banco Digital S.A." },

  { id: genId(), type: "gasto", description: "Figma Pro (anual prorrateado)", amount: 12, iva: 2.52, date: dateStr(relMonth(0), 1), source: "stripe", category: "software", aiCategorized: true },
  { id: genId(), type: "gasto", description: "GitHub Copilot", amount: 10, iva: 2.1, date: dateStr(relMonth(0), 1), source: "stripe", category: "software", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Vercel Pro", amount: 20, iva: 4.2, date: dateStr(relMonth(0), 1), source: "stripe", category: "software", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Coworking Impact Hub Madrid", amount: 250, iva: 52.5, date: dateStr(relMonth(0), 1), source: "transferencia", category: "coworking", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Linea movil autonomo Movistar", amount: 35, iva: 7.35, date: dateStr(relMonth(0), 5), source: "banco", category: "telefono", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Dominio cuentas.eu renovacion", amount: 15, iva: 3.15, date: dateStr(relMonth(0), 7), source: "stripe", category: "software", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Taxi a reunion cliente", amount: 18, iva: 1.8, date: dateStr(relMonth(0), 10), source: "efectivo", category: "transporte", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Comida reunion con cliente", amount: 42, iva: 4.2, date: dateStr(relMonth(0), 10), source: "efectivo", category: "comida", aiCategorized: false },
  { id: genId(), type: "gasto", description: "Adobe Creative Cloud", amount: 60, iva: 12.6, date: dateStr(relMonth(0), 12), source: "stripe", category: "software", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Google Ads campana cliente", amount: 150, iva: 31.5, date: dateStr(relMonth(0), 14), source: "stripe", category: "marketing", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Curso React Advanced Udemy", amount: 14.99, iva: 3.15, date: dateStr(relMonth(0), 16), source: "paypal", category: "formacion", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Seguro RC profesional", amount: 45, iva: 0, date: dateStr(relMonth(0), 20), source: "banco", category: "seguros", aiCategorized: false },

  // --- MES -1 ---
  { id: genId(), type: "ingreso", description: "App movil - Farmacia Online", amount: 4500, iva: 945, date: dateStr(relMonth(-1), 2), source: "transferencia", client: "Farmacia Online S.L." },
  { id: genId(), type: "ingreso", description: "SEO + Web - Abogado Martinez", amount: 1500, iva: 315, date: dateStr(relMonth(-1), 8), source: "stripe", client: "Despacho Martinez & Asociados" },
  { id: genId(), type: "ingreso", description: "Mantenimiento - Clinica Dental Sonrie", amount: 450, iva: 94.5, date: dateStr(relMonth(-1), 5), source: "stripe", client: "Clinica Dental Sonrie" },
  { id: genId(), type: "ingreso", description: "Diseno UI Kit - Agencia Pixel", amount: 2200, iva: 462, date: dateStr(relMonth(-1), 20), source: "paypal", client: "Agencia Pixel" },

  { id: genId(), type: "gasto", description: "Coworking Impact Hub Madrid", amount: 250, iva: 52.5, date: dateStr(relMonth(-1), 1), source: "transferencia", category: "coworking", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Software suscripciones varias", amount: 102, iva: 21.42, date: dateStr(relMonth(-1), 1), source: "stripe", category: "software", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Teclado mecanico", amount: 89, iva: 18.69, date: dateStr(relMonth(-1), 12), source: "stripe", category: "hardware", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Transportes varios", amount: 65, iva: 6.5, date: dateStr(relMonth(-1), 15), source: "efectivo", category: "transporte", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Material oficina", amount: 35, iva: 7.35, date: dateStr(relMonth(-1), 18), source: "efectivo", category: "material", aiCategorized: false },
  { id: genId(), type: "gasto", description: "Telefono", amount: 35, iva: 7.35, date: dateStr(relMonth(-1), 5), source: "banco", category: "telefono", aiCategorized: true },

  // --- MES -2 ---
  { id: genId(), type: "ingreso", description: "Rediseno web - Hotel Playa", amount: 3800, iva: 798, date: dateStr(relMonth(-2), 5), source: "transferencia", client: "Hotel Playa S.A." },
  { id: genId(), type: "ingreso", description: "Consultoria tech - Startup Beta", amount: 2000, iva: 420, date: dateStr(relMonth(-2), 12), source: "wise", client: "Startup Beta" },
  { id: genId(), type: "ingreso", description: "Mantenimiento - Clinica Dental Sonrie", amount: 450, iva: 94.5, date: dateStr(relMonth(-2), 5), source: "stripe", client: "Clinica Dental Sonrie" },

  { id: genId(), type: "gasto", description: "Coworking + software", amount: 352, iva: 73.92, date: dateStr(relMonth(-2), 1), source: "transferencia", category: "coworking", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Monitor ultrawide 34''", amount: 420, iva: 88.2, date: dateStr(relMonth(-2), 10), source: "stripe", category: "hardware", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Gastos varios mes", amount: 180, iva: 37.8, date: dateStr(relMonth(-2), 20), source: "efectivo", category: "otros", aiCategorized: false },

  // --- MES -3 ---
  { id: genId(), type: "ingreso", description: "Ecommerce - Tienda Moda", amount: 5500, iva: 1155, date: dateStr(relMonth(-3), 3), source: "transferencia", client: "Tienda Moda Online S.L." },
  { id: genId(), type: "ingreso", description: "Web corporativa - Consultora ABC", amount: 2800, iva: 588, date: dateStr(relMonth(-3), 15), source: "stripe", client: "Consultora ABC" },
  { id: genId(), type: "ingreso", description: "Mantenimiento - Clinica Dental", amount: 450, iva: 94.5, date: dateStr(relMonth(-3), 5), source: "stripe", client: "Clinica Dental Sonrie" },

  { id: genId(), type: "gasto", description: "Coworking + software + telefono", amount: 387, iva: 81.27, date: dateStr(relMonth(-3), 1), source: "transferencia", category: "coworking", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Publicidad redes sociales", amount: 200, iva: 42, date: dateStr(relMonth(-3), 8), source: "stripe", category: "marketing", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Gastos varios", amount: 120, iva: 25.2, date: dateStr(relMonth(-3), 25), source: "efectivo", category: "otros", aiCategorized: false },

  // --- MES -4 ---
  { id: genId(), type: "ingreso", description: "App React Native - Gym Fit", amount: 6000, iva: 1260, date: dateStr(relMonth(-4), 2), source: "transferencia", client: "Gym Fit S.L." },
  { id: genId(), type: "ingreso", description: "Asesoria digital", amount: 800, iva: 168, date: dateStr(relMonth(-4), 20), source: "paypal", client: "Freelance Juan" },

  { id: genId(), type: "gasto", description: "Gastos fijos mensuales", amount: 420, iva: 88.2, date: dateStr(relMonth(-4), 1), source: "transferencia", category: "software", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Conferencia tech Madrid", amount: 150, iva: 31.5, date: dateStr(relMonth(-4), 14), source: "stripe", category: "formacion", aiCategorized: true },

  // --- MES -5 ---
  { id: genId(), type: "ingreso", description: "Proyecto web - Restaurante El Buen Sabor", amount: 3200, iva: 672, date: dateStr(relMonth(-5), 5), source: "transferencia", client: "El Buen Sabor S.L." },
  { id: genId(), type: "ingreso", description: "Diseno grafico varios", amount: 1400, iva: 294, date: dateStr(relMonth(-5), 18), source: "paypal", client: "Varios clientes" },
  { id: genId(), type: "ingreso", description: "Mantenimiento - Clinica Dental", amount: 450, iva: 94.5, date: dateStr(relMonth(-5), 5), source: "stripe", client: "Clinica Dental Sonrie" },

  { id: genId(), type: "gasto", description: "Gastos fijos mensuales", amount: 400, iva: 84, date: dateStr(relMonth(-5), 1), source: "transferencia", category: "software", aiCategorized: true },
  { id: genId(), type: "gasto", description: "Nuevo raton ergonomico", amount: 75, iva: 15.75, date: dateStr(relMonth(-5), 10), source: "stripe", category: "hardware", aiCategorized: true },
];

export const demoInvoices: Invoice[] = [
  {
    id: genId(), number: "FACT-2026-001", clientName: "Restaurante La Tasca S.L.", clientNif: "B12345678",
    clientAddress: "Calle Serrano 15, 28001 Madrid",
    items: [{ description: "Desarrollo sitio web responsive", quantity: 1, unitPrice: 2500, total: 2500 }],
    subtotal: 2500, iva: 525, ivaRate: 21, irpf: 375, irpfRate: 15, total: 2650,
    date: dateStr(relMonth(0), 3), dueDate: dateStr(relMonth(0), 18), status: "cobrada",
  },
  {
    id: genId(), number: "FACT-2026-002", clientName: "Startup XYZ", clientNif: "B87654321",
    clientAddress: "Paseo de la Castellana 200, 28046 Madrid",
    items: [
      { description: "Diseno de logotipo", quantity: 1, unitPrice: 800, total: 800 },
      { description: "Manual de identidad corporativa", quantity: 1, unitPrice: 600, total: 600 },
      { description: "Papeleria corporativa", quantity: 1, unitPrice: 400, total: 400 },
    ],
    subtotal: 1800, iva: 378, ivaRate: 21, irpf: 270, irpfRate: 15, total: 1908,
    date: dateStr(relMonth(0), 10), dueDate: dateStr(relMonth(0), 25), status: "pendiente",
  },
  {
    id: genId(), number: "FACT-2026-003", clientName: "Clinica Dental Sonrie", clientNif: "B11111111",
    clientAddress: "Calle Alcala 75, 28009 Madrid",
    items: [{ description: "Mantenimiento web mensual", quantity: 1, unitPrice: 450, total: 450 }],
    subtotal: 450, iva: 94.5, ivaRate: 21, irpf: 67.5, irpfRate: 15, total: 477,
    date: dateStr(relMonth(0), 5), dueDate: dateStr(relMonth(0), 20), status: "cobrada",
  },
  {
    id: genId(), number: "FACT-2026-004", clientName: "Inmobiliaria Costa", clientNif: "B22222222",
    clientAddress: "Av. del Mediterraneo 10, 03001 Alicante",
    items: [{ description: "Landing page inmobiliaria con buscador", quantity: 1, unitPrice: 1200, total: 1200 }],
    subtotal: 1200, iva: 252, ivaRate: 21, irpf: 180, irpfRate: 15, total: 1272,
    date: dateStr(relMonth(0), 15), dueDate: dateStr(relMonth(1), 15), status: "pendiente",
  },
  {
    id: genId(), number: "FACT-2026-005", clientName: "Banco Digital S.A.", clientNif: "A99999999",
    clientAddress: "Plaza de Colon 1, 28001 Madrid",
    items: [
      { description: "Consultoria UX (40 horas)", quantity: 40, unitPrice: 80, total: 3200 },
    ],
    subtotal: 3200, iva: 672, ivaRate: 21, irpf: 480, irpfRate: 15, total: 3392,
    date: dateStr(relMonth(0), 18), dueDate: dateStr(relMonth(1), 18), status: "pendiente",
  },
  {
    id: genId(), number: "FACT-2025-048", clientName: "Farmacia Online S.L.", clientNif: "B33333333",
    clientAddress: "Calle Mayor 8, 28012 Madrid",
    items: [{ description: "Desarrollo app movil farmacia", quantity: 1, unitPrice: 4500, total: 4500 }],
    subtotal: 4500, iva: 945, ivaRate: 21, irpf: 675, irpfRate: 15, total: 4770,
    date: dateStr(relMonth(-1), 2), dueDate: dateStr(relMonth(-1), 17), status: "cobrada",
  },
];

export function getMonthlyData(): MonthlyData[] {
  const months: MonthlyData[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = relMonth(-i);
    const realMonth = ((m % 12) + 12) % 12;
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    const monthTx = demoTransactions.filter((t) => {
      const d = new Date(t.date);
      const txMonth = d.getMonth();
      return txMonth === realMonth;
    });

    const ingresos = monthTx.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
    const gastos = monthTx.filter((t) => t.type === "gasto").reduce((s, t) => s + t.amount, 0);

    months.push({
      month: monthNames[realMonth],
      ingresos,
      gastos,
      beneficio: ingresos - gastos,
    });
  }
  return months;
}

export function getCashFlowProjection(): CashFlowProjection[] {
  const monthlyData = getMonthlyData();
  const avgIngresos = monthlyData.reduce((s, m) => s + m.ingresos, 0) / monthlyData.length;
  const avgGastos = monthlyData.reduce((s, m) => s + m.gastos, 0) / monthlyData.length;

  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  let saldo = monthlyData.reduce((s, m) => s + m.beneficio, 0);

  const projection: CashFlowProjection[] = monthlyData.map((m) => ({
    month: m.month,
    ingresos: m.ingresos,
    gastos: m.gastos,
    saldo: (saldo = m.beneficio + (saldo > 0 ? saldo * 0.1 : 0), m.beneficio),
    projected: false,
  }));

  let accSaldo = monthlyData.reduce((s, m) => s + m.beneficio, 0);
  for (let i = 1; i <= 3; i++) {
    const futureMonth = (month + i) % 12;
    const variation = 1 + (Math.random() * 0.2 - 0.1);
    const ing = Math.round(avgIngresos * variation);
    const gas = Math.round(avgGastos * (1 + Math.random() * 0.1));
    accSaldo += ing - gas;
    projection.push({
      month: monthNames[futureMonth],
      ingresos: ing,
      gastos: gas,
      saldo: accSaldo,
      projected: true,
    });
  }

  return projection;
}

export function getCurrentMonthStats() {
  const currentMonth = month;
  const currentTx = demoTransactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === year;
  });

  const ingresos = currentTx.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
  const gastos = currentTx.filter((t) => t.type === "gasto").reduce((s, t) => s + t.amount, 0);
  const beneficio = ingresos - gastos;

  const ivaRep = currentTx.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.iva, 0);
  const ivaSop = currentTx.filter((t) => t.type === "gasto").reduce((s, t) => s + t.iva, 0);
  const impuestosEstimados = Math.max(0, ivaRep - ivaSop) + Math.max(0, beneficio * 0.2);

  return { ingresos, gastos, beneficio, impuestosEstimados };
}
