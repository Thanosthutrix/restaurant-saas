"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChefHat, RefreshCw } from "lucide-react";
import {
  loadKitchenPassAction,
  markKitchenLinePreparedAction,
} from "@/app/cuisine/actions";
import type { KitchenPassQueue, KitchenPassTicket } from "@/lib/dining/kitchenPassData";
import { uiBtnSecondary, uiCard, uiError, uiLead } from "@/components/ui/premium";

const POLL_MS = 2_000;

type Props = {
  restaurantId: string;
  initialQueue: KitchenPassQueue;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function playNewTicketSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    setTimeout(() => void ctx.close(), 200);
  } catch {
    /* ignore — son optionnel */
  }
}

export function KitchenPassClient({ restaurantId, initialQueue }: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [loading, setLoading] = useState(false);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevPendingRef = useRef(initialQueue.pendingLineCount);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const result = await loadKitchenPassAction(restaurantId);
    if (!silent) setLoading(false);
    if (!result.ok) {
      if (!silent) setError(result.error);
      return;
    }
    const next = result.data!;
    if (next.pendingLineCount > prevPendingRef.current) {
      playNewTicketSound();
    }
    prevPendingRef.current = next.pendingLineCount;
    setQueue(next);
    setError(null);
  }, [restaurantId]);

  useEffect(() => {
    void refresh(true);
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh(true);
    }, POLL_MS);
    const onWake = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [refresh]);

  async function markPrepared(lineId: string) {
    setBusyLineId(lineId);
    setError(null);
    const result = await markKitchenLinePreparedAction({ restaurantId, lineId });
    setBusyLineId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setQueue((prev) => {
      const tickets = prev.tickets
        .map((ticket) => ({
          ...ticket,
          pendingLines: ticket.pendingLines.filter((l) => l.id !== lineId),
        }))
        .filter((t) => t.pendingLines.length > 0);
      const pendingLineCount = tickets.reduce((n, t) => n + t.pendingLines.length, 0);
      prevPendingRef.current = pendingLineCount;
      return { tickets, pendingLineCount };
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-sm ${uiLead}`}>
            {queue.pendingLineCount > 0
              ? `${queue.pendingLineCount} plat(s) en attente · actualisation toutes les 2 s`
              : "Aucun plat en attente — l'écran se met à jour automatiquement."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={`inline-flex items-center gap-2 ${uiBtnSecondary}`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Actualiser
        </button>
      </div>

      {error ? <p className={uiError}>{error}</p> : null}

      {queue.tickets.length === 0 ? (
        <div className={`${uiCard} flex flex-col items-center justify-center gap-3 p-12 text-center`}>
          <ChefHat className="h-12 w-12 text-stone-300" aria-hidden />
          <p className="text-base font-medium text-stone-700">Rien à préparer pour le moment</p>
          <p className={`max-w-sm ${uiLead}`}>
            Dès qu&apos;un serveur envoie un service (entrées, plats…), les bons apparaissent ici
            par table.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {queue.tickets.map((ticket) => (
            <KitchenTicketCard
              key={ticket.orderId}
              ticket={ticket}
              busyLineId={busyLineId}
              onMarkPrepared={markPrepared}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KitchenPassLineRow({
  line,
  busyLineId,
  onMarkPrepared,
}: {
  line: KitchenPassTicket["pendingLines"][number];
  busyLineId: string | null;
  onMarkPrepared: (lineId: string) => void;
}) {
  return (
    <li className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-stone-900">
          <span className="mr-2 tabular-nums text-copper-600">×{line.qty}</span>
          {line.dishName}
        </p>
        <p className="text-xs text-stone-500">{formatTime(line.createdAt)}</p>
      </div>
      <button
        type="button"
        disabled={busyLineId === line.id}
        onClick={() => void onMarkPrepared(line.id)}
        className="shrink-0 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
      >
        Prêt
      </button>
    </li>
  );
}

function KitchenTicketCard({
  ticket,
  busyLineId,
  onMarkPrepared,
}: {
  ticket: KitchenPassTicket;
  busyLineId: string | null;
  onMarkPrepared: (lineId: string) => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border-2 border-stone-900 bg-white shadow-md">
      <header className="bg-stone-900 px-4 py-3 text-white">
        <h2 className="text-lg font-bold leading-tight">{ticket.label}</h2>
        {ticket.oldestPendingAt ? (
          <p className="mt-0.5 text-xs text-stone-300">Depuis {formatTime(ticket.oldestPendingAt)}</p>
        ) : null}
      </header>
      <ul className="divide-y divide-stone-100">
        {ticket.courseGroups.map((group) => (
          <li key={group.label} className="px-4 py-2">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-copper-700">
              {group.label}
            </p>
            <ul className="space-y-2">
              {group.lines.map((line) => (
                <KitchenPassLineRow
                  key={line.id}
                  line={line}
                  busyLineId={busyLineId}
                  onMarkPrepared={onMarkPrepared}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </article>
  );
}
