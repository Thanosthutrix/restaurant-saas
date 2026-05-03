"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlinkReceptionFromInvoiceAction } from "./actions";

type Props = {
  invoiceId: string;
  deliveryNoteId: string;
  restaurantId: string;
};

export function UnlinkReceptionButton({ invoiceId, deliveryNoteId, restaurantId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm("Annuler le rapprochement de cette réception avec la facture ?")) return;
    setError(null);
    startTransition(() => {
      unlinkReceptionFromInvoiceAction(invoiceId, deliveryNoteId, restaurantId).then((res) => {
        if (res.error) {
          setError(res.error);
          return;
        }
        router.refresh();
      });
    });
  }

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="text-xs font-medium text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-900 disabled:opacity-50"
      >
        {pending ? "Annulation…" : "Annuler le rapprochement"}
      </button>
      {error ? (
        <p className="mt-1 max-w-xs text-left text-xs text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
