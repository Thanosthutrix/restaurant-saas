"use client";

import Link from "next/link";
import { useEffect } from "react";
import { uiBtnPrimarySm, uiBtnOutlineSm } from "@/components/ui/premium";

export type CustomerMemoForTicket = {
  id: string;
  display_name: string;
  service_memo: string | null;
  allergens_note: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  customer: CustomerMemoForTicket;
};

/**
 * Mémo + allergies affichés au clic sur le nom du client sur une commande.
 */
export function CustomerTicketMemoDialog({ open, onClose, customer }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const memo = customer.service_memo?.trim();
  const allergens = customer.allergens_note?.trim();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-memo-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(85vh,560px)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="customer-memo-title" className="text-base font-semibold text-slate-900">
          {customer.display_name}
        </h2>
        <p className="mt-1 text-xs text-slate-500">Mémo service (rappel équipe)</p>
        {memo ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{memo}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Aucun mémo enregistré sur la fiche.</p>
        )}
        {allergens ? (
          <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">Allergies / régimes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950">{allergens}</p>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/clients/${customer.id}`} className={uiBtnPrimarySm}>
            Fiche client
          </Link>
          <button type="button" className={uiBtnOutlineSm} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
