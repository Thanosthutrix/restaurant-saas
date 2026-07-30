import type { DiningLineModification, LineModificationType } from "./lineModificationTypes";

export type KitchenModsSnapshotItem = {
  modificationType: LineModificationType;
  inventoryItemName: string;
  replacementInventoryItemName?: string | null;
};

/** Modifs validées par le serveur pour le pass cuisine. */
export type KitchenModsSnapshot = {
  fingerprint: string | null;
  items: KitchenModsSnapshotItem[];
};

export type LineModificationInput = {
  modificationType: LineModificationType;
  dishComponentId: string;
  inventoryItemId: string;
  replacementInventoryItemId?: string | null;
};

/** Empreinte stable pour fusionner ou distinguer les lignes même plat. */
export function buildModificationFingerprint(inputs: LineModificationInput[]): string | null {
  if (inputs.length === 0) return null;
  const normalized = inputs
    .map((m) => ({
      t: m.modificationType,
      dc: m.dishComponentId,
      ii: m.inventoryItemId,
      rep: m.replacementInventoryItemId ?? null,
    }))
    .sort((a, b) =>
      `${a.t}:${a.dc}:${a.ii}:${a.rep}`.localeCompare(`${b.t}:${b.dc}:${b.ii}:${b.rep}`)
    );
  return JSON.stringify(normalized);
}

export function modificationsToInputs(mods: DiningLineModification[]): LineModificationInput[] {
  return mods
    .filter((m) => m.dishComponentId && m.inventoryItemId)
    .map((m) => ({
      modificationType: m.modificationType,
      dishComponentId: m.dishComponentId!,
      inventoryItemId: m.inventoryItemId!,
      replacementInventoryItemId: m.replacementInventoryItemId,
    }));
}

export function buildSnapshotFromModifications(
  mods: DiningLineModification[]
): KitchenModsSnapshot {
  const inputs = modificationsToInputs(mods);
  return {
    fingerprint: buildModificationFingerprint(inputs),
    items: mods.map((m) => ({
      modificationType: m.modificationType,
      inventoryItemName: m.inventoryItemName,
      replacementInventoryItemName: m.replacementInventoryItemName,
    })),
  };
}

export function parseKitchenModsSnapshot(raw: unknown): KitchenModsSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.items)) return null;
  const items: KitchenModsSnapshotItem[] = [];
  for (const item of o.items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const t = row.modificationType;
    if (t !== "remove_component" && t !== "swap_accompaniment") continue;
    items.push({
      modificationType: t,
      inventoryItemName: String(row.inventoryItemName ?? "Ingrédient"),
      replacementInventoryItemName:
        row.replacementInventoryItemName != null
          ? String(row.replacementInventoryItemName)
          : null,
    });
  }
  const fp = o.fingerprint;
  return {
    fingerprint: fp == null ? null : String(fp),
    items,
  };
}

export function kitchenLabelsFromSnapshot(snapshot: KitchenModsSnapshot | null): string[] {
  if (!snapshot?.items.length) return [];
  const pseudoMods: DiningLineModification[] = snapshot.items.map((item, i) => ({
    id: `snap-${i}`,
    modificationType: item.modificationType,
    dishComponentId: null,
    inventoryItemId: null,
    inventoryItemName: item.inventoryItemName,
    replacementInventoryItemId: null,
    replacementInventoryItemName: item.replacementInventoryItemName ?? null,
  }));
  return formatModificationsForKitchen(pseudoMods);
}

export function hasPendingKitchenMods(
  mods: DiningLineModification[],
  snapshot: KitchenModsSnapshot | null
): boolean {
  const currentFp = buildModificationFingerprint(modificationsToInputs(mods));
  const validatedFp = snapshot?.fingerprint ?? null;
  return currentFp !== validatedFp;
}

export function formatModificationsForKitchen(mods: DiningLineModification[]): string[] {
  const lines: string[] = [];
  for (const m of mods) {
    if (m.modificationType === "remove_component") {
      lines.push(`SANS ${m.inventoryItemName.toUpperCase()}`);
      continue;
    }
    if (m.modificationType === "swap_accompaniment" && m.replacementInventoryItemName) {
      lines.push(`${m.replacementInventoryItemName} (au lieu de ${m.inventoryItemName})`);
    }
  }
  return lines;
}
