"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  InteractiveFloorPlan,
  type FloorFixture,
  type FloorTable,
} from "@/components/salle/InteractiveFloorPlan";
import {
  loadFloorPlanLayout,
  mergeServerTablesForPlanEditor,
  removeTableFromBasePlan,
  saveBaseTableLayouts,
  saveFloorPlanFixtures,
  withDefaultPlanPlacement,
} from "@/lib/salle/floorPlanLayout";
import { addDiningTable } from "../tables/actions";

type FloorPlanEditorClientProps = {
  restaurantId: string;
  initialTables: FloorTable[];
};

function nextAvailableTableLabel(tables: FloorTable[]): string {
  const existingLabels = new Set(tables.map((table) => table.label.trim().toLowerCase()));
  let index = tables.length + 1;

  while (existingLabels.has(`t.${index}`.toLowerCase())) {
    index += 1;
  }

  return `T.${index}`;
}

export function FloorPlanEditorClient({ restaurantId, initialTables }: FloorPlanEditorClientProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [layout, setLayout] = useState<{
    tables: FloorTable[];
    fixtures: FloorFixture[];
  }>({
    tables: initialTables,
    fixtures: [],
  });

  useEffect(() => {
    setMounted(true);
    const stored = loadFloorPlanLayout(restaurantId);
    const tables = mergeServerTablesForPlanEditor(initialTables, stored);
    setLayout({
      tables,
      fixtures: stored?.fixtures ?? [],
    });
  }, [restaurantId, initialTables]);

  const availableTablesToPlace = useMemo(
    () => initialTables.filter((table) => !layout.tables.some((onPlan) => onPlan.id === table.id)),
    [initialTables, layout.tables]
  );

  async function createDiningTable(draftTable: FloorTable): Promise<FloorTable> {
    const label = nextAvailableTableLabel([...layout.tables, ...initialTables]);
    const result = await addDiningTable({ restaurantId, label });

    if (!result.ok || !result.data?.id) {
      throw new Error(result.ok ? "Impossible de créer la table." : result.error);
    }

    const createdTable = {
      ...draftTable,
      id: result.data.id,
      label,
      rotation: draftTable.rotation ?? 0,
    };

    router.refresh();
    return createdTable;
  }

  if (!mounted) {
    return (
      <div className="min-h-[320px] animate-pulse rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-video" />
    );
  }

  return (
    <InteractiveFloorPlan
      mode="plan-editor"
      initialTables={layout.tables}
      initialFixtures={layout.fixtures}
      availableTablesToPlace={availableTablesToPlace}
      onPlaceExistingTable={(table) => {
        setLayout((current) => {
          const nextTables = [...current.tables, withDefaultPlanPlacement(table)];
          saveBaseTableLayouts(restaurantId, nextTables);
          return { ...current, tables: nextTables };
        });
      }}
      onLayoutChange={({ tables, fixtures }) => {
        setLayout({ tables, fixtures });
        saveBaseTableLayouts(restaurantId, tables);
        saveFloorPlanFixtures(restaurantId, fixtures);
      }}
      onTableCreate={createDiningTable}
      onTableDelete={(tableId, remainingTables) => {
        setLayout((current) => ({ ...current, tables: remainingTables }));
        removeTableFromBasePlan(restaurantId, tableId, remainingTables);
      }}
    />
  );
}
