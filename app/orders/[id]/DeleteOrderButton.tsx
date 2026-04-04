"use client";

import { useTransition } from "react";
import { deletePurchaseOrderAction } from "../actions";

export function DeleteOrderButton({
  orderId,
  restaurantId,
}: {
  orderId: string;
  restaurantId: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        "Supprimer cette commande ? Les lignes seront supprimées. Les BL rattachés resteront enregistrés."
      )
    )
      return;
    startTransition(() => {
      deletePurchaseOrderAction(orderId, restaurantId);
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "Suppression…" : "Supprimer la commande"}
    </button>
  );
}
