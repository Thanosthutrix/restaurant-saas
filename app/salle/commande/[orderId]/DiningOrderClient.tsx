"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Dish } from "@/lib/db";
import type { CategoryTreeNode } from "@/lib/catalog/restaurantCategories";
import {
  addDishToDiningOrder,
  cancelOpenDiningOrder,
  notifyDiningOrderReadyByEmail,
  removeDiningOrderLine,
  setDiningOrderLinePrepared,
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
import { DiningOrderTotalModal } from "@/app/salle/DiningOrderTotalModal";
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
import type { CustomerLookupRow } from "@/lib/customers/customersDb";
import { CustomerTicketMemoDialog } from "../CustomerTicketMemoDialog";
import { DiningOrderCustomerLinkPanel } from "../DiningOrderCustomerLinkPanel";
import { uiCard, uiError, uiLead, uiSuccess } from "@/components/ui/premium";
import type { OrderTicketSnapshot } from "@/lib/dining/orderTicketSnapshot";
import {
  optimisticAddDishLine,
  optimisticLinePrepared,
  optimisticLineQty,
  optimisticRemoveLine,
  orderTotalFromLines,
} from "@/lib/dining/optimisticTicketClient";
import { resetTableToBaseLayout } from "@/lib/salle/floorPlanLayout";

const DEFAULT_SERVICE = "lunch" as const;

function OrderDishTapButton({
  dish,
  restaurantId,
  orderId,
  onOptimisticAdd,
  onTicketApplied,
  onRevert,
}: {
  dish: Dish;
  restaurantId: string;
  orderId: string;
  onOptimisticAdd: () => void;
  onTicketApplied: (ticket: OrderTicketSnapshot) => void;
  onRevert: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [addedCount, setAddedCount] = useState(0);
  const [flash, setFlash] = useState(false);

  const tap = () => {
    setError(null);
    onOptimisticAdd();
    setAddedCount((n) => n + 1);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 600);
    startTransition(async () => {
      const res = await addDishToDiningOrder({
        restaurantId,
        orderId,
        dishId: dish.id,
        qty: 1,
      });
      if (!res.ok || !res.data) {
        onRevert();
        setError(res.ok === false ? res.error : "Erreur inattendue.");
        return;
      }
      onTicketApplied(res.data);
    });
  };

  return (
    <div className="space-y-1">
      <DishCatalogTileButton
        dish={dish}
        disabled={pending}
        onClick={tap}
        badge={
          addedCount > 0 ? (
            <span
              className={`flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-bold text-white transition ${
                flash ? "scale-110 bg-emerald-600" : "bg-copper-700"
              }`}
              aria-label={`${addedCount} ajouté${addedCount > 1 ? "s" : ""}`}
            >
              ×{addedCount}
            </span>
          ) : null
        }
      />
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
  amountPaidTtc?: number;
  catalogRoots: CategoryTreeNode[];
  directByCategoryId: Record<string, Dish[]>;
  uncategorized: Dish[];
  linkedCustomer: {
    id: string;
    display_name: string;
    service_memo: string | null;
    allergens_note: string | null;
  } | null;
  /** E-mail fiche client (notif. « commande prête »). */
  linkedCustomerEmail: string | null;
  customerSearchPool: CustomerLookupRow[];
  diningTableId?: string | null;
  guestLabel?: string | null;
  /** Modale salle : fermeture sans navigation pleine page. */
  embeddedInModal?: boolean;
  onEmbeddedClose?: () => void;
  /** Rafraîchir les données affichées (modale) après une action serveur. */
  onOrderChanged?: () => void;
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
  amountPaidTtc = 0,
  catalogRoots,
  directByCategoryId,
  uncategorized,
  linkedCustomer,
  linkedCustomerEmail,
  customerSearchPool,
  diningTableId = null,
  guestLabel = null,
  embeddedInModal = false,
  onEmbeddedClose,
  onOrderChanged,
}: Props) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<DiningPaymentMethod>("card");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [discountLine, setDiscountLine] = useState<DiningLineClient | null>(null);
  const [totalModalOpen, setTotalModalOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [localLines, setLocalLines] = useState(lines);
  const [localTotalTtc, setLocalTotalTtc] = useState(totalTtc);
  const [localPaidTtc, setLocalPaidTtc] = useState(amountPaidTtc);
  const ticketRollbackRef = useRef<{ lines: DiningLineClient[]; totalTtc: number } | null>(null);

  useEffect(() => {
    setLocalLines(lines);
    setLocalTotalTtc(totalTtc);
    setLocalPaidTtc(amountPaidTtc);
  }, [orderId, lines, totalTtc, amountPaidTtc]);

  const applyTicket = (ticket: OrderTicketSnapshot) => {
    setLocalLines(ticket.lines);
    setLocalTotalTtc(ticket.totalTtc);
    setLocalPaidTtc(ticket.amountPaidTtc);
  };

  const notifyListStale = () => {
    onOrderChanged?.();
  };

  const totalPlats = useMemo(() => {
    const n = Object.values(directByCategoryId).reduce((s, arr) => s + arr.length, 0);
    return n + uncategorized.length;
  }, [directByCategoryId, uncategorized]);

  const syncFromServer = () => {
    notifyListStale();
  };

  const adjustLine = (lineId: string, delta: number) => {
    const line = localLines.find((l) => l.id === lineId);
    if (!line) return;
    const next = line.qty + delta;
    if (next <= 0) return;
    setError(null);
    const prevLines = localLines;
    const optimisticLines = optimisticLineQty(localLines, lineId, next);
    setLocalLines(optimisticLines);
    setLocalTotalTtc(orderTotalFromLines(optimisticLines));
    startTransition(async () => {
      const res = await setDiningOrderLineQty({ restaurantId, lineId, qty: next });
      if (!res.ok || !res.data) {
        setLocalLines(prevLines);
        setLocalTotalTtc(orderTotalFromLines(prevLines));
        setError(res.ok === false ? res.error : "Erreur inattendue.");
        return;
      }
      applyTicket(res.data);
    });
  };

  const removeLine = (lineId: string) => {
    setError(null);
    const prevLines = localLines;
    const optimisticLines = optimisticRemoveLine(localLines, lineId);
    setLocalLines(optimisticLines);
    setLocalTotalTtc(orderTotalFromLines(optimisticLines));
    startTransition(async () => {
      const res = await removeDiningOrderLine({ restaurantId, lineId });
      if (!res.ok || !res.data) {
        setLocalLines(prevLines);
        setLocalTotalTtc(orderTotalFromLines(prevLines));
        setError(res.ok === false ? res.error : "Erreur inattendue.");
        return;
      }
      applyTicket(res.data);
    });
  };

  const toggleLinePrepared = (lineId: string, next: boolean) => {
    setError(null);
    setSuccess(null);
    const prevLines = localLines;
    setLocalLines(optimisticLinePrepared(localLines, lineId, next));
    startTransition(async () => {
      const res = await setDiningOrderLinePrepared({ restaurantId, lineId, isPrepared: next });
      if (!res.ok) {
        setLocalLines(prevLines);
        setError(res.error);
      }
    });
  };

  const sendReadyEmailManual = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await notifyDiningOrderReadyByEmail({ restaurantId, orderId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data?.alreadySent) {
        setSuccess("Cet e-mail a déjà été envoyé pour cette commande.");
      } else {
        setSuccess("E-mail « commande prête » envoyé.");
      }
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
      if (res.data?.diningTableId) resetTableToBaseLayout(restaurantId, res.data.diningTableId);
      syncFromServer();
    });
  };

  const handleSaveAndReturn = () => {
    try {
      sessionStorage.removeItem(CAISSE_QUICK_COUNTER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (embeddedInModal && onEmbeddedClose) {
      onEmbeddedClose();
      return;
    }
    router.push(cancelRedirectHref);
    router.refresh();
  };

  const saveReturnTitle =
    cancelRedirectHref === "/caisse"
      ? "Conserver la commande ouverte et revenir à la caisse"
      : cancelRedirectHref.startsWith("/clients")
        ? "Conserver la commande ouverte et revenir à la fiche client"
        : "Conserver la commande ouverte et revenir à la salle";

  const handleCancel = () => {
    const n = localLines.length;
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
      if (res.data?.diningTableId) resetTableToBaseLayout(restaurantId, res.data.diningTableId);
      if (embeddedInModal && onEmbeddedClose) {
        onEmbeddedClose();
        return;
      }
      router.push(cancelRedirectHref);
      router.refresh();
    });
  };

  if (status === "settled") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-stone-200/90 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-2 py-1.5">
            <p className="text-xs font-semibold text-emerald-800">Encaissée</p>
            <p className="truncate text-[11px] text-stone-600">{placeDescription}</p>
          </div>
          <div className="space-y-2 px-2 py-2 text-sm text-stone-800">
            <p>
              <span className="text-stone-600">Total TTC : </span>
              <span className="font-bold tabular-nums">{fmtEur(localTotalTtc)}</span>
            </p>
            <p>
              <span className="text-stone-600">Paiement : </span>
              <span className="font-semibold">
                {DINING_PAYMENT_LABEL_FR[parseDiningPaymentMethod(settledPaymentMethod)]}
              </span>
            </p>
            {serviceId ? (
              <p>
                <Link
                  href={`/service/${serviceId}`}
                  className="text-xs font-semibold text-copper-700 hover:text-copper-600"
                >
                  Voir le service et le stock →
                </Link>
              </p>
            ) : null}
            {linkedCustomer ? (
              <p className="text-xs text-stone-600">
                Client :{" "}
                <button
                  type="button"
                  className="font-semibold text-copper-700 underline"
                  onClick={() => setMemoOpen(true)}
                >
                  {linkedCustomer.display_name}
                </button>{" "}
                <Link href={`/clients/${linkedCustomer.id}`} className="ml-1 text-copper-700 hover:underline">
                  (fiche)
                </Link>{" "}
                — l’historique de commande a été mis à jour sur la fiche.
              </p>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border border-stone-200/90 bg-stone-50/80 px-2 py-2">
          <p className={`mb-2 text-[11px] leading-snug ${uiLead}`}>
            Pour modifier les lignes ou le paiement, dévalidez l’encaissement (le stock et le service
            seront annulés).
          </p>
          <ReopenSettledDiningOrderButton restaurantId={restaurantId} orderId={orderId} />
        </div>
        {linkedCustomer ? (
          <CustomerTicketMemoDialog
            open={memoOpen}
            onClose={() => setMemoOpen(false)}
            customer={linkedCustomer}
          />
        ) : null}
      </div>
    );
  }

  const header = (
    <div className="border-b border-stone-100 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-stone-900" title={placeDescription}>
          {placeDescription}
        </p>
        <button
          type="button"
          className="flex h-10 shrink-0 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 active:scale-95 disabled:opacity-50"
          disabled={pending}
          title={saveReturnTitle}
          onClick={handleSaveAndReturn}
        >
          Enregistrer
        </button>
      </div>
      <p className={`mt-0.5 text-[10px] ${uiLead}`}>
        Touchez une ligne pour une remise (%, montant ou offert). Touchez le total pour remise globale,
        diviser l&apos;addition ou paiement partiel. « Prêt » = plat terminé côté cuisine
        (e-mail client si toutes les lignes sont prêtes et fiche avec e-mail).
      </p>
    </div>
  );

  const linesContent = (
    <DiningOrderTicketLinesScroll>
      {localLines.length === 0 ? (
        <DiningOrderTicketEmptyLines message="Ajoutez des plats depuis la carte ci‑dessous." />
      ) : (
        <ul className="space-y-1">
          {localLines.map((l) => (
            <DiningOrderTicketLineRow
              key={l.id}
              line={l}
              pending={pending}
              onAdjust={(id, d) => adjustLine(id, d)}
              onRemove={removeLine}
              onDiscount={setDiscountLine}
              onToggleLinePrepared={status === "open" ? toggleLinePrepared : undefined}
            />
          ))}
        </ul>
      )}
    </DiningOrderTicketLinesScroll>
  );

  const footer = (
    <DiningOrderTicketFooterBar
      totalTtc={localTotalTtc}
      amountPaidTtc={localPaidTtc}
      paymentMethod={paymentMethod}
      onPaymentMethod={setPaymentMethod}
      pending={pending}
      linesCount={localLines.length}
      onSettle={handleSettle}
      onCancel={handleCancel}
      onTotalClick={status === "open" ? () => setTotalModalOpen(true) : undefined}
    />
  );

  return (
    <div className="space-y-3">
      {success ? <p className={uiSuccess}>{success}</p> : null}

      {status === "open" ? (
        <div className="space-y-2">
          <DiningOrderCustomerLinkPanel
            restaurantId={restaurantId}
            orderId={orderId}
            linked={linkedCustomer}
            recentCustomerPool={customerSearchPool}
            isTableOrder={diningTableId != null}
            guestLabel={guestLabel}
            onUpdated={syncFromServer}
          />
          {localLines.length > 0 && linkedCustomerEmail ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2">
              <p className="min-w-0 flex-1 text-[11px] text-stone-600">
                Envoyer l’e-mail « commande prête » (sans attendre toutes les lignes Prêt) :
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={sendReadyEmailManual}
                className="flex h-10 shrink-0 items-center rounded-lg border border-copper-200 bg-white px-3 text-sm font-semibold text-copper-800 shadow-sm transition hover:bg-copper-50 disabled:opacity-50"
              >
                Notifier (e-mail)
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <DiningOrderTicketCard header={header} error={error} linesContent={linesContent} footer={footer} />

      {totalPlats === 0 ? (
        <div className={uiCard}>
          <p className={uiLead}>
            Aucun plat avec prix dans la carte.{" "}
            <Link href="/dishes" className="font-semibold text-copper-700">
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
              onOptimisticAdd={() => {
                ticketRollbackRef.current = { lines: localLines, totalTtc: localTotalTtc };
                const optimisticLines = optimisticAddDishLine(localLines, dish);
                setLocalLines(optimisticLines);
                setLocalTotalTtc(orderTotalFromLines(optimisticLines));
              }}
              onTicketApplied={applyTicket}
              onRevert={() => {
                const prev = ticketRollbackRef.current;
                if (!prev) return;
                setLocalLines(prev.lines);
                setLocalTotalTtc(prev.totalTtc);
              }}
            />
          )}
          renderModalFooter={(close) => {
            const count = localLines.reduce((acc, l) => acc + l.qty, 0);
            return (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-stone-400">Commande en cours</p>
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {count} article{count > 1 ? "s" : ""} ·{" "}
                    <span className="tabular-nums text-copper-800">{fmtEur(localTotalTtc)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="copper-sheen inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Voir la commande
                </button>
              </div>
            );
          }}
        />
      )}

      <DiningLineDiscountModal
        restaurantId={restaurantId}
        line={discountLine}
        onClose={() => setDiscountLine(null)}
        onApplied={(ticket) => {
          if (ticket) applyTicket(ticket);
        }}
      />

      <DiningOrderTotalModal
        restaurantId={restaurantId}
        orderId={orderId}
        open={totalModalOpen}
        totalTtc={localTotalTtc}
        amountPaidTtc={localPaidTtc}
        paymentMethod={paymentMethod}
        onPaymentMethod={setPaymentMethod}
        onClose={() => setTotalModalOpen(false)}
        onApplied={(update) => {
          if (!update) return;
          if ("lines" in update) {
            applyTicket(update);
          } else {
            setLocalPaidTtc(update.amountPaidTtc);
          }
        }}
      />
    </div>
  );
}
