"use client";

import { Wine } from "lucide-react";
import { loadBarPassAction, markBarLinePreparedAction } from "@/app/bar/actions";
import type { DiningPassQueue } from "@/lib/dining/diningPassData";
import { DiningPassClient, type DiningPassClientConfig } from "@/components/dining/DiningPassClient";

const barPassConfig: DiningPassClientConfig = {
  variant: "bar",
  emptyIcon: Wine,
  emptyTitle: "Aucune commande boisson",
  emptySubtitle:
    "Les boissons et vins apparaissent ici quand le serveur valide l'envoi au bar depuis le ticket.",
  pendingLabel: (n) => `${n} boisson(s) en attente`,
  headerClass: "bg-violet-900",
  groupLabelClass: "text-violet-700",
  loadQueue: async (restaurantId) => {
    const res = await loadBarPassAction(restaurantId);
    if (!res.ok || !res.data) {
      return { ok: false as const, error: res.ok === false ? res.error : "Erreur." };
    }
    return { ok: true as const, data: res.data };
  },
  markPrepared: markBarLinePreparedAction,
};

type Props = {
  restaurantId: string;
  initialQueue: DiningPassQueue;
};

export function BarPassClient({ restaurantId, initialQueue }: Props) {
  return (
    <DiningPassClient restaurantId={restaurantId} initialQueue={initialQueue} config={barPassConfig} />
  );
}
