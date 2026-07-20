import type { FloorFixture, FloorTable } from "@/components/salle/InteractiveFloorPlan";
import {
  createDefaultFloorPlanDocument,
  parseStoredFloorPlanDocument,
  type StoredFloorPlanDocument,
} from "@/lib/salle/floorPlanDocument";

export type { StoredFloorPlanDocument } from "@/lib/salle/floorPlanDocument";

export type StoredTableLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: FloorTable["rotation"];
  capacity: number;
};

export type StoredFloorPlanLayout = {
  /** Positions par défaut des tables (plan de base). */
  baseTables: Record<string, StoredTableLayout>;
  fixtures: FloorFixture[];
  /** Tables volontairement exclues du plan de base. */
  removedFromPlan?: string[];
};

type ServiceLevelOverrides = {
  tables: Record<string, StoredTableLayout>;
  activatedTableIds?: string[];
};

type ServiceTableOverrides = {
  serviceDate: string;
  levels: Record<string, ServiceLevelOverrides>;
};

const STORAGE_PREFIX = "ubion-floor-plan:";
const SERVICE_OVERRIDE_PREFIX = "ubion-floor-plan-service:";

function storageKey(restaurantId: string) {
  return `${STORAGE_PREFIX}${restaurantId}`;
}

function serviceOverrideKey(restaurantId: string) {
  return `${SERVICE_OVERRIDE_PREFIX}${restaurantId}`;
}

export function getServiceDateParis(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function normalizeRotatedLayoutItem<
  T extends { x: number; y: number; width: number; height: number; rotation: 0 | 90 | 180 | 270 },
>(item: T): T {
  return item;
}

function migrateStoredLayout(parsed: StoredFloorPlanLayout & { tables?: Record<string, StoredTableLayout> }) {
  const legacyTables = parsed.tables ?? {};
  const baseTables =
    Object.keys(parsed.baseTables ?? {}).length > 0 ? parsed.baseTables ?? {} : legacyTables;

  return {
    baseTables,
    fixtures: Array.isArray(parsed.fixtures)
      ? parsed.fixtures.map((fixture) => normalizeRotatedLayoutItem(fixture))
      : [],
    removedFromPlan: Array.isArray(parsed.removedFromPlan) ? parsed.removedFromPlan : [],
  };
}

/** Parse un layout brut (localStorage, JSONB Supabase, legacy). */
export function parseStoredFloorPlanLayout(raw: unknown): StoredFloorPlanLayout {
  if (!raw || typeof raw !== "object") {
    return { baseTables: {}, fixtures: [], removedFromPlan: [] };
  }
  return migrateStoredLayout(raw as StoredFloorPlanLayout & { tables?: Record<string, StoredTableLayout> });
}

export function isStoredFloorPlanEmpty(layout: StoredFloorPlanLayout | null | undefined): boolean {
  if (!layout) return true;
  return (
    Object.keys(layout.baseTables).length === 0 &&
    layout.fixtures.length === 0 &&
    (layout.removedFromPlan?.length ?? 0) === 0
  );
}

/** Priorité serveur ; repli localStorage ; migration locale si le serveur est vide. */
export function resolveStoredFloorPlanLayout(
  serverLayout: StoredFloorPlanLayout | null | undefined,
  localLayout: StoredFloorPlanLayout | null
): { layout: StoredFloorPlanLayout | null; shouldMigrateLocalToServer: boolean } {
  const serverEmpty = isStoredFloorPlanEmpty(serverLayout);
  const localEmpty = isStoredFloorPlanEmpty(localLayout);

  if (!serverEmpty && serverLayout) {
    return { layout: serverLayout, shouldMigrateLocalToServer: false };
  }
  if (!localEmpty && localLayout) {
    return { layout: localLayout, shouldMigrateLocalToServer: true };
  }
  return { layout: null, shouldMigrateLocalToServer: false };
}

export function loadFloorPlanDocument(restaurantId: string): StoredFloorPlanDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    return parseStoredFloorPlanDocument(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveFloorPlanDocument(restaurantId: string, document: StoredFloorPlanDocument) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    storageKey(restaurantId),
    JSON.stringify(parseStoredFloorPlanDocument(document))
  );
}

/** @deprecated Utiliser loadFloorPlanDocument. Retourne le layout du niveau actif. */
export function loadFloorPlanLayout(restaurantId: string): StoredFloorPlanLayout | null {
  const doc = loadFloorPlanDocument(restaurantId);
  if (!doc) return null;
  const level = doc.levels.find((l) => l.id === doc.activeLevelId) ?? doc.levels[0];
  return level?.layout ?? null;
}

/** @deprecated Utiliser saveFloorPlanDocument. */
export function saveFloorPlanLayout(restaurantId: string, layout: StoredFloorPlanLayout) {
  const existing = loadFloorPlanDocument(restaurantId) ?? createDefaultFloorPlanDocument();
  const activeId = existing.activeLevelId;
  saveFloorPlanDocument(restaurantId, {
    ...existing,
    levels: existing.levels.map((level) =>
      level.id === activeId ? { ...level, layout: parseStoredFloorPlanLayout(layout) } : level
    ),
  });
}

/** Écriture atomique tables + fixtures + removedFromPlan (évite les races read-modify-write). */
export function saveFullFloorPlanLayout(restaurantId: string, layout: StoredFloorPlanLayout) {
  saveFloorPlanLayout(restaurantId, layout);
}

export function loadFloorPlanFixtures(restaurantId: string): FloorFixture[] {
  return loadFloorPlanLayout(restaurantId)?.fixtures ?? [];
}

export function saveFloorPlanFixtures(restaurantId: string, fixtures: FloorFixture[]) {
  const existing = loadFloorPlanLayout(restaurantId);
  saveFloorPlanLayout(restaurantId, {
    baseTables: existing?.baseTables ?? {},
    fixtures,
    removedFromPlan: existing?.removedFromPlan ?? [],
  });
}

export function saveBaseTableLayouts(restaurantId: string, tables: FloorTable[]) {
  const existing = loadFloorPlanLayout(restaurantId);
  const onPlanIds = new Set(tables.map((table) => table.id));
  const removedFromPlan = (existing?.removedFromPlan ?? []).filter((id) => !onPlanIds.has(id));

  saveFloorPlanLayout(restaurantId, {
    baseTables: tablesToStoredRecord(tables),
    fixtures: existing?.fixtures ?? [],
    removedFromPlan,
  });
}

export function removeTableFromBasePlan(
  restaurantId: string,
  tableId: string,
  remainingTables: FloorTable[]
) {
  const existing = loadFloorPlanLayout(restaurantId);
  const removedFromPlan = [...new Set([...(existing?.removedFromPlan ?? []), tableId])];

  saveFloorPlanLayout(restaurantId, {
    baseTables: tablesToStoredRecord(remainingTables),
    fixtures: existing?.fixtures ?? [],
    removedFromPlan,
  });
}

function parseServiceOverrides(raw: unknown): ServiceTableOverrides | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.serviceDate !== getServiceDateParis()) return null;

  if (obj.levels && typeof obj.levels === "object") {
    return { serviceDate: obj.serviceDate as string, levels: obj.levels as Record<string, ServiceLevelOverrides> };
  }

  // Legacy mono-niveau
  const legacy = raw as { serviceDate: string; tables?: Record<string, StoredTableLayout>; activatedTableIds?: string[] };
  if (legacy.tables) {
    return {
      serviceDate: legacy.serviceDate,
      levels: {
        main: {
          tables: legacy.tables,
          activatedTableIds: legacy.activatedTableIds,
        },
      },
    };
  }
  return null;
}

export function loadServiceTableOverrides(restaurantId: string): ServiceTableOverrides | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(serviceOverrideKey(restaurantId));
    if (!raw) return null;
    const parsed = parseServiceOverrides(JSON.parse(raw));
    if (!parsed) {
      window.sessionStorage.removeItem(serviceOverrideKey(restaurantId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeServiceOverrides(restaurantId: string, payload: ServiceTableOverrides) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(serviceOverrideKey(restaurantId), JSON.stringify(payload));
}

function getLevelServiceOverrides(
  store: ServiceTableOverrides | null,
  levelId: string
): ServiceLevelOverrides | null {
  if (!store) return null;
  return store.levels[levelId] ?? null;
}

export function saveServiceTableOverrides(
  restaurantId: string,
  levelId: string,
  tables: FloorTable[]
) {
  if (typeof window === "undefined") return;
  const existing = loadServiceTableOverrides(restaurantId);
  const levelExisting = getLevelServiceOverrides(existing, levelId);
  const payload: ServiceTableOverrides = {
    serviceDate: getServiceDateParis(),
    levels: {
      ...(existing?.levels ?? {}),
      [levelId]: {
        tables: tablesToStoredRecord(tables),
        activatedTableIds: levelExisting?.activatedTableIds ?? [],
      },
    },
  };
  writeServiceOverrides(restaurantId, payload);
}

export function markServiceTableActivated(
  restaurantId: string,
  levelId: string,
  tableId: string,
  tables: FloorTable[]
) {
  if (typeof window === "undefined") return;
  const existing = loadServiceTableOverrides(restaurantId);
  const levelExisting = getLevelServiceOverrides(existing, levelId);
  const activatedTableIds = [...new Set([...(levelExisting?.activatedTableIds ?? []), tableId])];
  const payload: ServiceTableOverrides = {
    serviceDate: getServiceDateParis(),
    levels: {
      ...(existing?.levels ?? {}),
      [levelId]: {
        tables: tablesToStoredRecord(tables),
        activatedTableIds,
      },
    },
  };
  writeServiceOverrides(restaurantId, payload);
}

/** Tables déjà ouvertes ce service (ou occupées) pour un espace donné. */
export function getServiceActivatedTableIds(
  serverTables: FloorTable[],
  levelId: string,
  serviceOverrides: ServiceTableOverrides | null
): string[] {
  const levelOverrides = getLevelServiceOverrides(serviceOverrides, levelId);
  const ids = new Set(levelOverrides?.activatedTableIds ?? []);

  for (const table of serverTables) {
    if (table.status === "occupied") ids.add(table.id);
  }

  return [...ids];
}

export function clearServiceTableOverrides(restaurantId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(serviceOverrideKey(restaurantId));
}

/** Remet une table sur sa position/taille de base après encaissement ou annulation. */
export function resetTableToBaseLayout(restaurantId: string, tableId: string) {
  if (typeof window === "undefined") return;
  const existing = loadServiceTableOverrides(restaurantId);
  if (!existing) return;

  const levels: Record<string, ServiceLevelOverrides> = {};
  let changed = false;

  for (const [levelId, levelData] of Object.entries(existing.levels)) {
    const tables = { ...levelData.tables };
    const hadTable = tableId in tables;
    if (hadTable) delete tables[tableId];
    const activatedTableIds = (levelData.activatedTableIds ?? []).filter((id) => id !== tableId);
    if (hadTable || activatedTableIds.length !== (levelData.activatedTableIds ?? []).length) {
      changed = true;
    }
    if (Object.keys(tables).length > 0 || activatedTableIds.length > 0) {
      levels[levelId] = { tables, activatedTableIds };
    }
  }

  if (!changed) return;

  if (Object.keys(levels).length === 0) {
    clearServiceTableOverrides(restaurantId);
    return;
  }

  writeServiceOverrides(restaurantId, { serviceDate: getServiceDateParis(), levels });
}

export function hasServiceTableOverrides(restaurantId: string): boolean {
  return loadServiceTableOverrides(restaurantId) != null;
}

function applyStoredLayoutToTable(table: FloorTable, saved: StoredTableLayout): FloorTable {
  return normalizeRotatedLayoutItem({
    ...table,
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
    rotation: saved.rotation,
    capacity: saved.capacity,
  });
}

function defaultGridTable(table: FloorTable, index: number): FloorTable {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return normalizeRotatedLayoutItem({
    ...table,
    x: 8 + column * 21,
    y: 12 + row * 20,
    width: 12,
    height: 12,
    rotation: 0,
    capacity: table.capacity || 4,
  });
}

function resolveTableLayout(
  table: FloorTable,
  index: number,
  baseTables: Record<string, StoredTableLayout>,
  serviceTables: Record<string, StoredTableLayout>
): FloorTable {
  const serviceSaved = serviceTables[table.id];
  if (serviceSaved) return applyStoredLayoutToTable(table, serviceSaved);

  const baseSaved = baseTables[table.id];
  if (baseSaved) return applyStoredLayoutToTable(table, baseSaved);

  return defaultGridTable(table, index);
}

export function mergeServerTablesForPlanEditor(
  serverTables: FloorTable[],
  stored: StoredFloorPlanLayout | null,
  tableIdsOnOtherLevels: Set<string> = new Set()
): FloorTable[] {
  const removed = new Set(stored?.removedFromPlan ?? []);
  const baseTables = stored?.baseTables ?? {};
  const tableById = new Map(serverTables.map((table) => [table.id, table]));

  const result: FloorTable[] = [];
  let index = 0;
  for (const [id, saved] of Object.entries(baseTables)) {
    if (removed.has(id) || tableIdsOnOtherLevels.has(id)) continue;
    const table = tableById.get(id);
    if (!table) continue;
    result.push(resolveTableLayout(table, index++, baseTables, {}));
  }
  return result;
}

export function mergeServerTablesForSalle(
  serverTables: FloorTable[],
  stored: StoredFloorPlanLayout | null,
  levelId: string,
  serviceOverrides: ServiceTableOverrides | null,
  tableIdsOnOtherLevels: Set<string> = new Set()
): { tables: FloorTable[]; fixtures: FloorFixture[]; hasServiceOverrides: boolean; activatedTableIds: string[] } {
  const fixtures = stored?.fixtures ?? [];
  const removed = new Set(stored?.removedFromPlan ?? []);
  const baseTables = stored?.baseTables ?? {};
  const levelService = getLevelServiceOverrides(serviceOverrides, levelId);
  const serviceTables = levelService?.tables ?? {};
  const tableById = new Map(serverTables.map((table) => [table.id, table]));

  const tables: FloorTable[] = [];
  let index = 0;
  for (const [id, saved] of Object.entries(baseTables)) {
    if (removed.has(id) || tableIdsOnOtherLevels.has(id)) continue;
    const table = tableById.get(id);
    if (!table) continue;
    tables.push(resolveTableLayout(table, index++, baseTables, serviceTables));
  }

  // Tables avec override service mais pas dans base (edge case)
  for (const [id, saved] of Object.entries(serviceTables)) {
    if (tables.some((t) => t.id === id) || tableIdsOnOtherLevels.has(id)) continue;
    const table = tableById.get(id);
    if (!table) continue;
    tables.push(applyStoredLayoutToTable(table, saved));
  }

  return {
    tables,
    fixtures,
    hasServiceOverrides: Object.keys(serviceTables).length > 0,
    activatedTableIds: getServiceActivatedTableIds(serverTables, levelId, serviceOverrides),
  };
}

/** @deprecated Utiliser mergeServerTablesForSalle ou mergeServerTablesForPlanEditor. */
export function mergeServerTablesWithLayout(
  serverTables: FloorTable[],
  stored: StoredFloorPlanLayout | null
): { tables: FloorTable[]; fixtures: FloorFixture[] } {
  const { tables, fixtures } = mergeServerTablesForSalle(serverTables, stored, "main", null);
  return { tables, fixtures };
}

export function tablesToStoredRecord(tables: FloorTable[]): Record<string, StoredTableLayout> {
  return Object.fromEntries(
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
  );
}

const DEFAULT_PLAN_TABLE_WIDTH = 12;
const DEFAULT_PLAN_TABLE_HEIGHT = 12;
const DEFAULT_PLAN_TABLE_CAPACITY = 4;

export function withDefaultPlanPlacement(table: FloorTable): FloorTable {
  return normalizeRotatedLayoutItem({
    ...table,
    x: 50 - DEFAULT_PLAN_TABLE_WIDTH / 2,
    y: 50 - DEFAULT_PLAN_TABLE_HEIGHT / 2,
    width: table.width || DEFAULT_PLAN_TABLE_WIDTH,
    height: table.height || DEFAULT_PLAN_TABLE_HEIGHT,
    rotation: table.rotation ?? 0,
    capacity: table.capacity || DEFAULT_PLAN_TABLE_CAPACITY,
  });
}

/** @deprecated Utiliser saveBaseTableLayouts ou saveServiceTableOverrides. */
export function saveFloorPlanTableLayouts(restaurantId: string, tables: FloorTable[]) {
  saveBaseTableLayouts(restaurantId, tables);
}

/** @deprecated Utiliser removeTableFromBasePlan. */
export function removeTableFromFloorPlan(
  restaurantId: string,
  tableId: string,
  remainingTables: FloorTable[]
) {
  removeTableFromBasePlan(restaurantId, tableId, remainingTables);
}
