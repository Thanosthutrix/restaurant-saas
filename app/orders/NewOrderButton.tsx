"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { InventoryItem, Supplier } from "@/lib/db";
import { ManualOrderModal } from "./ManualOrderModal";
import { uiBtnPrimarySm } from "@/components/ui/premium";

export function NewOrderButton({
  restaurantId,
  restaurantName,
  suppliers,
  inventoryItems,
  initialSupplierId,
  label = "Créer une commande",
}: {
  restaurantId: string;
  restaurantName: string;
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  initialSupplierId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${uiBtnPrimarySm} inline-flex items-center gap-1.5`}>
        <Plus className="h-4 w-4" aria-hidden />
        {label}
      </button>

      {open ? (
        <ManualOrderModal
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          suppliers={suppliers}
          inventoryItems={inventoryItems}
          initialSupplierId={initialSupplierId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
