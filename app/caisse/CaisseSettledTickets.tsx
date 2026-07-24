"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, X } from "lucide-react";
import { ModalOverlay } from "@/components/ui/ModalOverlay";

export type SettledTicket = {
  orderId: string;
  label: string;
  time: string;
  payment: string;
  amount: number;
  serviceId: string | null;
};

const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export function CaisseSettledTickets({ tickets }: { tickets: SettledTicket[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = tickets.find((t) => t.orderId === openId) ?? null;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-stone-700">Détail</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tickets.map((t) => {
          const active = t.orderId === openId;
          return (
            <li key={t.orderId}>
              <button
                type="button"
                onClick={() => setOpenId(active ? null : t.orderId)}
                aria-expanded={active}
                className={`group flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md ${
                  active
                    ? "border-copper-300 bg-copper-50/50 shadow-md ring-1 ring-copper-200"
                    : "border-stone-200/70 bg-white shadow-sm hover:border-copper-200"
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Check className="h-5 w-5" aria-hidden />
                </span>
                <span className="line-clamp-1 font-semibold text-stone-900">{t.label}</span>
                <span className="text-lg font-bold tabular-nums text-stone-900">{eur(t.amount)}</span>
                <span className="text-[11px] text-stone-500">{t.time}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {open ? (
        <ModalOverlay ariaLabel={`Ticket ${open.label}`} onClose={() => setOpenId(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/60 px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Check className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-900">{open.label}</p>
                <p className="text-xs text-stone-500">Encaissé · {open.time}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-stone-500">Montant réglé</span>
                <span className="text-2xl font-bold tabular-nums text-stone-900">{eur(open.amount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-3 text-sm">
                <span className="text-stone-500">Paiement</span>
                <span className="font-semibold text-stone-800">{open.payment}</span>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href={`/salle/commande/${open.orderId}?from=caisse`}
                  className="copper-sheen inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Voir le ticket complet
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
                {open.serviceId ? (
                  <Link
                    href={`/service/${open.serviceId}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
                  >
                    Voir le service
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
