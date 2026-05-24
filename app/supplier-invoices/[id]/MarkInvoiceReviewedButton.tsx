"use client";

import { useState, useTransition } from "react";
import { markSupplierInvoiceReviewedAction } from "./actions";

export function MarkInvoiceReviewedButton({
  invoiceId,
  restaurantId,
  hasLinkedReceptions,
}: {
  invoiceId: string;
  restaurantId: string;
  hasLinkedReceptions: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function validate(withoutDeliveryNote: boolean) {
    if (
      withoutDeliveryNote &&
      !window.confirm(
        "Valider cette facture sans bon de livraison lié ?\n\nLe rapprochement BL ne sera pas effectué. Assurez-vous que les montants et lignes facture sont corrects avant le transfert comptable."
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await markSupplierInvoiceReviewedAction(invoiceId, restaurantId, {
        withoutDeliveryNote,
      });
      if (!res.success) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {hasLinkedReceptions ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => validate(false)}
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {pending ? "Validation…" : "Marquer prête comptable"}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-emerald-900">
            Aucun BL n’est lié à cette facture. Vous pouvez quand même la valider si la facture ne correspond pas à une
            réception enregistrée (ex. frais, acompte, facture globale).
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => validate(true)}
            className="rounded border border-emerald-700 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
          >
            {pending ? "Validation…" : "Valider sans bon de livraison"}
          </button>
        </div>
      )}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
