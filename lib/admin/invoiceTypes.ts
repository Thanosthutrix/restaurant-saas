/** Types factures admin — importables côté client. */

export type AdminInvoiceListRow = {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  supplier_id: string;
  supplier_name: string;
  invoice_number: string | null;
  invoice_date: string | null;
  amount_ht: number | null;
  amount_ttc: number | null;
  status: string;
  analysis_status: string | null;
  delivery_notes_count: number;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "À traiter",
  linked: "À contrôler",
  reviewed: "Prête comptable",
};

export function getAdminInvoiceStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
