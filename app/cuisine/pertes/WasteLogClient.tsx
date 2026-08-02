"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { WasteLogRow } from "@/lib/analysis/wasteDb";
import { WasteQuickLogSheet } from "@/components/analysis/WasteQuickLogSheet";
import { uiBtnPrimary, uiCard, uiMuted } from "@/components/ui/premium";

const WASTE_TYPE_LABELS: Record<string, string> = {
  raw: "Brute",
  prep: "Prépa",
  plate: "Assiette",
};

const REASON_LABELS: Record<string, string> = {
  dlc: "DLC",
  cooking: "Cuisson",
  dropped: "Tombé",
  quality: "Qualité",
  other: "Autre",
};

type Props = {
  restaurantId: string;
  inventoryItems: { id: string; name: string; unit: string }[];
  dishes: { id: string; name: string }[];
  initialLogs: WasteLogRow[];
};

export function WasteLogClient({ restaurantId, inventoryItems, dishes, initialLogs }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [logs, setLogs] = useState(initialLogs);

  return (
    <div className="space-y-4">
      <button
        type="button"
        className={`${uiBtnPrimary} inline-flex items-center gap-2`}
        onClick={() => setSheetOpen(true)}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Nouvelle perte
      </button>

      <section className={uiCard}>
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Dernières pertes</h2>
        {logs.length === 0 ? (
          <p className={uiMuted}>Aucune perte enregistrée pour l'instant.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {WASTE_TYPE_LABELS[log.waste_type] ?? log.waste_type} · {REASON_LABELS[log.reason] ?? log.reason}
                  </p>
                  <p className={uiMuted}>
                    {log.quantity} {log.unit}
                    {log.estimated_cost_ht != null ? ` · ~${log.estimated_cost_ht.toFixed(2)} € HT` : ""}
                  </p>
                </div>
                <time className={uiMuted} dateTime={log.logged_at}>
                  {new Intl.DateTimeFormat("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(log.logged_at))}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WasteQuickLogSheet
        open={sheetOpen}
        restaurantId={restaurantId}
        inventoryItems={inventoryItems}
        dishes={dishes}
        onClose={() => setSheetOpen(false)}
        onLogged={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
