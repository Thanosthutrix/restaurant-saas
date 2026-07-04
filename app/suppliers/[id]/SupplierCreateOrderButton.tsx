"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { InventoryItem, Supplier } from "@/lib/db";
import { ManualOrderModal } from "@/app/orders/ManualOrderModal";
import { uiBtnPrimarySm } from "@/components/ui/premium";

export function SupplierCreateOrderButton({
  restaurantId,
  restaurantName,
  suppliers,
  inventoryItems,
  supplierId,
}: {
  restaurantId: string;
  restaurantName: string;
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  supplierId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${uiBtnPrimarySm} inline-flex items-center gap-1.5`}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Créer une commande
      </button>

      {open ? (
        <ManualOrderModal
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          suppliers={suppliers}
          inventoryItems={inventoryItems}
          initialSupplierId={supplierId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
