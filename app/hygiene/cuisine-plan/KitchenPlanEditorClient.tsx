"use client";

import { useEffect, useMemo, useState } from "react";
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
  parseStoredKitchenFloorPlanDocument,
  removeFloorPlanLevel,
  renameFloorPlanLevel,
  setActiveLevelId,
  sortLevels,
  type StoredKitchenFloorPlanDocument,
} from "@/lib/cuisine/kitchenFloorPlanDocument";
import { withDefaultPlanPlacement } from "@/lib/cuisine/kitchenFloorPlanLayout";
import {
  buildStoredLayoutFromEditor,
  getAvailableEquipmentForLevel,
  mergeEquipmentForPlanEditorLevel,
  patchLevelLayoutInDocument,
  useKitchenFloorPlanDocumentPersistence,
} from "@/lib/cuisine/useKitchenFloorPlanPersistence";

type KitchenPlanEditorClientProps = {
  restaurantId: string;
  initialEquipment: FloorTable[];
  serverStoredDocument: StoredKitchenFloorPlanDocument | null;
};

function updateLevelInDocument(
  doc: StoredKitchenFloorPlanDocument,
  levelId: string,
  levelLayout: ReturnType<typeof buildStoredLayoutFromEditor>
): StoredKitchenFloorPlanDocument {
  return {
    ...doc,
    levels: doc.levels.map((level) =>
      level.id === levelId ? { ...level, layout: levelLayout } : level
    ),
  };
}

export function KitchenPlanEditorClient({
  restaurantId,
  initialEquipment,
  serverStoredDocument,
}: KitchenPlanEditorClientProps) {
  const [mounted, setMounted] = useState(false);
  const { persistDocument, resolveDocument } = useKitchenFloorPlanDocumentPersistence(
    restaurantId,
    serverStoredDocument
  );
  const [document, setDocument] = useState<StoredKitchenFloorPlanDocument>(() =>
    parseStoredKitchenFloorPlanDocument(serverStoredDocument)
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
    setLayout(mergeEquipmentForPlanEditorLevel(initialEquipment, resolved, resolved.activeLevelId));
  }, [restaurantId, initialEquipment, serverStoredDocument]);

  const availableEquipmentToPlace = useMemo(
    () =>
      getAvailableEquipmentForLevel(initialEquipment, document, activeLevelId, layout.tables),
    [initialEquipment, document, activeLevelId, layout.tables]
  );

  const equipmentIds = useMemo(() => new Set(initialEquipment.map((item) => item.id)), [initialEquipment]);

  const equipmentCountByLevel = useMemo(
    () =>
      buildPlacedTableCountByLevel(document, equipmentIds, activeLevelId, layout.tables.length),
    [document, equipmentIds, activeLevelId, layout.tables.length]
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
    setLayout(mergeEquipmentForPlanEditorLevel(initialEquipment, nextDoc, levelId));
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
    setLayout(mergeEquipmentForPlanEditorLevel(initialEquipment, nextDoc, nextDoc.activeLevelId));
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
    setLayout(mergeEquipmentForPlanEditorLevel(initialEquipment, removed, removed.activeLevelId));
  }

  if (!mounted) {
    return (
      <div className="min-h-[320px] animate-pulse rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-video" />
    );
  }

  return (
    <div className="space-y-4">
      <FloorPlanLevelTabs
        activeLevelId={activeLevelId}
        editable
        levels={levels}
        countVariant="placed"
        tableCountByLevel={equipmentCountByLevel}
        onAdd={handleAddLevel}
        onRemove={handleRemoveLevel}
        onRename={handleRenameLevel}
        onSelect={switchLevel}
      />

      <InteractiveFloorPlan
        mode="plan-editor"
        itemKind="equipment"
        hideCapacity
        initialTables={layout.tables}
        initialFixtures={layout.fixtures}
        availableTablesToPlace={availableEquipmentToPlace}
        onPlaceExistingTable={(item) => {
          commitLayout([...layout.tables, withDefaultPlanPlacement(item)], layout.fixtures);
        }}
        onLayoutChange={({ tables, fixtures }) => {
          commitLayout(tables, fixtures);
        }}
        onTableDelete={(itemId, remaining) => {
          const withRemoved = buildStoredLayoutFromEditor(remaining, layout.fixtures, {
            ...(activeLevel?.layout ?? { baseTables: {}, fixtures: [], removedFromPlan: [] }),
            removedFromPlan: [
              ...new Set([...(activeLevel?.layout.removedFromPlan ?? []), itemId]),
            ],
          });
          const nextDoc = updateLevelInDocument(document, activeLevelId, withRemoved);
          setDocument(nextDoc);
          setLayout({ tables: remaining, fixtures: layout.fixtures });
          persistDocument(nextDoc);
        }}
        planCopy={{
          title: "Configurer le plan cuisine",
          description:
            "Placez vos chambres froides, frigos et congélateurs sur le plan. Ce dispositif sert aux relevés d'ouverture et de fermeture.",
          canvasLabel: "Plan cuisine",
          placeItemLabel: "Placer sur le plan",
        }}
      />
    </div>
  );
}
