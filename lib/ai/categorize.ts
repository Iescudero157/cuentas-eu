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

export interface CategorizeResult {
  category: ExpenseCategory;
  confidence: number;
  deductible: boolean;
  reason: string;
}

export async function categorizeExpense(description: string, amount: number): Promise<CategorizeResult> {
  const response = await fetch("/api/ai/categorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, amount }),
  });

  if (!response.ok) {
    throw new Error(`Categorization failed: ${response.statusText}`);
  }

  return response.json();
}
