import type { FloorFixture, FloorTable } from "@/components/salle/InteractiveFloorPlan";

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

type ServiceTableOverrides = {
  serviceDate: string;
  tables: Record<string, StoredTableLayout>;
  /** Tables libres déjà ouvertes / configurées pendant ce service. */
  activatedTableIds?: string[];
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

export function loadFloorPlanLayout(restaurantId: string): StoredFloorPlanLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFloorPlanLayout & { tables?: Record<string, StoredTableLayout> };
    if (!parsed || typeof parsed !== "object") return null;
    return migrateStoredLayout(parsed);
  } catch {
    return null;
  }
}

export function saveFloorPlanLayout(restaurantId: string, layout: StoredFloorPlanLayout) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(restaurantId), JSON.stringify(layout));
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

export function loadServiceTableOverrides(restaurantId: string): ServiceTableOverrides | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(serviceOverrideKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ServiceTableOverrides;
    if (!parsed || parsed.serviceDate !== getServiceDateParis()) {
      window.sessionStorage.removeItem(serviceOverrideKey(restaurantId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveServiceTableOverrides(restaurantId: string, tables: FloorTable[]) {
  if (typeof window === "undefined") return;
  const existing = loadServiceTableOverrides(restaurantId);
  const payload: ServiceTableOverrides = {
    serviceDate: getServiceDateParis(),
    tables: tablesToStoredRecord(tables),
    activatedTableIds: existing?.activatedTableIds ?? [],
  };
  window.sessionStorage.setItem(serviceOverrideKey(restaurantId), JSON.stringify(payload));
}

export function markServiceTableActivated(
  restaurantId: string,
  tableId: string,
  tables: FloorTable[]
) {
  if (typeof window === "undefined") return;
  const existing = loadServiceTableOverrides(restaurantId);
  const activatedTableIds = [...new Set([...(existing?.activatedTableIds ?? []), tableId])];
  const payload: ServiceTableOverrides = {
    serviceDate: getServiceDateParis(),
    tables: tablesToStoredRecord(tables),
    activatedTableIds,
  };
  window.sessionStorage.setItem(serviceOverrideKey(restaurantId), JSON.stringify(payload));
}

/** Tables déjà ouvertes ce service (ou occupées). */
export function getServiceActivatedTableIds(
  serverTables: FloorTable[],
  _stored: StoredFloorPlanLayout | null,
  serviceOverrides: ServiceTableOverrides | null
): string[] {
  const ids = new Set(serviceOverrides?.activatedTableIds ?? []);

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

  const tables = { ...existing.tables };
  delete tables[tableId];
  const activatedTableIds = (existing.activatedTableIds ?? []).filter((id) => id !== tableId);

  if (Object.keys(tables).length === 0 && activatedTableIds.length === 0) {
    clearServiceTableOverrides(restaurantId);
    return;
  }

  const payload: ServiceTableOverrides = {
    serviceDate: getServiceDateParis(),
    tables,
    activatedTableIds,
  };
  window.sessionStorage.setItem(serviceOverrideKey(restaurantId), JSON.stringify(payload));
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
  stored: StoredFloorPlanLayout | null
): FloorTable[] {
  const removed = new Set(stored?.removedFromPlan ?? []);
  const baseTables = stored?.baseTables ?? {};

  return serverTables
    .filter((table) => !removed.has(table.id))
    .map((table, index) => resolveTableLayout(table, index, baseTables, {}));
}

export function mergeServerTablesForSalle(
  serverTables: FloorTable[],
  stored: StoredFloorPlanLayout | null,
  serviceOverrides: ServiceTableOverrides | null
): { tables: FloorTable[]; fixtures: FloorFixture[]; hasServiceOverrides: boolean; activatedTableIds: string[] } {
  const fixtures = stored?.fixtures ?? [];
  const removed = new Set(stored?.removedFromPlan ?? []);
  const baseTables = stored?.baseTables ?? {};
  const serviceTables = serviceOverrides?.tables ?? {};

  const tables = serverTables
    .filter((table) => !removed.has(table.id))
    .map((table, index) => resolveTableLayout(table, index, baseTables, serviceTables));

  return {
    tables,
    fixtures,
    hasServiceOverrides: Object.keys(serviceTables).length > 0,
    activatedTableIds: getServiceActivatedTableIds(serverTables, stored, serviceOverrides),
  };
}

/** @deprecated Utiliser mergeServerTablesForSalle ou mergeServerTablesForPlanEditor. */
export function mergeServerTablesWithLayout(
  serverTables: FloorTable[],
  stored: StoredFloorPlanLayout | null
): { tables: FloorTable[]; fixtures: FloorFixture[] } {
  const { tables, fixtures } = mergeServerTablesForSalle(serverTables, stored, null);
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
