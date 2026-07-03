import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getRecentDeliveryNotesForRestaurant, getSupplierInvoicesForRestaurant } from "@/lib/db";
import { cachedGetSuppliers } from "@/lib/cache";
import { listHygieneRegister } from "@/lib/hygiene/hygieneDb";
import { listTemperatureLogs } from "@/lib/haccpTemperature/haccpTemperatureDb";
import { listPreparationRegister } from "@/lib/preparations/preparationsDb";
import { parseRegistresTab } from "@/lib/registres/types";
import {
  RegistresClient,
  type RegistresBlItem,
  type RegistresCleaningItem,
  type RegistresInvoiceItem,
  type RegistresPreparationItem,
  type RegistresTemperatureItem,
} from "./RegistresClient";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_CLEANING_ACTION_LABEL_FR,
  HYGIENE_RISK_LABEL_FR,
  type HygieneCleaningActionType,
} from "@/lib/hygiene/types";
import type { TemperatureLogStatus } from "@/lib/haccpTemperature/types";
import { TEMPERATURE_POINT_TYPE_LABEL_FR } from "@/lib/haccpTemperature/types";

type Search = { tab?: string };

function formatDateFr(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function formatAmountHt(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT`;
}

export default async function RegistresPage({ searchParams }: { searchParams: Promise<Search> }) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const initialTab = parseRegistresTab(sp.tab);

  const [notesRes, invoicesRes, suppliersRes, cleaningRows, tempRows, prepRows] = await Promise.all([
    getRecentDeliveryNotesForRestaurant(restaurant.id, 150),
    getSupplierInvoicesForRestaurant(restaurant.id, { includeFileFields: false }),
    cachedGetSuppliers(restaurant.id, true),
    listHygieneRegister(restaurant.id, 200),
    listTemperatureLogs(restaurant.id, { limit: 200 }),
    listPreparationRegister(restaurant.id, 200),
  ]);

  const supplierById = new Map((suppliersRes.data ?? []).map((s) => [s.id, s.name]));

  const bl: RegistresBlItem[] = (notesRes.data ?? []).map((n) => ({
    id: n.id,
    supplierName: supplierById.get(n.supplier_id) ?? "Fournisseur",
    dateLabel: formatDateFr(n.delivery_date ?? n.created_at),
    number: n.number ?? null,
    status: n.status,
    linesCount: n.lines_count,
    href: `/receiving/${n.id}`,
  }));

  const invoices: RegistresInvoiceItem[] = (invoicesRes.data ?? []).map((inv) => ({
    id: inv.id,
    supplierName: supplierById.get(inv.supplier_id) ?? "Fournisseur",
    dateLabel: formatDateFr(inv.invoice_date ?? inv.created_at),
    number: inv.invoice_number,
    status: inv.status,
    amountLabel: formatAmountHt(inv.amount_ht),
    href: `/supplier-invoices/${inv.id}`,
  }));

  const cleaning: RegistresCleaningItem[] = cleaningRows.map((r) => ({
    id: r.id,
    completedAtLabel: formatDateFr(r.completed_at, true),
    elementName: r.element_name,
    categoryLabel:
      HYGIENE_CATEGORY_LABEL_FR[r.element_category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ?? r.element_category,
    areaLabel: r.area_label || "",
    riskLevel: r.risk_level,
    riskLabel: HYGIENE_RISK_LABEL_FR[r.risk_level],
    actionLabel: r.cleaning_action_type
      ? HYGIENE_CLEANING_ACTION_LABEL_FR[r.cleaning_action_type as HygieneCleaningActionType]
      : "—",
    byLabel: r.completed_by_initials ?? r.completed_by_display ?? "—",
    comment: r.completion_comment,
    href: `/hygiene/elements?elementId=${encodeURIComponent(r.element_id)}`,
  }));

  const temperatures: RegistresTemperatureItem[] = tempRows.map((r) => ({
    id: r.id,
    dateLabel: formatDateFr(r.created_at, true),
    pointName: r.point_name,
    pointTypeLabel: TEMPERATURE_POINT_TYPE_LABEL_FR[r.point_type],
    value: r.value,
    status: r.log_status as TemperatureLogStatus,
    byLabel: r.recorded_by_display ?? "—",
    comment: r.comment,
    href: `/hygiene/haccp/check`,
  }));

  const preparations: RegistresPreparationItem[] = prepRows.map((r) => ({
    id: r.id,
    startedAtLabel: formatDateFr(r.started_at, true),
    lotReference: r.lot_reference,
    label: r.label,
    tempEndLabel: r.temp_end_celsius != null ? `${r.temp_end_celsius} °C` : null,
    temp2hLabel: r.temp_2h_celsius != null ? `${r.temp_2h_celsius} °C` : null,
    dlcLabel: r.dlc_date ? formatDateFr(r.dlc_date + "T12:00:00") : null,
    byLabel: r.recorded_by_display ?? "—",
    href: r.lot_reference
      ? `/preparations?lot=${encodeURIComponent(r.lot_reference)}`
      : `/preparations?recordId=${encodeURIComponent(r.id)}`,
  }));

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-stone-500">Chargement des registres…</div>
      }
    >
      <RegistresClient
        initialTab={initialTab}
        bl={bl}
        invoices={invoices}
        cleaning={cleaning}
        temperatures={temperatures}
        preparations={preparations}
      />
    </Suspense>
  );
}
