import type { FloorTable } from "@/components/salle/InteractiveFloorPlan";
import type { HygieneElement } from "@/lib/hygiene/types";

const DEFAULT_WIDTH = 14;
const DEFAULT_HEIGHT = 14;

function truncateLabel(name: string, max = 14): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** Convertit un élément hygiène froid en « table » pour le plan interactif. */
export function hygieneElementToFloorEquipment(el: HygieneElement, index: number): FloorTable {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    id: el.id,
    label: truncateLabel(el.name),
    capacity: 0,
    x: 8 + column * 21,
    y: 12 + row * 20,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    rotation: 0,
    status: "free",
  };
}

export function buildFloorEquipmentFromElements(elements: HygieneElement[]): FloorTable[] {
  return elements.map((el, index) => hygieneElementToFloorEquipment(el, index));
}

export type KitchenEquipmentPlanStatus = "pending" | "recorded" | "draft";

export type KitchenEquipmentStatusMap = Record<
  string,
  { state: KitchenEquipmentPlanStatus; temperature?: number }
>;
