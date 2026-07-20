"use client";

import { useEffect, useRef } from "react";
import { saveKitchenFloorPlanLayoutAction } from "@/app/hygiene/cuisine-plan/actions";
import {
  createDefaultKitchenFloorPlanDocument,
  getTableIdsAssignedToOtherLevels,
  getLevelById,
  parseStoredKitchenFloorPlanDocument,
  updateLevelLayout,
  type StoredKitchenFloorPlanDocument,
} from "@/lib/cuisine/kitchenFloorPlanDocument";
import {
  loadKitchenFloorPlanDocument,
  resolveStoredKitchenFloorPlanDocument,
  saveKitchenFloorPlanDocument,
  type StoredFloorPlanLayout,
} from "@/lib/cuisine/kitchenFloorPlanLayout";
import type { FloorFixture, FloorTable } from "@/components/salle/InteractiveFloorPlan";
import { mergeServerTablesForPlanEditor } from "@/lib/salle/floorPlanLayout";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";

export function useKitchenFloorPlanDocumentPersistence(
  restaurantId: string,
  serverStoredDocument: StoredKitchenFloorPlanDocument | null
) {
  const migratedRef = useRef(false);

  const debouncedSaveToServer = useDebouncedCallback((document: StoredKitchenFloorPlanDocument) => {
    void saveKitchenFloorPlanLayoutAction(restaurantId, document);
  }, 400);

  function persistDocument(document: StoredKitchenFloorPlanDocument) {
    const parsed = parseStoredKitchenFloorPlanDocument(document);
    saveKitchenFloorPlanDocument(restaurantId, parsed);
    debouncedSaveToServer(parsed);
  }

  function resolveDocument(): StoredKitchenFloorPlanDocument {
    const local = loadKitchenFloorPlanDocument(restaurantId);
    const { document, shouldMigrateLocalToServer } = resolveStoredKitchenFloorPlanDocument(
      serverStoredDocument,
      local
    );

    const resolved = document ?? createDefaultKitchenFloorPlanDocument();

    if (shouldMigrateLocalToServer && !migratedRef.current) {
      migratedRef.current = true;
      saveKitchenFloorPlanDocument(restaurantId, resolved);
      void saveKitchenFloorPlanLayoutAction(restaurantId, resolved);
    }

    return parseStoredKitchenFloorPlanDocument(resolved);
  }

  useEffect(() => {
    migratedRef.current = false;
  }, [restaurantId, serverStoredDocument]);

  return { persistDocument, resolveDocument };
}

export function buildStoredLayoutFromEditor(
  tables: FloorTable[],
  fixtures: FloorFixture[],
  existing: StoredFloorPlanLayout | null
): StoredFloorPlanLayout {
  const onPlanIds = new Set(tables.map((table) => table.id));
  const removedFromPlan = (existing?.removedFromPlan ?? []).filter((id) => !onPlanIds.has(id));

  return {
    baseTables: Object.fromEntries(
      tables.map((table) => [
        table.id,
        {
          x: table.x,
          y: table.y,
          width: table.width,
          height: table.height,
          rotation: table.rotation,
          capacity: table.capacity,
        },
      ])
    ),
    fixtures,
    removedFromPlan,
  };
}

export function mergeEquipmentForPlanEditorLevel(
  allEquipment: FloorTable[],
  document: StoredKitchenFloorPlanDocument,
  levelId: string
): { tables: FloorTable[]; fixtures: FloorFixture[] } {
  const level = getLevelById(document, levelId);
  const otherLevelIds = getTableIdsAssignedToOtherLevels(document, levelId);
  const tables = mergeServerTablesForPlanEditor(allEquipment, level?.layout ?? null, otherLevelIds);
  return { tables, fixtures: level?.layout.fixtures ?? [] };
}

export function getAvailableEquipmentForLevel(
  allEquipment: FloorTable[],
  document: StoredKitchenFloorPlanDocument,
  levelId: string,
  currentOnPlan: FloorTable[]
): FloorTable[] {
  const onPlanIds = new Set(currentOnPlan.map((t) => t.id));
  const otherLevelIds = getTableIdsAssignedToOtherLevels(document, levelId);
  return allEquipment.filter((item) => !onPlanIds.has(item.id) && !otherLevelIds.has(item.id));
}

export function patchLevelLayoutInDocument(
  document: StoredKitchenFloorPlanDocument,
  levelId: string,
  tables: FloorTable[],
  fixtures: FloorFixture[],
  existingLayout: StoredFloorPlanLayout | null
): StoredKitchenFloorPlanDocument {
  const layout = buildStoredLayoutFromEditor(tables, fixtures, existingLayout);
  return updateLevelLayout(document, levelId, layout);
}

export function mergeEquipmentForTemperatureLevel(
  allEquipment: FloorTable[],
  document: StoredKitchenFloorPlanDocument,
  levelId: string
): { tables: FloorTable[]; fixtures: FloorFixture[] } {
  return mergeEquipmentForPlanEditorLevel(allEquipment, document, levelId);
}

/** Relevés enregistrés aujourd'hui par espace (pour badge onglet). */
export function buildRecordedCountByLevel(
  document: StoredKitchenFloorPlanDocument,
  recordedElementIds: Set<string>
): Record<string, number> {
  return Object.fromEntries(
    document.levels.map((level) => {
      const removed = new Set(level.layout.removedFromPlan ?? []);
      const count = Object.keys(level.layout.baseTables).filter(
        (id) => !removed.has(id) && recordedElementIds.has(id)
      ).length;
      return [level.id, count];
    })
  );
}

export function formatRecordedEquipmentCount(recorded: number, total: number): string {
  if (total === 0) return "0 équip.";
  return `${recorded}/${total}`;
}
