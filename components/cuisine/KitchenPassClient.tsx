"use client";

import { ChefHat } from "lucide-react";
import {
  loadKitchenPassAction,
  markKitchenLinePreparedAction,
  markKitchenTicketAllPreparedAction,
} from "@/app/cuisine/actions";
import type { KitchenPassQueue } from "@/lib/dining/kitchenPassData";
import { DiningPassClient, type DiningPassClientConfig } from "@/components/dining/DiningPassClient";

const kitchenPassConfig: DiningPassClientConfig = {
  variant: "kitchen",
  emptyIcon: ChefHat,
  emptyTitle: "Rien à préparer pour le moment",
  emptySubtitle:
    "Dès qu'un serveur valide un service (entrées, plats…), les bons apparaissent ici par table.",
  pendingLabel: (n) => `${n} plat(s) en attente`,
  headerClass: "bg-stone-900",
  groupLabelClass: "text-copper-700",
  loadQueue: async (restaurantId) => {
    const res = await loadKitchenPassAction(restaurantId);
    if (!res.ok || !res.data) {
      return { ok: false as const, error: res.ok === false ? res.error : "Erreur." };
    }
    return { ok: true as const, data: res.data };
  },
  markPrepared: markKitchenLinePreparedAction,
  markAllPrepared: markKitchenTicketAllPreparedAction,
};

type Props = {
  restaurantId: string;
  initialQueue: KitchenPassQueue;
};

export function KitchenPassClient({ restaurantId, initialQueue }: Props) {
  return (
    <DiningPassClient restaurantId={restaurantId} initialQueue={initialQueue} config={kitchenPassConfig} />
  );
}
