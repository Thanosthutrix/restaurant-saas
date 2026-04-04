"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rerunInvoiceAnalysisAction } from "./actions";

type Props = {
  invoiceId: string;
  restaurantId: string;
  disabled?: boolean;
};

export function RerunInvoiceAnalysisButton({ invoiceId, restaurantId, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    setError(null);
    startTransition(() => {
      rerunInvoiceAnalysisAction(invoiceId, restaurantId).then((res) => {
        if (res.success) {
          setMessage("Analyse terminée. La page va se mettre à jour.");
          router.refresh();
        } else {
          setError(res.error);
        }
      });
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={handleClick}
        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Analyse en cours…" : "Relancer l’analyse"}
      </button>
      {message && (
        <p className="mt-2 text-xs text-green-700" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
