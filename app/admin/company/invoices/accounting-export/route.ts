import { NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getPlatformCompany, listPlatformSuppliers } from "@/lib/platform/companyDb";
import { listPlatformInvoices } from "@/lib/platform/companyInvoicesDb";
import { getPlatformExpenseCategoryLabel } from "@/lib/platform/platformExpenseCategories";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const company = await getPlatformCompany();
  if (!company) {
    return NextResponse.json({ error: "Société non configurée" }, { status: 400 });
  }

  const [invoices, suppliers] = await Promise.all([
    listPlatformInvoices(company.id),
    listPlatformSuppliers(company.id),
  ]);

  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const rows = invoices.filter((i) => i.status === "reviewed");

  const header = [
    "invoice_id",
    "supplier_name",
    "supplier_siret",
    "invoice_number",
    "invoice_date",
    "amount_ht",
    "amount_ttc",
    "expense_category",
    "source",
    "status",
  ];

  const csv = [
    header.map(csvCell).join(","),
    ...rows.map((inv) => {
      const supplier = inv.supplier_id ? supplierById.get(inv.supplier_id) : null;
      return [
        inv.id,
        supplier?.name ?? inv.supplier_name ?? "",
        supplier?.siret ?? "",
        inv.invoice_number ?? "",
        inv.invoice_date ?? "",
        inv.amount_ht ?? "",
        inv.amount_ttc ?? "",
        inv.expense_category ? getPlatformExpenseCategoryLabel(inv.expense_category) : "",
        (inv as { source?: string }).source ?? "upload",
        inv.status,
      ]
        .map(csvCell)
        .join(",");
    }),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ubion-factures-comptable.csv"`,
    },
  });
}
