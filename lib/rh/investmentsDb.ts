import { supabaseServer } from "@/lib/supabaseServer";
import { isExpenseCategory, type ExpenseCategory } from "@/lib/pocket/expenseCategories";

export type RestaurantInvestmentRow = {
  id: string;
  restaurantId: string;
  label: string;
  expenseCategory: ExpenseCategory;
  acquisitionDate: string | null;
  amountTotal: number;
  amortizationYears: number | null;
  monthlyAmortization: number | null;
  supplierInvoiceId: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: Record<string, unknown>): RestaurantInvestmentRow {
  const category = String(row.expense_category ?? "financier");
  return {
    id: String(row.id),
    restaurantId: String(row.restaurant_id),
    label: String(row.label),
    expenseCategory: isExpenseCategory(category) ? category : "financier",
    acquisitionDate: row.acquisition_date ? String(row.acquisition_date) : null,
    amountTotal: Number(row.amount_total) || 0,
    amortizationYears: row.amortization_years != null ? Number(row.amortization_years) : null,
    monthlyAmortization: row.monthly_amortization != null ? Number(row.monthly_amortization) : null,
    supplierInvoiceId: row.supplier_invoice_id ? String(row.supplier_invoice_id) : null,
    notes: row.notes ? String(row.notes) : null,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function computeMonthlyAmortization(amountTotal: number, years: number | null): number | null {
  if (years == null || years <= 0 || amountTotal <= 0) return null;
  return Math.round((amountTotal / (years * 12)) * 100) / 100;
}

export async function listRestaurantInvestments(restaurantId: string): Promise<RestaurantInvestmentRow[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_investments")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("active", true)
    .order("acquisition_date", { ascending: false, nullsFirst: false })
    .order("label");

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function insertRestaurantInvestment(params: {
  restaurantId: string;
  label: string;
  expenseCategory: ExpenseCategory;
  acquisitionDate?: string | null;
  amountTotal: number;
  amortizationYears?: number | null;
  supplierInvoiceId?: string | null;
  notes?: string | null;
}): Promise<RestaurantInvestmentRow> {
  const monthly = computeMonthlyAmortization(params.amountTotal, params.amortizationYears ?? null);
  const { data, error } = await supabaseServer
    .from("restaurant_investments")
    .insert({
      restaurant_id: params.restaurantId,
      label: params.label.trim(),
      expense_category: params.expenseCategory,
      acquisition_date: params.acquisitionDate ?? null,
      amount_total: params.amountTotal,
      amortization_years: params.amortizationYears ?? null,
      monthly_amortization: monthly,
      supplier_invoice_id: params.supplierInvoiceId ?? null,
      notes: params.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deleteRestaurantInvestment(restaurantId: string, investmentId: string): Promise<void> {
  const { error } = await supabaseServer
    .from("restaurant_investments")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", investmentId);

  if (error) throw new Error(error.message);
}
