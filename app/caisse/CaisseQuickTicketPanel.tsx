"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { cancelOpenDiningOrder, removeDiningOrderLine, settleDiningOrder, setDiningOrderLineQty } from "@/app/salle/actions";
import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import { DiningLineDiscountModal } from "@/app/salle/DiningLineDiscountModal";
import type { DiningPaymentMethod } from "@/lib/dining/diningPaymentMethods";
import {
  DiningOrderTicketCard,
  DiningOrderTicketEmptyLines,
  DiningOrderTicketFooterBar,
  DiningOrderTicketLineRow,
  DiningOrderTicketLinesScroll,
  fmtEur,
} from "@/components/dining/DiningOrderTicketUi";
import { getQuickCounterOrderSnapshot } from "./actions";
import { CAISSE_QUICK_COUNTER_STORAGE_KEY } from "./caisseQuickStorage";
import { uiLead } from "@/components/ui/premium";

const QUICK_DEFAULT_SERVICE = "lunch" as const;

type Props = {
  restaurantId: string;
  orderId: string;
  refreshTick: number;
  onReset: () => void;
  onSettled?: (message: string) => void;
};

export function CaisseQuickTicketPanel({ restaurantId, orderId, refreshTick, onReset, onSettled }: Props) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<{
    ticketLabel: string;
    lines: DiningLineClient[];
    totalTtc: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<DiningPaymentMethod>("card");
  const [discountLine, setDiscountLine] = useState<DiningLineClient | null>(null);

  const prevOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSnapshot(null);
  }, [orderId]);

  const fetchSnapshot = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true);
      setError(null);
      const res = await getQuickCounterOrderSnapshot(restaurantId, orderId);
      if (!silent) setLoading(false);
      if (!res.ok) {
        setSnapshot(null);
        setError(res.error);
        try {
          sessionStorage.removeItem(CAISSE_QUICK_COUNTER_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        onReset();
        return;
      }
      setSnapshot(res.data);
    },
    [restaurantId, orderId, onReset]
  );

  useEffect(() => {
    const orderSwitched = prevOrderIdRef.current !== orderId;
    prevOrderIdRef.current = orderId;
    const silent = !orderSwitched && refreshTick > 0;
    fetchSnapshot(silent);
  }, [fetchSnapshot, refreshTick, orderId]);

  const sync = () => {
    fetchSnapshot(true);
    router.refresh();
  };

  const adjustLine = (lineId: string, delta: number) => {
    const line = snapshot?.lines.find((l) => l.id === lineId);
    if (!line) return;
    const next = line.qty + delta;
    if (next <= 0) return;
    setError(null);
    startTransition(async () => {
      const res = await setDiningOrderLineQty({ restaurantId, lineId, qty: next });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      sync();
    });
  };

  const removeLine = (lineId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await removeDiningOrderLine({ restaurantId, lineId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      sync();
    });
  };

  const handleSettle = () => {
    setError(null);
    startTransition(async () => {
      const res = await settleDiningOrder({
        restaurantId,
        orderId,
        serviceType: QUICK_DEFAULT_SERVICE,
        paymentMethod,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const msg = `Encaissement enregistré (${fmtEur(res.data?.totalTtc ?? 0)}).`;
      onSettled?.(msg);
      try {
        sessionStorage.removeItem(CAISSE_QUICK_COUNTER_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      onReset();
      router.refresh();
    });
  };

  const handleCancel = () => {
    const label = snapshot?.ticketLabel ?? "ticket";
    const n = snapshot?.lines.length ?? 0;
    const msg =
      n === 0
        ? `Annuler la commande (${label}) ? Aucune vente ne sera enregistrée.`
        : `Annuler la commande (${label}) ? Les ${n} ligne${n > 1 ? "s" : ""} seront supprimées.`;
    if (!window.confirm(msg)) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelOpenDiningOrder({ restaurantId, orderId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      try {
        sessionStorage.removeItem(CAISSE_QUICK_COUNTER_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      onReset();
      router.refresh();
    });
  };

  const lines = snapshot?.lines ?? [];
  const totalTtc = snapshot?.totalTtc ?? 0;
  const ticketLabel = snapshot?.ticketLabel ?? "…";

  const header = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 px-2 py-1.5">
      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
        <span className="text-indigo-600">Ticket ·</span> {ticketLabel}
      </p>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Link
          href={`/salle/commande/${orderId}?from=caisse`}
          className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
        >
          Fiche
        </Link>
        <button
          type="button"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
          disabled={pending}
          title="La commande reste ouverte (liste En cours). Retour à l’écran caisse."
          onClick={() => onReset()}
        >
          Enregistrer
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={pending}
          title="Masquer ce ticket pour en saisir un autre (les commandes ouvertes restent dans En cours)"
          onClick={() => onReset()}
        >
          Nouveau
        </button>
      </div>
    </div>
  );

  const linesContent = (
    <DiningOrderTicketLinesScroll>
      {loading ? (
        <p className={`py-2 text-center text-xs ${uiLead}`}>…</p>
      ) : lines.length === 0 ? (
        <DiningOrderTicketEmptyLines message="Ajoutez des plats ci‑dessous." />
      ) : (
        <ul className="space-y-1">
          {lines.map((l) => (
            <DiningOrderTicketLineRow
              key={l.id}
              line={l}
              pending={pending}
              onAdjust={(id, d) => adjustLine(id, d)}
              onRemove={removeLine}
              onDiscount={setDiscountLine}
            />
          ))}
        </ul>
      )}
    </DiningOrderTicketLinesScroll>
  );

  const footer = (
    <DiningOrderTicketFooterBar
      totalTtc={totalTtc}
      paymentMethod={paymentMethod}
      onPaymentMethod={setPaymentMethod}
      pending={pending}
      loading={loading}
      linesCount={lines.length}
      onSettle={handleSettle}
      onCancel={handleCancel}
    />
  );

  return (
    <>
      <div className="sticky top-0 z-40 -mx-4 mb-2 border-b border-indigo-100 bg-white/95 px-4 pb-2 pt-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto max-w-3xl">
          <DiningOrderTicketCard header={header} error={error} linesContent={linesContent} footer={footer} />
        </div>
      </div>

      <DiningLineDiscountModal
        restaurantId={restaurantId}
        line={discountLine}
        onClose={() => setDiscountLine(null)}
        onApplied={() => {
          setDiscountLine(null);
          sync();
        }}
      />
    </>
  );
}
