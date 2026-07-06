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

const PLANNING_DAY_FULL_LABELS_FR: Record<PlanningDayKey, string> = {
  mon: "Lundi",
  tue: "Mardi",
  wed: "Mercredi",
  thu: "Jeudi",
  fri: "Vendredi",
  sat: "Samedi",
  sun: "Dimanche",
};

const JS_DAY_TO_KEY: Record<number, PlanningDayKey> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

export type OpeningHoursDay = {
  key: PlanningDayKey;
  label: string;
  fullLabel: string;
  bands: { start: string; end: string }[];
  isClosed: boolean;
};

export function buildOpeningHoursSchedule(
  planningOpeningHours: unknown,
  closedDaysOfWeek: number[] = []
): OpeningHoursDay[] {
  const opening = parseOpeningHoursJson(planningOpeningHours);
  const closedKeys = new Set(
    closedDaysOfWeek
      .map((d) => CLOSED_DAY_TO_KEY[d])
      .filter((k): k is PlanningDayKey => k != null)
  );

  return PLANNING_DAY_KEYS.map((key) => {
    const bands = opening[key] ?? [];
    const isClosed = closedKeys.has(key) || bands.length === 0;
    return {
      key,
      label: PLANNING_DAY_LABELS_FR[key],
      fullLabel: PLANNING_DAY_FULL_LABELS_FR[key],
      bands,
      isClosed,
    };
  });
}

export function formatOpeningHoursBandLabel(band: { start: string; end: string }): string {
  return `${formatTimeFr(band.start)}–${formatTimeFr(band.end)}`;
}

export function getTodayPlanningDayKey(date = new Date()): PlanningDayKey {
  return JS_DAY_TO_KEY[date.getDay()];
}

export function isOpenAt(schedule: OpeningHoursDay[], date = new Date()): boolean {
  const key = getTodayPlanningDayKey(date);
  const day = schedule.find((d) => d.key === key);
  if (!day || day.isClosed || day.bands.length === 0) return false;

  const minutes = date.getHours() * 60 + date.getMinutes();
  return day.bands.some((band) => {
    const [sh, sm] = band.start.split(":").map(Number);
    const [eh, em] = band.end.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return minutes >= start && minutes < end;
  });
}
