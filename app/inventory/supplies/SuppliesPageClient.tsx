"use client";

import { useState } from "react";
import Link from "next/link";
import type { InventoryItemWithCalculatedStock } from "@/lib/db";
import type { CategoryTreeNode } from "@/lib/catalog/restaurantCategories";
import type { WasteLogRow } from "@/lib/analysis/wasteDb";
import { InventoryCategoryTiles } from "../InventoryCategoryTiles";
import { CreateSupplyItemForm } from "./CreateSupplyItemForm";
import { SupplyBreakageClient } from "./SupplyBreakageClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { GlassWater, Sparkles } from "lucide-react";
import { uiBtnSecondary, uiInfoBanner, uiSectionTitle } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  canWrite: boolean;
  roots: CategoryTreeNode[];
  directMap: Map<string, InventoryItemWithCalculatedStock[]>;
  uncategorized: InventoryItemWithCalculatedStock[];
  belowMinCount: number;
  breakageLogs: WasteLogRow[];
  itemNames: Record<string, string>;
};

export function SuppliesPageClient({
  restaurantId,
  canWrite,
  roots,
  directMap,
  uncategorized,
  belowMinCount,
  breakageLogs,
  itemNames,
}: Props) {
  const [breakageItemId, setBreakageItemId] = useState<string | null>(null);
  const [breakageOpen, setBreakageOpen] = useState(false);

  const allItems = [
    ...uncategorized,
    ...Array.from(directMap.values()).flat(),
  ];
  const supplyOptions = allItems.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    stock: i.stock_qty_from_movements ?? 0,
  }));

  const openBreakage = (itemId?: string) => {
    setBreakageItemId(itemId ?? null);
    setBreakageOpen(true);
  };

  return (
    <div className="space-y-6">
      <p className={uiInfoBanner}>
        <span className="font-semibold text-stone-800">Petit matériel</span> — verres, carafes, couverts, nappes…
        Compté en pièces. Déclarez les casses pour ajuster le stock ; renseignez un seuil min et un fournisseur sur
        chaque fiche pour déclencher des suggestions de réappro.
      </p>

      {belowMinCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3">
          <p className="text-sm text-amber-950">
            <span className="font-semibold">{belowMinCount}</span> article{belowMinCount > 1 ? "s" : ""} sous le
            seuil minimum.
          </p>
          <Link href="/orders/suggestions" className={`${uiBtnSecondary} inline-flex items-center gap-1.5 text-sm`}>
            <Sparkles className="h-4 w-4" aria-hidden />
            Suggestions d&apos;achat
          </Link>
        </div>
      ) : null}

      {canWrite ? <CreateSupplyItemForm restaurantId={restaurantId} /> : null}

      <div>
        <h2 className={`mb-3 ${uiSectionTitle}`}>Inventaire</h2>
        {allItems.length === 0 ? (
          <EmptyState
            icon={GlassWater}
            title="Aucun article pour l'instant"
            description="Ajoutez vos verres, carafes et couverts pour suivre les stocks et les casses."
          />
        ) : (
          <InventoryCategoryTiles
            roots={roots}
            directMap={directMap}
            uncategorized={uncategorized}
            onBreakage={canWrite ? openBreakage : undefined}
            itemLabel="article"
          />
        )}
      </div>

      <div>
        <h2 className={`mb-3 ${uiSectionTitle}`}>Casses</h2>
        <SupplyBreakageClient
          restaurantId={restaurantId}
          supplies={supplyOptions}
          initialLogs={breakageLogs}
          itemNames={itemNames}
          sheetOpen={breakageOpen}
          preselectedId={breakageItemId}
          onSheetOpenChange={setBreakageOpen}
        />
      </div>
    </div>
  );
}
