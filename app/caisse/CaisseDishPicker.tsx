"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dish } from "@/lib/db";
import type { CategoryTreeNode } from "@/lib/catalog/restaurantCategories";
import type { CustomerLookupRow } from "@/lib/customers/customersDb";
import { DishCatalogTileButton, DishCatalogTiles } from "@/components/dining/DishCatalogTiles";
import { addDishToQuickCounterOrReuse } from "./actions";
import { CaisseNewTicketForm } from "./CaisseNewTicketForm";
import { CaisseQuickTicketPanel } from "./CaisseQuickTicketPanel";
import { CAISSE_QUICK_COUNTER_STORAGE_KEY } from "./caisseQuickStorage";
import { uiCard, uiError, uiLead, uiSuccess } from "@/components/ui/premium";
import type { OrderTicketSnapshot } from "@/lib/dining/orderTicketSnapshot";

function DishTapButton({
  dish,
  onAddDish,
}: {
  dish: Dish;
  onAddDish: (dishId: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [flash, setFlash] = useState(false);

  const tap = () => {
    setError(null);

    // Retour visuel OPTIMISTE immédiat + AUCUN `disabled` : on peut enchaîner les taps
    // en rafale (style natif). La création de ticket est sérialisée côté parent
    // (`addDish`), donc un seul ticket est créé quel que soit le rythme des taps.
    setAddedCount((n) => n + 1);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 600);

    void onAddDish(dish.id).then((res) => {
      if (!res.ok) {
        setAddedCount((n) => Math.max(0, n - 1)); // rollback du badge optimiste
        setError(res.error ?? "Erreur inattendue.");
      }
    });
  };

  return (
    <div className="space-y-1">
      <DishCatalogTileButton
        dish={dish}
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
  roots: CategoryTreeNode[];
  directByCategoryId: Record<string, Dish[]>;
  uncategorized: Dish[];
  recentCustomerPool: CustomerLookupRow[];
};

const eurFmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export function CaisseDishPicker({
  restaurantId,
  roots,
  directByCategoryId,
  uncategorized,
  recentCustomerPool,
}: Props) {
  const router = useRouter();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [ticketRefreshTick, setTicketRefreshTick] = useState(0);
  const [ticketPatch, setTicketPatch] = useState<OrderTicketSnapshot | null>(null);
  const [settledFlash, setSettledFlash] = useState<string | null>(null);
  const [ticketSummary, setTicketSummary] = useState<{ count: number; totalTtc: number } | null>(null);

  const handleSummary = useCallback(
    (s: { count: number; totalTtc: number }) => setTicketSummary(s),
    []
  );

  const totalPlats = useMemo(() => {
    const n = Object.values(directByCategoryId).reduce((s, arr) => s + arr.length, 0);
    return n + uncategorized.length;
  }, [directByCategoryId, uncategorized]);

  const resetQuickTicket = useCallback(() => {
    try {
      sessionStorage.removeItem(CAISSE_QUICK_COUNTER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setActiveOrderId(null);
    setTicketSummary(null);
    router.refresh();
  }, [router]);

  const syncFromStorage = useCallback(() => {
    try {
      const id = sessionStorage.getItem(CAISSE_QUICK_COUNTER_STORAGE_KEY);
      setActiveOrderId(id);
    } catch {
      setActiveOrderId(null);
    }
  }, []);

  useEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  useEffect(() => {
    if (!settledFlash) return;
    const t = window.setTimeout(() => setSettledFlash(null), 5000);
    return () => window.clearTimeout(t);
  }, [settledFlash]);

  // Ref synchrone de l'ID de commande + verrou de création. Garantit qu'UN SEUL ticket
  // est créé même si l'utilisateur tape plusieurs plats en rafale avant la 1ère réponse
  // serveur (sinon chaque tap « sans commande » créerait un ticket distinct = bug caisse).
  const orderIdRef = useRef<string | null>(activeOrderId);
  useEffect(() => {
    orderIdRef.current = activeOrderId;
  }, [activeOrderId]);
  const createInFlightRef = useRef<Promise<string | null> | null>(null);

  const applyOrderResult = useCallback((orderId: string, ticket: OrderTicketSnapshot) => {
    orderIdRef.current = orderId;
    try {
      sessionStorage.setItem(CAISSE_QUICK_COUNTER_STORAGE_KEY, orderId);
    } catch {
      /* ignore */
    }
    setActiveOrderId(orderId);
    setTicketPatch(ticket);
  }, []);

  const addDish = useCallback(
    async (dishId: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        let orderId = orderIdRef.current;

        // Une création est déjà en cours : on attend son ID au lieu d'en lancer une 2e.
        if (!orderId && createInFlightRef.current) {
          orderId = await createInFlightRef.current;
        }

        // Aucune commande : on en crée UNE seule (verrou). Cette action ajoute déjà ce plat.
        if (!orderId) {
          const createPromise = (async (): Promise<string | null> => {
            const res = await addDishToQuickCounterOrReuse({
              restaurantId,
              dishId,
              existingOrderId: null,
            });
            if (!res.ok || !res.data) {
              throw new Error(res.ok === false ? res.error : "Erreur inattendue.");
            }
            applyOrderResult(res.data.orderId, res.data.ticket);
            return res.data.orderId;
          })();
          createInFlightRef.current = createPromise;
          try {
            await createPromise;
          } finally {
            if (createInFlightRef.current === createPromise) createInFlightRef.current = null;
          }
          return { ok: true };
        }

        // Une commande existe déjà : on la réutilise (aucun nouveau ticket créé).
        const res = await addDishToQuickCounterOrReuse({
          restaurantId,
          dishId,
          existingOrderId: orderId,
        });
        if (!res.ok || !res.data) {
          return { ok: false, error: res.ok === false ? res.error : "Erreur inattendue." };
        }
        applyOrderResult(res.data.orderId, res.data.ticket);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Erreur inattendue." };
      }
    },
    [restaurantId, applyOrderResult]
  );

  if (totalPlats === 0) {
    return (
      <section className="space-y-3">
        {!activeOrderId ? (
          <CaisseNewTicketForm restaurantId={restaurantId} recentCustomerPool={recentCustomerPool} />
        ) : null}
        {settledFlash ? (
          <p className={`${uiSuccess} rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm`}>
            {settledFlash}
          </p>
        ) : null}
        {activeOrderId ? (
          <CaisseQuickTicketPanel
            restaurantId={restaurantId}
            orderId={activeOrderId}
            refreshTick={ticketRefreshTick}
            ticketPatch={ticketPatch}
            onTicketPatchConsumed={() => setTicketPatch(null)}
            onReset={resetQuickTicket}
            onSettled={(msg) => setSettledFlash(msg)}
          />
        ) : null}
        <div className={uiCard}>
          <p className={uiLead}>Aucun plat avec prix dans la carte. Ajoutez des plats dans « Plats vendus ».</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {!activeOrderId ? (
          <CaisseNewTicketForm restaurantId={restaurantId} recentCustomerPool={recentCustomerPool} />
        ) : null}

      {settledFlash ? (
        <p className={`${uiSuccess} rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm`}>
          {settledFlash}
        </p>
      ) : null}

      {activeOrderId ? (
        <CaisseQuickTicketPanel
          restaurantId={restaurantId}
          orderId={activeOrderId}
          refreshTick={ticketRefreshTick}
          ticketPatch={ticketPatch}
          onTicketPatchConsumed={() => setTicketPatch(null)}
          onReset={resetQuickTicket}
          onSettled={(msg) => setSettledFlash(msg)}
          onSummary={handleSummary}
        />
      ) : null}

      <DishCatalogTiles
        tileKeyPrefix="caisse"
        roots={roots}
        directByCategoryId={directByCategoryId}
        uncategorized={uncategorized}
        renderDish={(dish) => <DishTapButton dish={dish} onAddDish={addDish} />}
        renderModalFooter={
          activeOrderId && ticketSummary
            ? (close) => (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wide text-stone-400">Ticket en cours</p>
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {ticketSummary.count} article{ticketSummary.count > 1 ? "s" : ""} ·{" "}
                      <span className="tabular-nums text-copper-800">{eurFmt(ticketSummary.totalTtc)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="copper-sheen inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    Voir le ticket
                  </button>
                </div>
              )
            : undefined
        }
      />
    </section>
  );
}
