"use client";

import { useEffect, useRef } from "react";
import { saveFloorPlanLayoutAction } from "@/app/salle/plan/actions";
import {
  createDefaultFloorPlanDocument,
  parseStoredFloorPlanDocument,
  resolveStoredFloorPlanDocument,
  type StoredFloorPlanDocument,
} from "@/lib/salle/floorPlanDocument";
import {
  loadFloorPlanDocument,
  saveFloorPlanDocument,
  type StoredFloorPlanLayout,
} from "@/lib/salle/floorPlanLayout";
import type { FloorFixture, FloorTable } from "@/components/salle/InteractiveFloorPlan";
import {
  getTableIdsAssignedToOtherLevels,
  getLevelById,
  updateLevelLayout,
} from "@/lib/salle/floorPlanDocument";
import {
  mergeServerTablesForPlanEditor,
  mergeServerTablesForSalle,
} from "@/lib/salle/floorPlanLayout";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";

export function useFloorPlanDocumentPersistence(
  restaurantId: string,
  serverStoredDocument: StoredFloorPlanDocument | null
) {
  const migratedRef = useRef(false);

  const debouncedSaveToServer = useDebouncedCallback((document: StoredFloorPlanDocument) => {
    void saveFloorPlanLayoutAction(restaurantId, document);
  }, 400);

  function persistDocument(document: StoredFloorPlanDocument) {
    const parsed = parseStoredFloorPlanDocument(document);
    saveFloorPlanDocument(restaurantId, parsed);
    debouncedSaveToServer(parsed);
  }

  function resolveDocument(): StoredFloorPlanDocument {
    const local = loadFloorPlanDocument(restaurantId);
    const { document, shouldMigrateLocalToServer } = resolveStoredFloorPlanDocument(
      serverStoredDocument,
      local
    );

    const resolved = document ?? createDefaultFloorPlanDocument();

    if (shouldMigrateLocalToServer && !migratedRef.current) {
      migratedRef.current = true;
      saveFloorPlanDocument(restaurantId, resolved);
      void saveFloorPlanLayoutAction(restaurantId, resolved);
    }

    return parseStoredFloorPlanDocument(resolved);
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

export function mergeTablesForPlanEditorLevel(
  allServerTables: FloorTable[],
  document: StoredFloorPlanDocument,
  levelId: string
): { tables: FloorTable[]; fixtures: FloorFixture[] } {
  const level = getLevelById(document, levelId);
  const otherLevelTableIds = getTableIdsAssignedToOtherLevels(document, levelId);
  const tables = mergeServerTablesForPlanEditor(
    allServerTables,
    level?.layout ?? null,
    otherLevelTableIds
  );
  return { tables, fixtures: level?.layout.fixtures ?? [] };
}

export function getAvailableTablesForLevel(
  allServerTables: FloorTable[],
  document: StoredFloorPlanDocument,
  levelId: string,
  currentOnPlan: FloorTable[]
): FloorTable[] {
  const onPlanIds = new Set(currentOnPlan.map((t) => t.id));
  const otherLevelTableIds = getTableIdsAssignedToOtherLevels(document, levelId);
  return allServerTables.filter(
    (table) => !onPlanIds.has(table.id) && !otherLevelTableIds.has(table.id)
  );
}

export function mergeTablesForSalleLevel(
  allServerTables: FloorTable[],
  document: StoredFloorPlanDocument,
  levelId: string,
  serviceOverrides: ReturnType<typeof import("@/lib/salle/floorPlanLayout").loadServiceTableOverrides>
) {
  const level = getLevelById(document, levelId);
  const otherLevelTableIds = getTableIdsAssignedToOtherLevels(document, levelId);
  return mergeServerTablesForSalle(
    allServerTables,
    level?.layout ?? null,
    levelId,
    serviceOverrides,
    otherLevelTableIds
  );
}

/** Commandes en cours (`status === occupied`) par espace. */
export function buildOpenTableCountByLevel(
  allServerTables: FloorTable[],
  document: StoredFloorPlanDocument,
  serviceOverrides: ReturnType<typeof import("@/lib/salle/floorPlanLayout").loadServiceTableOverrides>
): Record<string, number> {
  return Object.fromEntries(
    document.levels.map((level) => {
      const merged = mergeTablesForSalleLevel(allServerTables, document, level.id, serviceOverrides);
      const openCount = merged.tables.filter((table) => table.status === "occupied").length;
      return [level.id, openCount];
    })
  );
}

export function patchLevelLayoutInDocument(
  document: StoredFloorPlanDocument,
  levelId: string,
  tables: FloorTable[],
  fixtures: FloorFixture[],
  existingLayout: StoredFloorPlanLayout | null
): StoredFloorPlanDocument {
  const layout = buildStoredLayoutFromEditor(tables, fixtures, existingLayout);
  return updateLevelLayout(document, levelId, layout);
}
