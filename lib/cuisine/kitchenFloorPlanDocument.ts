import {
  createDefaultFloorPlanDocument,
  createFloorPlanLevel,
  parseStoredFloorPlanDocument,
  type StoredFloorPlanDocument,
} from "@/lib/salle/floorPlanDocument";

export const DEFAULT_KITCHEN_LEVEL_LABEL = "Cuisine principale";

export type StoredKitchenFloorPlanDocument = StoredFloorPlanDocument;

export function createDefaultKitchenFloorPlanDocument(): StoredKitchenFloorPlanDocument {
  const level = createFloorPlanLevel(DEFAULT_KITCHEN_LEVEL_LABEL, 0, "kitchen-main");
  return { version: 2, activeLevelId: level.id, levels: [level] };
}

export function parseStoredKitchenFloorPlanDocument(raw: unknown): StoredKitchenFloorPlanDocument {
  const parsed = parseStoredFloorPlanDocument(raw);
  if (parsed.levels.length === 1 && parsed.levels[0].id === "main") {
    return createDefaultKitchenFloorPlanDocument();
  }
  return parsed;
}

export {
  addFloorPlanLevel,
  buildPlacedTableCountByLevel,
  getLevelById,
  getTableIdsAssignedToOtherLevels,
  removeFloorPlanLevel,
  renameFloorPlanLevel,
  setActiveLevelId,
  sortLevels,
  updateLevelLayout,
  formatPlacedTableCount,
} from "@/lib/salle/floorPlanDocument";
