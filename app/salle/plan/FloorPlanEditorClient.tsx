"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  InteractiveFloorPlan,
  type FloorFixture,
  type FloorTable,
} from "@/components/salle/InteractiveFloorPlan";
import { FloorPlanLevelTabs } from "@/components/salle/FloorPlanLevelTabs";
import {
  addFloorPlanLevel,
  buildPlacedTableCountByLevel,
  getLevelById,
  parseStoredFloorPlanDocument,
  removeFloorPlanLevel,
  renameFloorPlanLevel,
  setActiveLevelId,
  setSallePlanVisible,
  isSallePlanVisible,
  sortLevels,
  type StoredFloorPlanDocument,
} from "@/lib/salle/floorPlanDocument";
import { withDefaultPlanPlacement } from "@/lib/salle/floorPlanLayout";
import {
  buildStoredLayoutFromEditor,
  getAvailableTablesForLevel,
  mergeTablesForPlanEditorLevel,
  patchLevelLayoutInDocument,
  useFloorPlanDocumentPersistence,
} from "@/lib/salle/useFloorPlanPersistence";
import { addDiningTable } from "../tables/actions";

type FloorPlanEditorClientProps = {
  restaurantId: string;
  initialTables: FloorTable[];
  serverStoredDocument: StoredFloorPlanDocument | null;
};

function nextAvailableTableLabel(tables: FloorTable[]): string {
  const existingLabels = new Set(tables.map((table) => table.label.trim().toLowerCase()));
  let index = tables.length + 1;

  while (existingLabels.has(`t.${index}`.toLowerCase())) {
    index += 1;
  }

  return `T.${index}`;
}

function updateLevelInDocument(
  doc: StoredFloorPlanDocument,
  levelId: string,
  levelLayout: ReturnType<typeof buildStoredLayoutFromEditor>
): StoredFloorPlanDocument {
  return {
    ...doc,
    levels: doc.levels.map((level) =>
      level.id === levelId ? { ...level, layout: levelLayout } : level
    ),
  };
}

export function FloorPlanEditorClient({
  restaurantId,
  initialTables,
  serverStoredDocument,
}: FloorPlanEditorClientProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
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
  }>({ tables: [], fixtures: [] });

  const activeLevelId = document.activeLevelId;
  const activeLevel = getLevelById(document, activeLevelId);
  const levels = sortLevels(document.levels);

  useEffect(() => {
    setMounted(true);
    const resolved = resolveDocument();
    setDocument(resolved);
    const merged = mergeTablesForPlanEditorLevel(initialTables, resolved, resolved.activeLevelId);
    setLayout(merged);
  }, [restaurantId, initialTables, serverStoredDocument]);

  const availableTablesToPlace = useMemo(
    () => getAvailableTablesForLevel(initialTables, document, activeLevelId, layout.tables),
    [initialTables, document, activeLevelId, layout.tables]
  );

  const activeTableIds = useMemo(() => new Set(initialTables.map((table) => table.id)), [initialTables]);

  const tableCountByLevel = useMemo(
    () =>
      buildPlacedTableCountByLevel(document, activeTableIds, activeLevelId, layout.tables.length),
    [document, activeTableIds, activeLevelId, layout.tables.length]
  );

  function switchLevel(levelId: string) {
    if (levelId === activeLevelId) return;
    const currentLayout = buildStoredLayoutFromEditor(
      layout.tables,
      layout.fixtures,
      activeLevel?.layout ?? null
    );
    let nextDoc = updateLevelInDocument(document, activeLevelId, currentLayout);
    nextDoc = setActiveLevelId(nextDoc, levelId);
    setDocument(nextDoc);
    persistDocument(nextDoc);
    setLayout(mergeTablesForPlanEditorLevel(initialTables, nextDoc, levelId));
  }

  function commitLayout(tables: FloorTable[], fixtures: FloorFixture[]) {
    setLayout({ tables, fixtures });
    const nextDoc = patchLevelLayoutInDocument(
      document,
      activeLevelId,
      tables,
      fixtures,
      activeLevel?.layout ?? null
    );
    setDocument(nextDoc);
    persistDocument(nextDoc);
  }

  function handleAddLevel(label: string) {
    const currentLayout = buildStoredLayoutFromEditor(
      layout.tables,
      layout.fixtures,
      activeLevel?.layout ?? null
    );
    let nextDoc = updateLevelInDocument(document, activeLevelId, currentLayout);
    nextDoc = addFloorPlanLevel(nextDoc, label);
    setDocument(nextDoc);
    persistDocument(nextDoc);
    setLayout(mergeTablesForPlanEditorLevel(initialTables, nextDoc, nextDoc.activeLevelId));
  }

  function handleRenameLevel(levelId: string, label: string) {
    const nextDoc = renameFloorPlanLevel(document, levelId, label);
    setDocument(nextDoc);
    persistDocument(nextDoc);
  }

  function handleRemoveLevel(levelId: string) {
    const currentLayout = buildStoredLayoutFromEditor(
      layout.tables,
      layout.fixtures,
      activeLevel?.layout ?? null
    );
    let nextDoc = updateLevelInDocument(document, activeLevelId, currentLayout);
    const removed = removeFloorPlanLevel(nextDoc, levelId);
    if (!removed) return;
    setDocument(removed);
    persistDocument(removed);
    setLayout(mergeTablesForPlanEditorLevel(initialTables, removed, removed.activeLevelId));
  }

  async function createDiningTable(draftTable: FloorTable): Promise<FloorTable> {
    const label = nextAvailableTableLabel([...layout.tables, ...initialTables]);
    const result = await addDiningTable({ restaurantId, label });

    if (!result.ok || !result.data?.id) {
      throw new Error(result.ok ? "Impossible de créer la table." : result.error);
    }

    router.refresh();
    return {
      ...draftTable,
      id: result.data.id,
      label,
      rotation: draftTable.rotation ?? 0,
    };
  }

  if (!mounted) {
    return (
      <div className="min-h-[320px] animate-pulse rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-video" />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-stone-900">Plan visuel en salle</h2>
            <p className="mt-1 text-sm text-stone-500">
              Affiche le plan interactif sur la page Salle. Désactivez pour n&apos;utiliser que la grille
              de tables (commandes identiques).
            </p>
          </div>
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              className="size-4 rounded border-stone-300 text-copper-600 focus:ring-copper-500"
              checked={isSallePlanVisible(document)}
              onChange={(event) => {
                const nextDoc = setSallePlanVisible(document, event.target.checked);
                setDocument(nextDoc);
                persistDocument(nextDoc);
              }}
            />
            Afficher en service
          </label>
        </div>
      </section>

      <FloorPlanLevelTabs
        activeLevelId={activeLevelId}
        editable
        levels={levels}
        countVariant="placed"
        tableCountByLevel={tableCountByLevel}
        onAdd={handleAddLevel}
        onRemove={handleRemoveLevel}
        onRename={handleRenameLevel}
        onSelect={switchLevel}
      />

      <InteractiveFloorPlan
        mode="plan-editor"
        initialTables={layout.tables}
        initialFixtures={layout.fixtures}
        availableTablesToPlace={availableTablesToPlace}
        onPlaceExistingTable={(table) => {
          commitLayout([...layout.tables, withDefaultPlanPlacement(table)], layout.fixtures);
        }}
        onLayoutChange={({ tables, fixtures }) => {
          commitLayout(tables, fixtures);
        }}
        onTableCreate={createDiningTable}
        onTableDelete={(tableId, remainingTables) => {
          const withRemoved = buildStoredLayoutFromEditor(remainingTables, layout.fixtures, {
            ...(activeLevel?.layout ?? { baseTables: {}, fixtures: [], removedFromPlan: [] }),
            removedFromPlan: [
              ...new Set([...(activeLevel?.layout.removedFromPlan ?? []), tableId]),
            ],
          });
          const nextDoc = updateLevelInDocument(document, activeLevelId, withRemoved);
          setDocument(nextDoc);
          setLayout({ tables: remainingTables, fixtures: layout.fixtures });
          persistDocument(nextDoc);
        }}
      />
    </div>
  );
}
