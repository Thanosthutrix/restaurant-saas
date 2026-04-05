"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { Dish } from "@/lib/db";
import type { CategoryTreeNode } from "@/lib/catalog/restaurantCategories";
import {
  addDishToDiningOrder,
  cancelOpenDiningOrder,
  removeDiningOrderLine,
  setDiningOrderLineQty,
  settleDiningOrder,
} from "@/app/salle/actions";
import {
  DINING_PAYMENT_LABEL_FR,
  parseDiningPaymentMethod,
  type DiningPaymentMethod,
} from "@/lib/dining/diningPaymentMethods";
import { ReopenSettledDiningOrderButton } from "@/app/salle/ReopenSettledDiningOrderButton";
import { DiningLineDiscountModal } from "@/app/salle/DiningLineDiscountModal";
import type { DiningLineClient } from "../diningOrderTypes";
import { DishCatalogTileButton, DishCatalogTiles } from "@/components/dining/DishCatalogTiles";
import {
  DiningOrderTicketCard,
  DiningOrderTicketEmptyLines,
  DiningOrderTicketFooterBar,
  DiningOrderTicketLineRow,
  DiningOrderTicketLinesScroll,
  fmtEur,
} from "@/components/dining/DiningOrderTicketUi";
import { CAISSE_QUICK_COUNTER_STORAGE_KEY } from "@/app/caisse/caisseQuickStorage";
import { uiCard, uiError, uiLead, uiSuccess } from "@/components/ui/premium";

const DEFAULT_SERVICE = "lunch" as const;

function OrderDishTapButton({
  dish,
  restaurantId,
  orderId,
  onAdded,
}: {
  dish: Dish;
  restaurantId: string;
  orderId: string;
  onAdded: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tap = () => {
    setError(null);
    startTransition(async () => {
      const res = await addDishToDiningOrder({
        restaurantId,
        orderId,
        dishId: dish.id,
        qty: 1,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onAdded();
    });
  };

  return (
    <div className="space-y-1">
      <DishCatalogTileButton dish={dish} disabled={pending} onClick={tap} />
      {error ? <p className={`${uiError} text-xs`}>{error}</p> : null}
    </div>
  );
}

type Props = {
  restaurantId: string;
  orderId: string;
  status: "open" | "settled";
  serviceId: string | null;
  placeDescription: string;
  cancelRedirectHref: string;
  settledPaymentMethod?: string | null;
  lines: DiningLineClient[];
  totalTtc: number;
  catalogRoots: CategoryTreeNode[];
  directByCategoryId: Record<string, Dish[]>;
  uncategorized: Dish[];
};

export function DiningOrderClient({
  restaurantId,
  orderId,
  status,
  serviceId,
  placeDescription,
  cancelRedirectHref,
  settledPaymentMethod,
  lines,
  totalTtc,
  catalogRoots,
  directByCategoryId,
  uncategorized,
}: Props) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<DiningPaymentMethod>("card");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [discountLine, setDiscountLine] = useState<DiningLineClient | null>(null);

  const totalPlats = useMemo(() => {
    const n = Object.values(directByCategoryId).reduce((s, arr) => s + arr.length, 0);
    return n + uncategorized.length;
  }, [directByCategoryId, uncategorized]);

  const syncFromServer = () => {
    router.refresh();
  };

  const adjustLine = (lineId: string, delta: number) => {
    const line = lines.find((l) => l.id === lineId);
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
      syncFromServer();
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
      syncFromServer();
    });
  };

  const handleSettle = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await settleDiningOrder({
        restaurantId,
        orderId,
        serviceType: DEFAULT_SERVICE,
        paymentMethod,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(`Encaissement enregistré (${fmtEur(res.data?.totalTtc ?? 0)}).`);
      syncFromServer();
    });
  };

  const handleSaveAndReturn = () => {
    try {
      sessionStorage.removeItem(CAISSE_QUICK_COUNTER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    router.push(cancelRedirectHref);
    router.refresh();
  };

  const saveReturnTitle =
    cancelRedirectHref === "/caisse"
      ? "Conserver la commande ouverte et revenir à la caisse"
      : "Conserver la commande ouverte et revenir à la salle";

  const handleCancel = () => {
    const n = lines.length;
    const msg =
      n === 0
        ? `Annuler la commande (${placeDescription}) ? Aucune vente ne sera enregistrée.`
        : `Annuler la commande (${placeDescription}) ? Les ${n} ligne${n > 1 ? "s" : ""} seront supprimées.`;
    if (!window.confirm(msg)) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelOpenDiningOrder({ restaurantId, orderId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(cancelRedirectHref);
      router.refresh();
    });
  };

  if (status === "settled") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-2 py-1.5">
            <p className="text-xs font-semibold text-emerald-800">Encaissée</p>
            <p className="truncate text-[11px] text-slate-600">{placeDescription}</p>
          </div>
          <div className="space-y-2 px-2 py-2 text-sm text-slate-800">
            <p>
              <span className="text-slate-600">Total TTC : </span>
              <span className="font-bold tabular-nums">{fmtEur(totalTtc)}</span>
            </p>
            <p>
              <span className="text-slate-600">Paiement : </span>
              <span className="font-semibold">
                {DINING_PAYMENT_LABEL_FR[parseDiningPaymentMethod(settledPaymentMethod)]}
              </span>
            </p>
            {serviceId ? (
              <p>
                <Link
                  href={`/service/${serviceId}`}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  Voir le service et le stock →
                </Link>
              </p>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-2 py-2">
          <p className={`mb-2 text-[11px] leading-snug ${uiLead}`}>
            Pour modifier les lignes ou le paiement, dévalidez l’encaissement (le stock et le service
            seront annulés).
          </p>
          <ReopenSettledDiningOrderButton restaurantId={restaurantId} orderId={orderId} />
        </div>
      </div>
    );
  }

  const header = (
    <div className="border-b border-slate-100 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
          <span className="text-indigo-600">Commande ·</span> {placeDescription}
        </p>
        <button
          type="button"
          className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
          disabled={pending}
          title={saveReturnTitle}
          onClick={handleSaveAndReturn}
        >
          Enregistrer
        </button>
      </div>
      <p className={`mt-0.5 text-[10px] ${uiLead}`}>Touchez une ligne pour une remise (%, montant ou offert).</p>
    </div>
  );

  const linesContent = (
    <DiningOrderTicketLinesScroll>
      {lines.length === 0 ? (
        <DiningOrderTicketEmptyLines message="Ajoutez des plats depuis la carte ci‑dessous." />
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
      linesCount={lines.length}
      onSettle={handleSettle}
      onCancel={handleCancel}
    />
  );

  return (
    <div className="space-y-3">
      {success ? <p className={uiSuccess}>{success}</p> : null}

      <DiningOrderTicketCard header={header} error={error} linesContent={linesContent} footer={footer} />

      {totalPlats === 0 ? (
        <div className={uiCard}>
          <p className={uiLead}>
            Aucun plat avec prix dans la carte.{" "}
            <Link href="/dishes" className="font-semibold text-indigo-600">
              Créer des plats
            </Link>{" "}
            dans « Plats vendus ».
          </p>
        </div>
      ) : (
        <DishCatalogTiles
          tileKeyPrefix="commande"
          roots={catalogRoots}
          directByCategoryId={directByCategoryId}
          uncategorized={uncategorized}
          renderDish={(dish) => (
            <OrderDishTapButton
              dish={dish}
              restaurantId={restaurantId}
              orderId={orderId}
              onAdded={syncFromServer}
            />
          )}
        />
      )}

      <DiningLineDiscountModal
        restaurantId={restaurantId}
        line={discountLine}
        onClose={() => setDiscountLine(null)}
        onApplied={syncFromServer}
      />
    </div>
  );
}
