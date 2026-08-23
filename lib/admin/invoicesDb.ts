import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import type { AdminInvoiceListRow } from "@/lib/admin/invoiceTypes";

export type { AdminInvoiceListRow };
export { getAdminInvoiceStatusLabel } from "@/lib/admin/invoiceTypes";

export async function getAdminInvoicesList(limit = 300): Promise<AdminInvoiceListRow[]> {
  const { data: invoices, error } = await supabaseServer
    .from("supplier_invoices")
    .select(
      "id, restaurant_id, supplier_id, invoice_number, invoice_date, amount_ht, amount_ttc, status, analysis_status, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !invoices?.length) return [];

  const restaurantIds = [...new Set(invoices.map((i) => i.restaurant_id))];
  const supplierIds = [...new Set(invoices.map((i) => i.supplier_id))];
  const invoiceIds = invoices.map((i) => i.id as string);

  const [restaurantsRes, suppliersRes, linksRes] = await Promise.all([
    supabaseServer.from("restaurants").select("id, name").in("id", restaurantIds),
    supabaseServer.from("suppliers").select("id, name").in("id", supplierIds),
    supabaseServer
      .from("supplier_invoice_delivery_notes")
      .select("supplier_invoice_id")
      .in("supplier_invoice_id", invoiceIds),
  ]);

  const restaurantMap = new Map(
    (restaurantsRes.data ?? []).map((r) => [r.id as string, r.name as string])
  );
  const supplierMap = new Map(
    (suppliersRes.data ?? []).map((s) => [s.id as string, s.name as string])
  );

  const linkCounts = new Map<string, number>();
  for (const link of linksRes.data ?? []) {
    const id = link.supplier_invoice_id as string;
    linkCounts.set(id, (linkCounts.get(id) ?? 0) + 1);
  }

  return invoices.map((inv) => ({
    id: inv.id as string,
    restaurant_id: inv.restaurant_id as string,
    restaurant_name: restaurantMap.get(inv.restaurant_id as string) ?? "Restaurant",
    supplier_id: inv.supplier_id as string,
    supplier_name: supplierMap.get(inv.supplier_id as string) ?? "Fournisseur",
    invoice_number: (inv.invoice_number as string | null) ?? null,
    invoice_date: (inv.invoice_date as string | null) ?? null,
    amount_ht: inv.amount_ht as number | null,
    amount_ttc: inv.amount_ttc as number | null,
    status: inv.status as string,
    analysis_status: (inv.analysis_status as string | null) ?? null,
    delivery_notes_count: linkCounts.get(inv.id as string) ?? 0,
    created_at: inv.created_at as string,
  }));
}

export async function getAdminInvoiceContext(invoiceId: string): Promise<{
  invoice: AdminInvoiceListRow | null;
  ownerId: string | null;
  ownerEmail: string | null;
}> {
  const { data: inv } = await supabaseServer
    .from("supplier_invoices")
    .select(
      "id, restaurant_id, supplier_id, invoice_number, invoice_date, amount_ht, amount_ttc, status, analysis_status, created_at"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (!inv) return { invoice: null, ownerId: null, ownerEmail: null };

  const [{ data: rest }, { data: supplier }, linksRes] = await Promise.all([
    supabaseServer.from("restaurants").select("name, owner_id").eq("id", inv.restaurant_id).maybeSingle(),
    supabaseServer.from("suppliers").select("name").eq("id", inv.supplier_id).maybeSingle(),
    supabaseServer
      .from("supplier_invoice_delivery_notes")
      .select("supplier_invoice_id")
      .eq("supplier_invoice_id", invoiceId),
  ]);

  let ownerEmail: string | null = null;
  const ownerId = (rest?.owner_id as string | null) ?? null;
  if (ownerId) {
    const { data } = await supabaseServer.auth.admin.getUserById(ownerId);
    ownerEmail = data?.user?.email ?? null;
  }

  const invoice: AdminInvoiceListRow = {
    id: inv.id as string,
    restaurant_id: inv.restaurant_id as string,
    restaurant_name: (rest?.name as string) ?? "Restaurant",
    supplier_id: inv.supplier_id as string,
    supplier_name: (supplier?.name as string) ?? "Fournisseur",
    invoice_number: (inv.invoice_number as string | null) ?? null,
    invoice_date: (inv.invoice_date as string | null) ?? null,
    amount_ht: inv.amount_ht as number | null,
    amount_ttc: inv.amount_ttc as number | null,
    status: inv.status as string,
    analysis_status: (inv.analysis_status as string | null) ?? null,
    delivery_notes_count: linksRes.data?.length ?? 0,
    created_at: inv.created_at as string,
  };

  return { invoice, ownerId, ownerEmail };
}
