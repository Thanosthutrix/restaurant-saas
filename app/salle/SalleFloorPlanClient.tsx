"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Armchair } from "lucide-react";
import {
  InteractiveFloorPlan,
  type FloorFixture,
  type FloorTable,
} from "@/components/salle/InteractiveFloorPlan";
import type { DiningOrderSessionBundle } from "@/lib/dining/diningOrderViewData";
import {
  clearServiceTableOverrides,
  loadFloorPlanLayout,
  loadServiceTableOverrides,
  markServiceTableActivated,
  mergeServerTablesForSalle,
  saveServiceTableOverrides,
} from "@/lib/salle/floorPlanLayout";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import { SalleTableOrderModal } from "./SalleTableOrderModal";

type TableTileSummary = {
  id: string;
  label: string;
  clientName?: string;
};

type SalleFloorPlanClientProps = {
  restaurantId: string;
  initialTables: FloorTable[];
  orderSession: DiningOrderSessionBundle;
  tableSummaries?: TableTileSummary[];
};

export function SalleFloorPlanClient({
  restaurantId,
  initialTables,
  orderSession,
  tableSummaries = [],
}: SalleFloorPlanClientProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null);
  const [layout, setLayout] = useState<{
    tables: FloorTable[];
    fixtures: FloorFixture[];
    hasServiceOverrides: boolean;
    activatedTableIds: string[];
  }>({
    tables: initialTables,
    fixtures: [],
    hasServiceOverrides: false,
    activatedTableIds: [],
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  function reloadLayout() {
    const stored = loadFloorPlanLayout(restaurantId);
    const serviceOverrides = loadServiceTableOverrides(restaurantId);
    const merged = mergeServerTablesForSalle(initialTables, stored, serviceOverrides);
    setLayout(merged);
  }

  useEffect(() => {
    if (!mounted) return;
    reloadLayout();
  }, [mounted, restaurantId, initialTables]);

  function handleServiceLayoutChange(tables: FloorTable[]) {
    setLayout((current) => ({
      ...current,
      tables,
      hasServiceOverrides: true,
    }));
    saveServiceTableOverrides(restaurantId, tables);
  }

  function handleEndOfService() {
    clearServiceTableOverrides(restaurantId);
    reloadLayout();
  }

  function handleTableActivate(tableId: string) {
    const tables = layout.tables;
    markServiceTableActivated(restaurantId, tableId, tables);
    setLayout((current) => ({
      ...current,
      activatedTableIds: [...new Set([...current.activatedTableIds, tableId])],
      hasServiceOverrides: true,
    }));
  }

  function handleTableClick(table: FloorTable) {
    setSelectedTable(table);
  }

  function handleTileClick(tableId: string) {
    const table = layout.tables.find((item) => item.id === tableId);
    if (table) handleTableClick(table);
  }

  const tileStatusById = new Map(layout.tables.map((table) => [table.id, table.status]));

  const debouncedRefresh = useDebouncedCallback(() => {
    router.refresh();
    reloadLayout();
  }, 2000);

  function handleOrderChanged() {
    debouncedRefresh();
  }

  function handleModalClose() {
    setSelectedTable(null);
    router.refresh();
    reloadLayout();
  }

  if (!mounted) {
    return (
      <div className="min-h-[320px] animate-pulse rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-video" />
    );
  }

  return (
    <div className="space-y-6">
      <InteractiveFloorPlan
        mode="salle"
        initialTables={layout.tables}
        initialFixtures={layout.fixtures}
        hasServiceOverrides={layout.hasServiceOverrides}
        onResetServiceLayout={handleEndOfService}
        onLayoutChange={({ tables }) => handleServiceLayoutChange(tables)}
        onTableClick={handleTableClick}
        activatedTableIds={layout.activatedTableIds}
        onTableActivate={handleTableActivate}
      />

      {selectedTable ? (
        <SalleTableOrderModal
          restaurantId={restaurantId}
          table={selectedTable}
          session={orderSession}
          onClose={handleModalClose}
          onOrderChanged={handleOrderChanged}
        />
      ) : null}

      {tableSummaries.length > 0 ? (
        <div className="space-y-6">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {tableSummaries.map((summary) => {
              const occupied = tileStatusById.get(summary.id) === "occupied";
              return (
                <li key={summary.id}>
                  <button
                    type="button"
                    onClick={() => handleTileClick(summary.id)}
                    className={`group flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md ${
                      occupied
                        ? "border-copper-300 bg-copper-50/60 ring-1 ring-copper-200"
                        : "border-stone-200/70 bg-white shadow-sm hover:border-copper-200"
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        occupied ? "bg-copper-100 text-copper-800" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      <Armchair className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="line-clamp-1 font-semibold text-stone-900" title={summary.label}>
                      {summary.label}
                    </span>
                    {occupied ? (
                      <span className="line-clamp-1 text-xs font-medium text-copper-800">
                        {summary.clientName ?? "Commande en cours"}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-400">Libre</span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        occupied ? "bg-copper-700 text-white" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {occupied ? "Ouverte" : "Libre"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
