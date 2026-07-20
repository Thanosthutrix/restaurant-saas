"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Armchair } from "lucide-react";
import {
  InteractiveFloorPlan,
  type FloorFixture,
  type FloorTable,
} from "@/components/salle/InteractiveFloorPlan";
import { FloorPlanLevelTabs } from "@/components/salle/FloorPlanLevelTabs";
import type { DiningOrderSessionBundle } from "@/lib/dining/diningOrderViewData";
import {
  parseStoredFloorPlanDocument,
  setActiveLevelId,
  sortLevels,
  type StoredFloorPlanDocument,
} from "@/lib/salle/floorPlanDocument";
import {
  clearServiceTableOverrides,
  loadServiceTableOverrides,
  markServiceTableActivated,
  saveServiceTableOverrides,
} from "@/lib/salle/floorPlanLayout";
import {
  buildOpenTableCountByLevel,
  mergeTablesForSalleLevel,
  useFloorPlanDocumentPersistence,
} from "@/lib/salle/useFloorPlanPersistence";
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
  serverStoredDocument: StoredFloorPlanDocument | null;
  orderSession: DiningOrderSessionBundle;
  tableSummaries?: TableTileSummary[];
};

export function SalleFloorPlanClient({
  restaurantId,
  initialTables,
  serverStoredDocument,
  orderSession,
  tableSummaries = [],
}: SalleFloorPlanClientProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null);
  const { persistDocument, resolveDocument } = useFloorPlanDocumentPersistence(
    restaurantId,
    serverStoredDocument
  );
  const [document, setDocument] = useState<StoredFloorPlanDocument>(() =>
    parseStoredFloorPlanDocument(serverStoredDocument)
  );
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

  const activeLevelId = document.activeLevelId;
  const levels = sortLevels(document.levels);

  useEffect(() => {
    setMounted(true);
  }, []);

  function reloadLayout(doc: StoredFloorPlanDocument, levelId: string) {
    const serviceOverrides = loadServiceTableOverrides(restaurantId);
    const merged = mergeTablesForSalleLevel(initialTables, doc, levelId, serviceOverrides);
    setLayout(merged);
  }

  useEffect(() => {
    if (!mounted) return;
    const resolved = resolveDocument();
    setDocument(resolved);
    reloadLayout(resolved, resolved.activeLevelId);
  }, [mounted, restaurantId, initialTables, serverStoredDocument]);

  function switchLevel(levelId: string) {
    if (levelId === activeLevelId) return;
    const nextDoc = setActiveLevelId(document, levelId);
    setDocument(nextDoc);
    persistDocument(nextDoc);
    reloadLayout(nextDoc, levelId);
  }

  function handleServiceLayoutChange(tables: FloorTable[]) {
    setLayout((current) => ({
      ...current,
      tables,
      hasServiceOverrides: true,
    }));
    saveServiceTableOverrides(restaurantId, activeLevelId, tables);
  }

  function handleEndOfService() {
    clearServiceTableOverrides(restaurantId);
    reloadLayout(document, activeLevelId);
  }

  function handleTableActivate(tableId: string) {
    markServiceTableActivated(restaurantId, activeLevelId, tableId, layout.tables);
    setLayout((current) => ({
      ...current,
      activatedTableIds: [...new Set([...current.activatedTableIds, tableId])],
      hasServiceOverrides: true,
    }));
  }

  const visibleTableIds = useMemo(() => new Set(layout.tables.map((t) => t.id)), [layout.tables]);

  const openCountByLevel = useMemo(() => {
    if (!mounted) return {};
    const serviceOverrides = loadServiceTableOverrides(restaurantId);
    return buildOpenTableCountByLevel(initialTables, document, serviceOverrides);
  }, [mounted, initialTables, document, restaurantId, layout.tables]);

  const visibleSummaries = useMemo(
    () => tableSummaries.filter((summary) => visibleTableIds.has(summary.id)),
    [tableSummaries, visibleTableIds]
  );

  const debouncedRefresh = useDebouncedCallback(() => {
    router.refresh();
    reloadLayout(document, activeLevelId);
  }, 2000);

  if (!mounted) {
    return (
      <div className="min-h-[320px] animate-pulse rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-video" />
    );
  }

  return (
    <div className="space-y-6">
      {levels.length > 0 ? (
        <FloorPlanLevelTabs
          activeLevelId={activeLevelId}
          countVariant="open"
          levels={levels}
          tableCountByLevel={openCountByLevel}
          onSelect={switchLevel}
        />
      ) : null}

      <InteractiveFloorPlan
        mode="salle"
        initialTables={layout.tables}
        initialFixtures={layout.fixtures}
        hasServiceOverrides={layout.hasServiceOverrides}
        onResetServiceLayout={handleEndOfService}
        onLayoutChange={({ tables }) => handleServiceLayoutChange(tables)}
        onTableClick={setSelectedTable}
        activatedTableIds={layout.activatedTableIds}
        onTableActivate={handleTableActivate}
      />

      {selectedTable ? (
        <SalleTableOrderModal
          restaurantId={restaurantId}
          table={selectedTable}
          session={orderSession}
          onClose={() => {
            setSelectedTable(null);
            router.refresh();
            reloadLayout(document, activeLevelId);
          }}
          onOrderChanged={debouncedRefresh}
        />
      ) : null}

      {visibleSummaries.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleSummaries.map((summary) => {
            const occupied = layout.tables.find((t) => t.id === summary.id)?.status === "occupied";
            return (
              <li key={summary.id}>
                <button
                  type="button"
                  onClick={() => {
                    const table = layout.tables.find((item) => item.id === summary.id);
                    if (table) setSelectedTable(table);
                  }}
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
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
