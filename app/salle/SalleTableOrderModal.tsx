"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Armchair } from "lucide-react";
import { loadTableOrderModalData } from "@/app/salle/actions";
import type { FloorTable } from "@/components/salle/InteractiveFloorPlan";
import { DiningOrderModal } from "@/components/dining/DiningOrderModal";
import { uiError } from "@/components/ui/premium";
import type { DiningOrderSessionBundle, DiningOrderViewData } from "@/lib/dining/diningOrderViewData";

type Props = {
  restaurantId: string;
  table: FloorTable;
  session: DiningOrderSessionBundle;
  onClose: () => void;
  onOrderChanged?: () => void;
};

export function SalleTableOrderModal({
  restaurantId,
  table,
  session,
  onClose,
  onOrderChanged,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [viewData, setViewData] = useState<DiningOrderViewData | null>(null);

  useEffect(() => {
    setError(null);
    setViewData(null);
    startTransition(async () => {
      const res = await loadTableOrderModalData({
        restaurantId,
        diningTableId: table.id,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setViewData(res.data ?? null);
    });
  }, [restaurantId, table.id]);

  if (pending && !viewData) {
    return null;
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
        <div className="max-w-md rounded-2xl bg-white p-4 shadow-xl">
          <p className={uiError}>{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 text-sm font-semibold text-copper-700"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  if (!viewData) return null;

  return (
    <DiningOrderModal
      restaurantId={restaurantId}
      orderId={viewData.orderId}
      title={table.label}
      subtitle={
        viewData.placeDescription ??
        (table.status === "occupied" ? "Commande en cours" : "Table libre")
      }
      icon={Armchair}
      session={session}
      cancelRedirectHref="/salle"
      fullScreenHref={`/salle/commande/${viewData.orderId}`}
      onClose={onClose}
      onOrderChanged={() => {
        onOrderChanged?.();
        router.refresh();
      }}
      initialViewData={viewData}
    />
  );
}
