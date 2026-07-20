import type { StoredFloorPlanLayout } from "@/lib/salle/floorPlanLayout";
import { isStoredFloorPlanEmpty, parseStoredFloorPlanLayout } from "@/lib/salle/floorPlanLayout";

export const DEFAULT_LEVEL_LABEL = "Salle principale";

export type FloorPlanLevel = {
  id: string;
  label: string;
  sortOrder: number;
  layout: StoredFloorPlanLayout;
};

export type StoredFloorPlanDocument = {
  version: 2;
  /** Dernier onglet actif (éditeur + salle). */
  activeLevelId: string;
  levels: FloorPlanLevel[];
};

export function createEmptyLevelLayout(): StoredFloorPlanLayout {
  return { baseTables: {}, fixtures: [], removedFromPlan: [] };
}

export function createFloorPlanLevel(label: string, sortOrder: number, id?: string): FloorPlanLevel {
  return {
    id: id ?? crypto.randomUUID(),
    label: label.trim() || DEFAULT_LEVEL_LABEL,
    sortOrder,
    layout: createEmptyLevelLayout(),
  };
}

export function createDefaultFloorPlanDocument(): StoredFloorPlanDocument {
  const level = createFloorPlanLevel(DEFAULT_LEVEL_LABEL, 0, "main");
  return { version: 2, activeLevelId: level.id, levels: [level] };
}

export function sortLevels(levels: FloorPlanLevel[]): FloorPlanLevel[] {
  return [...levels].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "fr"));
}

export function getActiveLevel(document: StoredFloorPlanDocument): FloorPlanLevel | null {
  const sorted = sortLevels(document.levels);
  return sorted.find((level) => level.id === document.activeLevelId) ?? sorted[0] ?? null;
}

export function parseStoredFloorPlanDocument(raw: unknown): StoredFloorPlanDocument {
  if (!raw || typeof raw !== "object") {
    return createDefaultFloorPlanDocument();
  }

  const obj = raw as Record<string, unknown>;

  if (obj.version === 2 && Array.isArray(obj.levels)) {
    const levels = obj.levels
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as Record<string, unknown>;
        const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `level-${index}`;
        const label =
          typeof row.label === "string" && row.label.trim()
            ? row.label.trim()
            : `Espace ${index + 1}`;
        const sortOrder = typeof row.sortOrder === "number" ? row.sortOrder : index;
        return {
          id,
          label,
          sortOrder,
          layout: parseStoredFloorPlanLayout(row.layout),
        } satisfies FloorPlanLevel;
      })
      .filter((level): level is FloorPlanLevel => level != null);

    if (levels.length === 0) {
      return createDefaultFloorPlanDocument();
    }

    const sorted = sortLevels(levels);
    const activeLevelId =
      typeof obj.activeLevelId === "string" && sorted.some((l) => l.id === obj.activeLevelId)
        ? obj.activeLevelId
        : sorted[0].id;

    return { version: 2, activeLevelId, levels: sorted };
  }

  const legacyLayout = parseStoredFloorPlanLayout(raw);
  const level = createFloorPlanLevel(DEFAULT_LEVEL_LABEL, 0, "main");
  level.layout = legacyLayout;
  return { version: 2, activeLevelId: level.id, levels: [level] };
}

export function isStoredFloorPlanDocumentEmpty(document: StoredFloorPlanDocument | null | undefined): boolean {
  if (!document?.levels.length) return true;
  return document.levels.every((level) => isStoredFloorPlanEmpty(level.layout));
}

export function resolveStoredFloorPlanDocument(
  serverDocument: StoredFloorPlanDocument | null | undefined,
  localDocument: StoredFloorPlanDocument | null
): { document: StoredFloorPlanDocument | null; shouldMigrateLocalToServer: boolean } {
  const serverEmpty = isStoredFloorPlanDocumentEmpty(serverDocument);
  const localEmpty = isStoredFloorPlanDocumentEmpty(localDocument);

  if (!serverEmpty && serverDocument) {
    return { document: serverDocument, shouldMigrateLocalToServer: false };
  }
  if (!localEmpty && localDocument) {
    return { document: localDocument, shouldMigrateLocalToServer: true };
  }
  return { document: null, shouldMigrateLocalToServer: false };
}

export function updateLevelLayout(
  document: StoredFloorPlanDocument,
  levelId: string,
  layout: StoredFloorPlanLayout
): StoredFloorPlanDocument {
  return {
    ...document,
    levels: document.levels.map((level) =>
      level.id === levelId ? { ...level, layout: parseStoredFloorPlanLayout(layout) } : level
    ),
  };
}

export function setActiveLevelId(
  document: StoredFloorPlanDocument,
  levelId: string
): StoredFloorPlanDocument {
  if (!document.levels.some((level) => level.id === levelId)) return document;
  return { ...document, activeLevelId: levelId };
}

export function addFloorPlanLevel(
  document: StoredFloorPlanDocument,
  label: string
): StoredFloorPlanDocument {
  const sortOrder =
    document.levels.reduce((max, level) => Math.max(max, level.sortOrder), -1) + 1;
  const level = createFloorPlanLevel(label, sortOrder);
  return {
    version: 2,
    activeLevelId: level.id,
    levels: sortLevels([...document.levels, level]),
  };
}

export function renameFloorPlanLevel(
  document: StoredFloorPlanDocument,
  levelId: string,
  label: string
): StoredFloorPlanDocument {
  const trimmed = label.trim();
  if (!trimmed) return document;
  return {
    ...document,
    levels: document.levels.map((level) =>
      level.id === levelId ? { ...level, label: trimmed } : level
    ),
  };
}

export function removeFloorPlanLevel(
  document: StoredFloorPlanDocument,
  levelId: string
): StoredFloorPlanDocument | null {
  if (document.levels.length <= 1) return null;
  const levels = document.levels.filter((level) => level.id !== levelId);
  const sorted = sortLevels(levels);
  const activeLevelId = sorted.some((l) => l.id === document.activeLevelId)
    ? document.activeLevelId
    : sorted[0].id;
  return { version: 2, activeLevelId, levels: sorted };
}

/** Tables déjà placées sur un autre espace (étage, terrasse…). */
export function getTableIdsAssignedToOtherLevels(
  document: StoredFloorPlanDocument,
  levelId: string
): Set<string> {
  const ids = new Set<string>();
  for (const level of document.levels) {
    if (level.id === levelId) continue;
    for (const tableId of Object.keys(level.layout.baseTables)) {
      ids.add(tableId);
    }
  }
  return ids;
}

export function getLevelById(
  document: StoredFloorPlanDocument,
  levelId: string
): FloorPlanLevel | null {
  return document.levels.find((level) => level.id === levelId) ?? null;
}

/** Nombre de tables placées sur un espace (hors retirées volontairement). */
export function countTablesOnLevel(level: FloorPlanLevel, activeTableIds?: Set<string>): number {
  const removed = new Set(level.layout.removedFromPlan ?? []);
  return Object.keys(level.layout.baseTables).filter((id) => {
    if (removed.has(id)) return false;
    if (activeTableIds && !activeTableIds.has(id)) return false;
    return true;
  }).length;
}

export function buildPlacedTableCountByLevel(
  document: StoredFloorPlanDocument,
  activeTableIds: Set<string>,
  activeLevelId?: string,
  activeLevelLiveCount?: number
): Record<string, number> {
  return Object.fromEntries(
    document.levels.map((level) => [
      level.id,
      level.id === activeLevelId && activeLevelLiveCount != null
        ? activeLevelLiveCount
        : countTablesOnLevel(level, activeTableIds),
    ])
  );
}

/** @deprecated Utiliser buildPlacedTableCountByLevel. */
export function buildTableCountByLevel(
  document: StoredFloorPlanDocument,
  activeTableIds: Set<string>,
  activeLevelId?: string,
  activeLevelLiveCount?: number
): Record<string, number> {
  return buildPlacedTableCountByLevel(document, activeTableIds, activeLevelId, activeLevelLiveCount);
}

export function formatPlacedTableCount(count: number): string {
  return count === 1 ? "1 table" : `${count} tables`;
}

export function formatOpenTableCount(count: number): string {
  return count === 1 ? "1 ouverte" : `${count} ouvertes`;
}
