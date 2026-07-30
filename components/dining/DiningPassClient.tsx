"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { RefreshCw } from "lucide-react";
import type { DiningPassQueue, DiningPassTicket } from "@/lib/dining/diningPassData";
import { TABLE_WAIT_COLOR_CLASS, type TableWaitColor } from "@/lib/dining/diningWaitSettings";
import { uiBtnSecondary, uiCard, uiError, uiLead } from "@/components/ui/premium";

const POLL_MS = 2_000;

export type DiningPassClientConfig = {
  variant: "kitchen" | "bar";
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptySubtitle: string;
  pendingLabel: (count: number) => string;
  headerClass: string;
  groupLabelClass: string;
  loadQueue: (
    restaurantId: string
  ) => Promise<
    | { ok: true; data: DiningPassQueue }
    | { ok: false; error: string }
  >;
  markPrepared: (params: { restaurantId: string; lineId: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  markAllPrepared: (params: {
    restaurantId: string;
    orderId: string;
    lineIds: string[];
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

type Props = {
  restaurantId: string;
  initialQueue: DiningPassQueue;
  config: DiningPassClientConfig;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PassUrgencyDot({ color }: { color: TableWaitColor }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white/80 shadow ${TABLE_WAIT_COLOR_CLASS[color]}`}
      title="Urgence"
      aria-hidden
    />
  );
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
    /* ignore */
  }
}

export function DiningPassClient({ restaurantId, initialQueue, config }: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [loading, setLoading] = useState(false);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevPendingRef = useRef(initialQueue.pendingLineCount);
  const EmptyIcon = config.emptyIcon;

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const result = await config.loadQueue(restaurantId);
    if (!silent) setLoading(false);
    if (!result.ok || !result.data) {
      if (!silent) setError(result.ok === false ? result.error : "Erreur de chargement.");
      return;
    }
    const next = result.data;
    if (next.pendingLineCount > prevPendingRef.current) {
      playNewTicketSound();
    }
    prevPendingRef.current = next.pendingLineCount;
    setQueue(next);
    setError(null);
  }, [restaurantId, config]);

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
    const result = await config.markPrepared({ restaurantId, lineId });
    setBusyLineId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refresh(true);
  }

  async function markAllPrepared(ticket: DiningPassTicket) {
    const lineIds = ticket.pendingLines.map((l) => l.id);
    if (lineIds.length === 0) return;

    setBusyTicketId(ticket.orderId);
    setError(null);
    const result = await config.markAllPrepared({
      restaurantId,
      orderId: ticket.orderId,
      lineIds,
    });
    setBusyTicketId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refresh(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-sm ${uiLead}`}>
            {queue.pendingLineCount > 0
              ? `${config.pendingLabel(queue.pendingLineCount)} · actualisation toutes les 2 s`
              : "Rien en attente — l'écran se met à jour automatiquement."}
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
          <EmptyIcon className="h-12 w-12 text-stone-300" aria-hidden />
          <p className="text-base font-medium text-stone-700">{config.emptyTitle}</p>
          <p className={`max-w-sm ${uiLead}`}>{config.emptySubtitle}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {queue.tickets.map((ticket) => (
            <PassTicketCard
              key={ticket.orderId}
              ticket={ticket}
              busyLineId={busyLineId}
              busyTicket={busyTicketId === ticket.orderId}
              onMarkPrepared={markPrepared}
              onMarkAllPrepared={() => void markAllPrepared(ticket)}
              headerClass={config.headerClass}
              groupLabelClass={config.groupLabelClass}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PassLineRow({
  line,
  busyLineId,
  onMarkPrepared,
}: {
  line: DiningPassTicket["pendingLines"][number];
  busyLineId: string | null;
  onMarkPrepared: (lineId: string) => void;
}) {
  const hasMods = line.kitchenLabels.length > 0;

  return (
    <li
      className={
        hasMods
          ? "flex items-start gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2.5"
          : "flex items-center gap-3"
      }
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-stone-900">
          <span className="mr-2 tabular-nums text-copper-600">×{line.qty}</span>
          {line.dishName}
        </p>
        {hasMods ? (
          <ul className="mt-1.5 space-y-1">
            {line.kitchenLabels.map((label) => (
              <li
                key={label}
                className="text-sm font-black uppercase tracking-wide text-amber-950"
              >
                ⚠ {label}
              </li>
            ))}
          </ul>
        ) : null}
        <p className={`text-xs text-stone-500 ${hasMods ? "mt-1.5" : ""}`}>{formatTime(line.createdAt)}</p>
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

function PassTicketCard({
  ticket,
  busyLineId,
  busyTicket,
  onMarkPrepared,
  onMarkAllPrepared,
  headerClass,
  groupLabelClass,
}: {
  ticket: DiningPassTicket;
  busyLineId: string | null;
  busyTicket: boolean;
  onMarkPrepared: (lineId: string) => void;
  onMarkAllPrepared: () => void;
  headerClass: string;
  groupLabelClass: string;
}) {
  const lineCount = ticket.pendingLines.length;

  return (
    <article className="overflow-hidden rounded-2xl border-2 border-stone-900 bg-white shadow-md">
      <header className={`px-4 py-3 text-white ${headerClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold leading-tight">
              <PassUrgencyDot color={ticket.waitColor} />
              <span className="min-w-0 truncate">{ticket.label}</span>
            </h2>
            {ticket.oldestSentAt ? (
              <p className="mt-0.5 text-xs opacity-80">Envoyé à {formatTime(ticket.oldestSentAt)}</p>
            ) : null}
          </div>
          {lineCount > 1 ? (
            <button
              type="button"
              disabled={busyTicket || busyLineId != null}
              onClick={onMarkAllPrepared}
              className="shrink-0 rounded-lg border-2 border-white/40 bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/25 disabled:opacity-50"
            >
              {busyTicket ? "…" : "Tout prêt"}
            </button>
          ) : null}
        </div>
      </header>
      <ul className="divide-y divide-stone-100">
        {ticket.courseGroups.map((group) => (
          <li key={group.label} className="px-4 py-2">
            <p className={`mb-2 text-[11px] font-bold uppercase tracking-wide ${groupLabelClass}`}>
              {group.label}
            </p>
            <ul className="space-y-2">
              {group.lines.map((line) => (
                <PassLineRow
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
