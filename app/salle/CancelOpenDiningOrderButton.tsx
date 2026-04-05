"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelOpenDiningOrder } from "@/app/salle/actions";
import { uiError } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  orderId: string;
  /** Après annulation réussie */
  redirectHref: string;
  linesCount: number;
  /** Libellé pour le message de confirmation (ex. table ou ticket) */
  contextLabel: string;
};

export function CancelOpenDiningOrderButton({
  restaurantId,
  orderId,
  redirectHref,
  linesCount,
  contextLabel,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirmMessage =
    linesCount === 0
      ? `Annuler la commande (${contextLabel}) ? La table ou le ticket sera libéré, aucune vente enregistrée.`
      : `Annuler la commande (${contextLabel}) ? Les ${linesCount} ligne${linesCount > 1 ? "s" : ""} seront supprimées et aucune vente ne sera enregistrée.`;

  const handleCancel = () => {
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelOpenDiningOrder({ restaurantId, orderId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(redirectHref);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      {error ? <p className={uiError}>{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleCancel();
        }}
        className="w-full rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-900 transition hover:bg-rose-100 disabled:opacity-50"
      >
        Annuler la commande (sans encaisser)
      </button>
    </div>
  );
}
