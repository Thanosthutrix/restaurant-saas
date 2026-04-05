"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { Dish } from "@/lib/db";
import type { CategoryTreeNode } from "@/lib/catalog/restaurantCategories";
import { DishCatalogTileButton, DishCatalogTiles } from "@/components/dining/DishCatalogTiles";
import { addDishToQuickCounterOrReuse } from "./actions";
import { CaisseNewTicketForm } from "./CaisseNewTicketForm";
import { CaisseQuickTicketPanel } from "./CaisseQuickTicketPanel";
import { CAISSE_QUICK_COUNTER_STORAGE_KEY } from "./caisseQuickStorage";
import { uiCard, uiError, uiLead, uiSuccess } from "@/components/ui/premium";
import type { DishCatalogTilesProps } from "@/components/dining/DishCatalogTiles";

function DishTapButton({
  dish,
  restaurantId,
  onOrderChange,
}: {
  dish: Dish;
  restaurantId: string;
  onOrderChange: (orderId: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tap = () => {
    setError(null);
    let existing: string | null = null;
    try {
      existing = sessionStorage.getItem(CAISSE_QUICK_COUNTER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    startTransition(async () => {
      const res = await addDishToQuickCounterOrReuse({
        restaurantId,
        dishId: dish.id,
        existingOrderId: existing,
      });
      if (!res.ok || !res.data) {
        setError(res.ok === false ? res.error : "Erreur inattendue.");
        return;
      }
      const oid = res.data.orderId;
      try {
        sessionStorage.setItem(CAISSE_QUICK_COUNTER_STORAGE_KEY, oid);
      } catch {
        /* ignore */
      }
      onOrderChange(oid);
      router.refresh();
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
  roots: CategoryTreeNode[];
  directByCategoryId: Record<string, Dish[]>;
  uncategorized: Dish[];
};

export function CaisseDishPicker({ restaurantId, roots, directByCategoryId, uncategorized }: Props) {
  const router = useRouter();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [ticketRefreshTick, setTicketRefreshTick] = useState(0);
  const [settledFlash, setSettledFlash] = useState<string | null>(null);

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

  const onOrderChange = useCallback((orderId: string) => {
    setActiveOrderId(orderId);
    setTicketRefreshTick((n) => n + 1);
  }, []);

  if (totalPlats === 0) {
    return (
      <section className="space-y-3">
        {!activeOrderId ? <CaisseNewTicketForm restaurantId={restaurantId} /> : null}
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
      {!activeOrderId ? <CaisseNewTicketForm restaurantId={restaurantId} /> : null}

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
          onReset={resetQuickTicket}
          onSettled={(msg) => setSettledFlash(msg)}
        />
      ) : null}

      <DishCatalogTiles
        tileKeyPrefix="caisse"
        roots={roots}
        directByCategoryId={directByCategoryId}
        uncategorized={uncategorized}
        renderDish={(dish) => (
          <DishTapButton dish={dish} restaurantId={restaurantId} onOrderChange={onOrderChange} />
        )}
      />
    </section>
  );
}
