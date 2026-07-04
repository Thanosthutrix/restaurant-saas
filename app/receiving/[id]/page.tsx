import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, FileClock, PackageCheck, Receipt } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { getDeliveryNoteWithLines, getDeliveryNoteFileUrl, getInventoryItems } from "@/lib/db";
import {
  fetchDeliveryLabelAliasMap,
  fetchDeliveryLabelConversionHintsMap,
} from "@/lib/inventoryDeliveryLabelAliases";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { ReceivingClient } from "./ReceivingClient";
import { BlAnalyzeButton } from "./BlAnalyzeButton";
import { BlUploadSection } from "./BlUploadSection";

type Props = {
  params: Promise<{ id: string }>;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "À pointer", cls: "bg-amber-100 text-amber-900" },
  received: { label: "Reçu (legacy)", cls: "bg-stone-100 text-stone-600" },
  validated: { label: "Validé", cls: "bg-emerald-100 text-emerald-800" },
};

export default async function ReceivingPage({ params }: Props) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { id } = await params;
  const [noteRes, itemsRes] = await Promise.all([
    getDeliveryNoteWithLines(id),
    getInventoryItems(restaurant.id),
  ]);
  const { data: note, error } = noteRes;
  if (error || !note || note.restaurant_id !== restaurant.id) notFound();
  const inventoryItems = itemsRes.data ?? [];

  const deliveryLabelAliases = Object.fromEntries(
    await fetchDeliveryLabelAliasMap(restaurant.id, note.supplier_id)
  );
  const deliveryLabelConversionHints = Object.fromEntries(
    await fetchDeliveryLabelConversionHintsMap(restaurant.id, note.supplier_id)
  );

  const status = STATUS_META[note.status] ?? { label: note.status, cls: "bg-stone-100 text-stone-600" };
  const blDate = note.delivery_date
    ? new Date(note.delivery_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <PageContainer>
      <PageHeader
        accentIcon={PackageCheck}
        accentTone="bg-cyan-50 text-cyan-700"
        breadcrumbs={[
          { label: "Achats & stock", href: "/achats" },
          { label: "Livraison", href: "/livraison" },
          { label: "Réception" },
        ]}
        title="Réception fournisseur"
        subtitle="Pointez chaque ligne du bon de livraison : quantités reçues, température, n° de lot, DLC et photos, puis validez pour mettre le stock à jour."
        actions={
          <Link
            href="/receiving/registre"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-copper-700 transition hover:text-copper-600"
          >
            <FileClock className="h-4 w-4" aria-hidden />
            Registre traçabilité
          </Link>
        }
      />

      {/* Méta BL */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${status.cls}`}>
          {status.label}
        </span>
        {blDate ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-stone-600">
            <CalendarDays className="h-4 w-4 text-stone-400" aria-hidden />
            BL du {blDate}
          </span>
        ) : null}
        <Link
          href={`/suppliers/${note.supplier_id}`}
          className="text-sm font-medium text-copper-700 underline decoration-copper-300 underline-offset-2 hover:text-copper-600"
        >
          Fiche fournisseur
        </Link>
        {note.purchase_order_id ? (
          <Link
            href={`/orders/${note.purchase_order_id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-copper-700 underline decoration-copper-300 underline-offset-2 hover:text-copper-600"
          >
            <Receipt className="h-4 w-4" aria-hidden />
            Commande liée
          </Link>
        ) : null}
      </div>

      <BlUploadSection
        deliveryNoteId={note.id}
        restaurantId={note.restaurant_id}
        supplierId={note.supplier_id}
        status={note.status}
        filePath={note.file_path}
        fileUrl={note.file_url ?? getDeliveryNoteFileUrl(note.file_path)}
      />

      <BlAnalyzeButton
        deliveryNoteId={note.id}
        restaurantId={note.restaurant_id}
        status={note.status}
        fileName={note.file_name}
        filePath={note.file_path}
      />

      <ReceivingClient
        deliveryNote={note}
        inventoryItems={inventoryItems}
        deliveryLabelAliases={deliveryLabelAliases}
        deliveryLabelConversionHints={deliveryLabelConversionHints}
      />
    </PageContainer>
  );
}
