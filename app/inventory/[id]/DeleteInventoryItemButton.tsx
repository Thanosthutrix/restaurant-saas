"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteInventoryItem } from "../actions";
import { uiCard, uiError } from "@/components/ui/premium";

export function DeleteInventoryItemButton({
  itemId,
  restaurantId,
  itemName,
}: {
  itemId: string;
  restaurantId: string;
  itemName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirmed = window.confirm(
      `Supprimer « ${itemName} » ?\n\nCette action est définitive. Les mouvements de stock et les lots FIFO liés à ce composant seront aussi effacés (sauf si la suppression est refusée : plat, préparation, commande, BL ou facture).`
    );
    if (!confirmed) return;
    setError(null);
    setLoading(true);
    const result = await deleteInventoryItem({ itemId, restaurantId });
    setLoading(false);
    if (result.ok) {
      router.push("/inventory");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className={`${uiCard} border-rose-100 bg-rose-50/30`}>
      <h2 className="text-sm font-semibold text-rose-900">Zone de danger</h2>
      <p className="mt-1 text-xs leading-relaxed text-rose-800/90">
        Supprime le composant et son historique de mouvements / lots, si aucune recette, commande, BL ou facture ne le
        référence encore.
      </p>
      {error ? <p className={`mt-3 ${uiError}`}>{error}</p> : null}
      <button
        type="button"
        disabled={loading}
        onClick={handleClick}
        className="mt-3 rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-800 shadow-sm transition hover:bg-rose-50 disabled:opacity-50"
      >
        {loading ? "Suppression…" : "Supprimer ce composant"}
      </button>
    </div>
  );
}
