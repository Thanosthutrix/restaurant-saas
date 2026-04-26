"use client";

import { useState, useTransition } from "react";
import { markSupplierInvoiceReviewedAction } from "./actions";

export function MarkInvoiceReviewedButton({
  invoiceId,
  restaurantId,
  disabled,
}: {
  invoiceId: string;
  restaurantId: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await markSupplierInvoiceReviewedAction(invoiceId, restaurantId);
            if (!res.success) setError(res.error);
          });
        }}
        className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {pending ? "Validation…" : "Marquer prête comptable"}
      </button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
