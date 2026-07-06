import {
  PLANNING_DAY_KEYS,
  PLANNING_DAY_LABELS_FR,
  parseOpeningHoursJson,
  type OpeningHoursMap,
  type PlanningDayKey,
} from "@/lib/staff/planningHoursTypes";

/** Jours de fermeture hebdo ERP : 0 = dimanche, 1 = lundi, …, 6 = samedi. */
const CLOSED_DAY_TO_KEY: Record<number, PlanningDayKey> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

function formatTimeFr(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  const hour = Number(h);
  if (m === "00") return `${hour}h`;
  return `${hour}h${m}`;
}

function formatBands(bands: { start: string; end: string }[]): string {
  return bands.map((b) => `${formatTimeFr(b.start)}–${formatTimeFr(b.end)}`).join(" · ");
}

/**
 * Formate les horaires d'ouverture ERP (planning) pour affichage B2C.
 */
export function formatOpeningHoursForPublic(
  planningOpeningHours: unknown,
  closedDaysOfWeek: number[] = []
): string {
  const opening = parseOpeningHoursJson(planningOpeningHours);
  const closedKeys = new Set(
    closedDaysOfWeek
      .map((d) => CLOSED_DAY_TO_KEY[d])
      .filter((k): k is PlanningDayKey => k != null)
  );

  const segments: string[] = [];

  for (const key of PLANNING_DAY_KEYS) {
    if (closedKeys.has(key)) continue;
    const bands = opening[key];
    if (!bands?.length) continue;
    segments.push(`${PLANNING_DAY_LABELS_FR[key]} ${formatBands(bands)}`);
  }

  return segments.length > 0 ? segments.join(" · ") : "Horaires non renseignés";
}

export function getOpeningHoursMap(planningOpeningHours: unknown): OpeningHoursMap {
  return parseOpeningHoursJson(planningOpeningHours);
}
