"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DeliveryNote } from "@/lib/db";
import { linkReceptionsToInvoiceAction } from "./actions";

type Props = {
  invoiceId: string;
  restaurantId: string;
  unlinkedDeliveryNotes: DeliveryNote[];
};

export function LinkReceptionsForm({
  invoiceId,
  restaurantId,
  unlinkedDeliveryNotes,
}: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.size === 0) {
      setError("Sélectionnez au moins une réception.");
      return;
    }
    setError(null);
    startTransition(() => {
      linkReceptionsToInvoiceAction(invoiceId, Array.from(selectedIds), restaurantId)
        .then((res) => {
          if (res.error) setError(res.error);
          else {
            setSelectedIds(new Set());
            router.refresh();
          }
        });
    });
  }

  if (unlinkedDeliveryNotes.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Toutes les réceptions de ce fournisseur sont déjà liées à une facture.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs font-medium text-slate-500">
        Réceptions non encore liées à une facture :
      </p>
      <ul className="max-h-48 space-y-2 overflow-y-auto rounded border border-slate-200 p-2">
        {unlinkedDeliveryNotes.map((dn) => (
          <li key={dn.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`dn-${dn.id}`}
              checked={selectedIds.has(dn.id)}
              onChange={() => toggle(dn.id)}
              disabled={pending}
              className="rounded border-slate-300"
            />
            <label htmlFor={`dn-${dn.id}`} className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
              <Link
                href={`/receiving/${dn.id}`}
                className="underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                Réception du{" "}
                {(dn.created_at && new Date(dn.created_at).toLocaleDateString("fr-FR")) || "—"}
              </Link>
              <span className="text-slate-500">({dn.status})</span>
            </label>
          </li>
        ))}
      </ul>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || selectedIds.size === 0}
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Liaison…" : `Lier la sélection (${selectedIds.size})`}
      </button>
    </form>
  );
}
