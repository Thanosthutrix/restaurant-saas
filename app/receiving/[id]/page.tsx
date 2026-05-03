import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import {
  getDeliveryNoteWithLines,
  getDeliveryNoteFileUrl,
  getInventoryItems,
} from "@/lib/db";
import {
  fetchDeliveryLabelAliasMap,
  fetchDeliveryLabelConversionHintsMap,
} from "@/lib/inventoryDeliveryLabelAliases";
import { ReceivingClient } from "./ReceivingClient";
import { BlAnalyzeButton } from "./BlAnalyzeButton";
import { BlUploadSection } from "./BlUploadSection";

type Props = {
  params: Promise<{ id: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  received: "Reçu (legacy)",
  validated: "Validé",
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href={`/suppliers/${note.supplier_id}`}
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Fournisseur
          </Link>
          <Link href="/livraison" className="text-slate-600 underline decoration-slate-400 underline-offset-2">
            ← Livraison
          </Link>
          <Link
            href="/receiving/registre"
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            Registre traçabilité
          </Link>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Réception fournisseur
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Statut : {STATUS_LABELS[note.status] ?? note.status}
              </p>
              {note.delivery_date && (
                <p className="mt-1 text-sm text-slate-600">
                  Date BL :{" "}
                  {new Date(note.delivery_date).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
              {note.purchase_order_id && (
                <p className="mt-1 text-sm text-slate-600">
                  <Link
                    href={`/orders/${note.purchase_order_id}`}
                    className="underline decoration-slate-400 underline-offset-2"
                  >
                    Voir la commande liée
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <BlUploadSection
            deliveryNoteId={note.id}
            restaurantId={note.restaurant_id}
            supplierId={note.supplier_id}
            status={note.status}
            filePath={note.file_path}
            fileUrl={note.file_url ?? getDeliveryNoteFileUrl(note.file_path)}
          />
        </div>

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
      </div>
    </div>
  );
}

