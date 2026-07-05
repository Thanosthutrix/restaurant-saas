"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Armchair, ShoppingBag } from "lucide-react";
import type { OpenOrderCaisseRow } from "@/lib/dining/diningDb";
import type { DiningOrderSessionBundle } from "@/lib/dining/diningOrderViewData";
import { DiningOrderModal } from "@/components/dining/DiningOrderModal";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";

function fmtEur(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

type Props = {
  restaurantId: string;
  orders: OpenOrderCaisseRow[];
  orderSession: DiningOrderSessionBundle;
};

export function CaisseOpenOrdersGrid({ restaurantId, orders, orderSession }: Props) {
  const router = useRouter();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const selected = orders.find((row) => row.orderId === selectedOrderId) ?? null;

  const debouncedRefresh = useDebouncedCallback(() => {
    router.refresh();
  }, 2000);

  function handleOrderChanged() {
    debouncedRefresh();
  }

  function handleModalClose() {
    setSelectedOrderId(null);
    router.refresh();
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {orders.map((row) => {
          const RowIcon = row.kind === "counter" ? ShoppingBag : Armchair;
          const tileTitle = row.kind === "counter" ? row.label : `Table ${row.label}`;
          return (
            <li key={row.orderId}>
              <button
                type="button"
                onClick={() => setSelectedOrderId(row.orderId)}
                className="group flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-copper-300 bg-copper-50/60 p-3 text-center shadow-sm ring-1 ring-copper-200 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-600"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-copper-100 text-copper-800">
                  <RowIcon className="h-5 w-5" aria-hidden />
                </span>
                <span className="line-clamp-1 font-semibold text-stone-900">{tileTitle}</span>
                <span className="text-lg font-bold tabular-nums text-copper-800">{fmtEur(row.totalTtc)}</span>
                <span className="text-[11px] text-stone-500">
                  {row.lineCount} ligne{row.lineCount !== 1 ? "s" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <DiningOrderModal
          restaurantId={restaurantId}
          orderId={selected.orderId}
          title={selected.kind === "counter" ? selected.label : `Table ${selected.label}`}
          subtitle={selected.kind === "counter" ? "Ticket comptoir" : undefined}
          icon={selected.kind === "counter" ? ShoppingBag : Armchair}
          session={orderSession}
          cancelRedirectHref="/caisse"
          fullScreenHref={`/salle/commande/${selected.orderId}?from=caisse`}
          onClose={handleModalClose}
          onOrderChanged={handleOrderChanged}
        />
      ) : null}
    </>
  );
}
