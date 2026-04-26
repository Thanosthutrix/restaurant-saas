import { NextResponse } from "next/server";
import { getRestaurantForPage } from "@/lib/auth";
import { getSupplierInvoicesForRestaurant, getSuppliers } from "@/lib/db";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const [invoicesRes, suppliersRes] = await Promise.all([
    getSupplierInvoicesForRestaurant(restaurant.id),
    getSuppliers(restaurant.id, false),
  ]);

  if (invoicesRes.error) {
    return NextResponse.json({ error: invoicesRes.error.message }, { status: 500 });
  }

  const suppliers = new Map((suppliersRes.data ?? []).map((s) => [s.id, s]));
  const rows = (invoicesRes.data ?? []).filter((inv) => inv.status === "reviewed");
  const header = [
    "invoice_id",
    "supplier_name",
    "supplier_id",
    "invoice_number",
    "invoice_date",
    "amount_ht",
    "amount_ttc",
    "file_url",
    "status",
  ];
  const csv = [
    header.map(csvCell).join(","),
    ...rows.map((inv) =>
      [
        inv.id,
        suppliers.get(inv.supplier_id)?.name ?? "",
        inv.supplier_id,
        inv.invoice_number ?? "",
        inv.invoice_date ?? "",
        inv.amount_ht ?? "",
        inv.amount_ttc ?? "",
        inv.file_url ?? "",
        inv.status,
      ]
        .map(csvCell)
        .join(",")
    ),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="factures-fournisseurs-comptable.csv"`,
    },
  });
}
