import { supabaseServer } from "@/lib/supabaseServer";
import { isExpenseCategory, type ExpenseCategory } from "@/lib/pocket/expenseCategories";
import type { PocketFixedChargeRow } from "@/lib/pocket/pocketReport";
import { listFixedCharges } from "@/lib/pocket/pocketReport";
import { listRestaurantInvestments, type RestaurantInvestmentRow } from "./investmentsDb";
import {
  ADMINISTRATIF_SECTORS,
  resolveChargeAdministratifSector,
  resolveInvestmentAdministratifSector,
  resolveInvoiceAdministratifSector,
  type AdministratifSectorId,
} from "./administratifSectors";

export type AdministratifInvoiceRow = {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  amountHt: number | null;
  amountTtc: number | null;
  expenseCategory: ExpenseCategory;
  supplierId: string;
  supplierName: string;
  status: string;
};

export type AdministratifSectorData = {
  id: AdministratifSectorId;
  charges: PocketFixedChargeRow[];
  investments: RestaurantInvestmentRow[];
  invoices: AdministratifInvoiceRow[];
};

function mapInvoice(row: Record<string, unknown>, supplierName: string): AdministratifInvoiceRow {
  const category = String(row.expense_category ?? "matieres");
  return {
    id: String(row.id),
    invoiceNumber: row.invoice_number ? String(row.invoice_number) : null,
    invoiceDate: row.invoice_date ? String(row.invoice_date) : null,
    amountHt: row.amount_ht != null ? Number(row.amount_ht) : null,
    amountTtc: row.amount_ttc != null ? Number(row.amount_ttc) : null,
    expenseCategory: isExpenseCategory(category) ? category : "matieres",
    supplierId: String(row.supplier_id),
    supplierName,
    status: String(row.status ?? "draft"),
  };
}

export async function loadAdministratifSectors(
  restaurantId: string,
  supplierNames: Record<string, string>
): Promise<AdministratifSectorData[]> {
  const [charges, investments, invoicesRaw] = await Promise.all([
    listFixedCharges(restaurantId),
    listRestaurantInvestments(restaurantId),
    supabaseServer
      .from("supplier_invoices")
      .select("id, invoice_number, invoice_date, amount_ht, amount_ttc, expense_category, supplier_id, status")
      .eq("restaurant_id", restaurantId)
      .order("invoice_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data ?? [];
      }),
  ]);

  const invoices = invoicesRaw.map((row) =>
    mapInvoice(row as Record<string, unknown>, supplierNames[String(row.supplier_id)] ?? "Fournisseur")
  );

  const emptyBucket = () => ({
    charges: [] as PocketFixedChargeRow[],
    investments: [] as RestaurantInvestmentRow[],
    invoices: [] as AdministratifInvoiceRow[],
  });

  const buckets = ADMINISTRATIF_SECTORS.reduce(
    (acc, sector) => {
      acc[sector.id] = emptyBucket();
      return acc;
    },
    {} as Record<
      AdministratifSectorId,
      {
        charges: PocketFixedChargeRow[];
        investments: RestaurantInvestmentRow[];
        invoices: AdministratifInvoiceRow[];
      }
    >
  );

  for (const charge of charges) {
    const sectorId = resolveChargeAdministratifSector(charge.category);
    if (!sectorId) continue;
    buckets[sectorId].charges.push(charge);
  }

  for (const investment of investments) {
    const sectorId = resolveInvestmentAdministratifSector();
    buckets[sectorId].investments.push(investment);
  }

  for (const invoice of invoices) {
    const sectorId = resolveInvoiceAdministratifSector(invoice.expenseCategory, invoice.supplierName);
    if (!sectorId) continue;
    buckets[sectorId].invoices.push(invoice);
  }

  return ADMINISTRATIF_SECTORS.map((sector) => ({
    id: sector.id,
    charges: buckets[sector.id].charges,
    investments: buckets[sector.id].investments,
    invoices: buckets[sector.id].invoices,
  }));
}
