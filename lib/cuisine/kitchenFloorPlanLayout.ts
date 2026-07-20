import {
  createDefaultKitchenFloorPlanDocument,
  parseStoredKitchenFloorPlanDocument,
  type StoredKitchenFloorPlanDocument,
} from "@/lib/cuisine/kitchenFloorPlanDocument";
import {
  isStoredFloorPlanEmpty,
  parseStoredFloorPlanLayout,
  resolveStoredFloorPlanLayout,
  type StoredFloorPlanLayout,
} from "@/lib/salle/floorPlanLayout";

export type { StoredFloorPlanLayout } from "@/lib/salle/floorPlanLayout";

const STORAGE_PREFIX = "ubion-kitchen-floor-plan:";

function storageKey(restaurantId: string) {
  return `${STORAGE_PREFIX}${restaurantId}`;
}

export function loadKitchenFloorPlanDocument(restaurantId: string): StoredKitchenFloorPlanDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    return parseStoredKitchenFloorPlanDocument(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveKitchenFloorPlanDocument(restaurantId: string, document: StoredKitchenFloorPlanDocument) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    storageKey(restaurantId),
    JSON.stringify(parseStoredKitchenFloorPlanDocument(document))
  );
}

export function isStoredKitchenFloorPlanDocumentEmpty(
  document: StoredKitchenFloorPlanDocument | null | undefined
): boolean {
  if (!document?.levels.length) return true;
  return document.levels.every((level) => isStoredFloorPlanEmpty(level.layout));
}

export function resolveStoredKitchenFloorPlanDocument(
  serverDocument: StoredKitchenFloorPlanDocument | null | undefined,
  localDocument: StoredKitchenFloorPlanDocument | null
): { document: StoredKitchenFloorPlanDocument | null; shouldMigrateLocalToServer: boolean } {
  const serverEmpty = isStoredKitchenFloorPlanDocumentEmpty(serverDocument);
  const localEmpty = isStoredKitchenFloorPlanDocumentEmpty(localDocument);

  if (!serverEmpty && serverDocument) {
    return { document: serverDocument, shouldMigrateLocalToServer: false };
  }
  if (!localEmpty && localDocument) {
    return { document: localDocument, shouldMigrateLocalToServer: true };
  }
  return { document: null, shouldMigrateLocalToServer: false };
}

export { mergeServerTablesForPlanEditor, withDefaultPlanPlacement } from "@/lib/salle/floorPlanLayout";

export function resolveStoredKitchenFloorPlanLayout(
  serverLayout: StoredFloorPlanLayout | null | undefined,
  localLayout: StoredFloorPlanLayout | null
) {
  return resolveStoredFloorPlanLayout(serverLayout, localLayout);
}

export function createEmptyKitchenDocument(): StoredKitchenFloorPlanDocument {
  return createDefaultKitchenFloorPlanDocument();
}

export { parseStoredFloorPlanLayout };
