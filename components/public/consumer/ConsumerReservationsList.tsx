"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelPublicReservationAction } from "@/app/compte/actions";
import type { ConsumerReservationSummary } from "@/lib/public/consumer/types";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  seated: "À table",
  completed: "Terminée",
  cancelled: "Annulée",
  no_show: "Absent",
};

const CANCELLABLE = new Set(["pending", "confirmed"]);

function formatParis(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function canCancel(r: ConsumerReservationSummary): boolean {
  if (!CANCELLABLE.has(r.status)) return false;
  return new Date(r.starts_at).getTime() > Date.now();
}

type Props = {
  reservations: ConsumerReservationSummary[];
};

export function ConsumerReservationsList({ reservations: initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await cancelPublicReservationAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r))
      );
      setConfirmId(null);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
        <p className="text-slate-600">Aucune réservation pour le moment.</p>
        <Link
          href="/"
          className="mt-3 inline-flex text-sm font-semibold text-orange-600 hover:text-orange-700"
        >
          Découvrir les restaurants →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-slate-100">
        {items.map((r) => {
          const showCancel = canCancel(r);
          const isConfirming = confirmId === r.id;

          return (
            <li
              key={r.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{r.restaurant_name}</p>
                <p className="text-sm text-slate-600">
                  {formatParis(r.starts_at)} · {r.party_size} convive{r.party_size > 1 ? "s" : ""}
                </p>
                {r.notes ? <p className="mt-1 text-sm text-slate-500">{r.notes}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    r.status === "cancelled"
                      ? "bg-slate-200 text-slate-600"
                      : r.status === "confirmed"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/restaurant/${r.restaurant_id}`}
                    className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                  >
                    Voir
                  </Link>
                  {showCancel ? (
                    isConfirming ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleCancel(r.id)}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          {isPending ? "Annulation…" : "Confirmer l'annulation"}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setConfirmId(null)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Retour
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(r.id)}
                        className="text-sm font-semibold text-rose-600 hover:text-rose-700"
                      >
                        Annuler
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
