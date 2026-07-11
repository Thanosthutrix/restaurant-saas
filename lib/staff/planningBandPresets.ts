import { parseTimeBandsArray } from "@/lib/staff/planningResolve";
import {
  parseOpeningHoursJson,
  PLANNING_DAY_KEYS,
  type OpeningHoursMap,
  type PlanningDayKey,
  type TimeBand,
} from "@/lib/staff/planningHoursTypes";
import { planningDayKeyFromYmd } from "@/lib/staff/weekUtils";

export type PlanningBandPresetScheduleKind = "same_daily" | "weekly";

export type PlanningBandPreset = {
  id: string;
  label: string;
  /** Plages identiques chaque jour (férié, vacances courtes). */
  scheduleKind: PlanningBandPresetScheduleKind;
  bands: TimeBand[];
  /** Horaires lun–dim pour vacances / périodes longues. */
  weeklyBands?: OpeningHoursMap;
  /** ETP optionnel : appliqué avec ce modèle au calendrier (fériés / vacances). */
  etp?: number | null;
};

type VacationOverrideRow = {
  is_closed: boolean;
  opening_bands_override: unknown;
  staff_target_override: number | null;
  calendar_source: string | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Sérialisation stable pour comparer deux listes de plages. */
export function bandsSignature(bands: TimeBand[]): string {
  const norm = [...bands].map((b) => ({ start: b.start.trim(), end: b.end.trim() }));
  norm.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  return JSON.stringify(norm);
}

export function isWeeklyBandPreset(preset: PlanningBandPreset): boolean {
  return preset.scheduleKind === "weekly";
}

export function getPresetBandsForDay(preset: PlanningBandPreset, dayKey: PlanningDayKey): TimeBand[] {
  if (preset.scheduleKind === "weekly" && preset.weeklyBands) {
    return [...(preset.weeklyBands[dayKey] ?? [])].map((b) => ({ ...b }));
  }
  return [...preset.bands].map((b) => ({ ...b }));
}

export function presetHasAnyOpeningBand(preset: PlanningBandPreset): boolean {
  if (preset.scheduleKind === "weekly") {
    return PLANNING_DAY_KEYS.some((k) => (preset.weeklyBands?.[k]?.length ?? 0) > 0);
  }
  return preset.bands.length > 0;
}

export function findPresetMatchingBands(
  presets: PlanningBandPreset[],
  bands: TimeBand[] | null
): PlanningBandPreset | null {
  if (!bands || bands.length === 0) return null;
  const sig = bandsSignature(bands);
  return (
    presets.find(
      (p) => p.scheduleKind === "same_daily" && bandsSignature(p.bands) === sig
    ) ?? null
  );
}

/** Preset dont les plages et l’ETP coïncident avec une ligne d’exception (calendrier guidé). */
export function findPresetForCalendarRow(
  presets: PlanningBandPreset[],
  bands: TimeBand[] | null,
  staffTarget: number | null,
  dayKey?: PlanningDayKey
): PlanningBandPreset | null {
  const rowEtp =
    staffTarget != null && Number.isFinite(Number(staffTarget)) ? round2(Number(staffTarget)) : null;

  for (const p of presets) {
    const pEtp = p.etp != null && Number.isFinite(Number(p.etp)) ? round2(Number(p.etp)) : null;
    if (pEtp !== rowEtp) continue;

    if (p.scheduleKind === "weekly" && dayKey != null) {
      const expected = getPresetBandsForDay(p, dayKey);
      if (bandsSignature(expected) === bandsSignature(bands ?? [])) return p;
      continue;
    }

    if (p.scheduleKind === "same_daily" && bands?.length) {
      if (bandsSignature(p.bands) === bandsSignature(bands)) return p;
    }
  }
  return null;
}

function rowMatchesPreset(row: VacationOverrideRow, preset: PlanningBandPreset, ymd: string): boolean {
  const staffEtp =
    preset.etp != null && Number.isFinite(Number(preset.etp)) ? round2(Number(preset.etp)) : null;
  const rowEtp =
    row.staff_target_override != null && Number.isFinite(Number(row.staff_target_override))
      ? round2(Number(row.staff_target_override))
      : null;

  if (staffEtp != null) {
    if (rowEtp !== staffEtp) return false;
  } else if (rowEtp != null) {
    return false;
  }

  if (preset.scheduleKind === "weekly") {
    const dk = planningDayKeyFromYmd(ymd);
    if (!dk) return false;
    const expected = getPresetBandsForDay(preset, dk);
    if (row.is_closed) return expected.length === 0;
    const actual = parseTimeBandsArray(row.opening_bands_override) ?? [];
    return bandsSignature(actual) === bandsSignature(expected);
  }

  if (row.is_closed) return false;
  const actual = parseTimeBandsArray(row.opening_bands_override) ?? [];
  return bandsSignature(actual) === bandsSignature(preset.bands);
}

/** Vérifie qu’une période vacances correspond au modèle (hebdo ou journalier). */
export function findPresetForVacationPeriod(
  presets: PlanningBandPreset[],
  days: string[],
  overrideByDay: Map<string, VacationOverrideRow>
): PlanningBandPreset | null {
  if (days.length === 0) return null;

  for (const preset of presets) {
    let matches = true;
    for (const ymd of days) {
      const row = overrideByDay.get(ymd);
      if (!row || row.calendar_source !== "school_vacation") {
        matches = false;
        break;
      }
      if (!rowMatchesPreset(row, preset, ymd)) {
        matches = false;
        break;
      }
    }
    if (matches) return preset;
  }
  return null;
}

/**
 * Parse et valide le JSON stocké en base (liste de modèles).
 * Limite : 30 modèles, 12 plages par jour.
 */
export function parsePlanningBandPresetsJson(raw: unknown): PlanningBandPreset[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: PlanningBandPreset[] = [];
  for (const item of raw.slice(0, 30)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = String(rec.id ?? "").trim() || randomId();
    const label = String(rec.label ?? "").trim().slice(0, 120);
    if (!label) continue;

    const scheduleKindRaw = String(rec.scheduleKind ?? rec.schedule_kind ?? "").trim();
    const weeklyBands = parseOpeningHoursJson(rec.weeklyBands ?? rec.weekly_bands);
    const hasWeekly = Object.keys(weeklyBands).length > 0;
    const scheduleKind: PlanningBandPresetScheduleKind =
      scheduleKindRaw === "weekly" || (hasWeekly && scheduleKindRaw !== "same_daily")
        ? "weekly"
        : "same_daily";

    const bandsRaw = rec.bands;
    const parsedBands = parseTimeBandsArray(bandsRaw) ?? [];

    if (scheduleKind === "weekly") {
      if (!hasWeekly) continue;
    } else if (parsedBands.length === 0) {
      continue;
    }

    let etp: number | null = null;
    if (rec.etp != null && rec.etp !== "") {
      const n = Number(rec.etp);
      if (Number.isFinite(n) && n >= 0 && n <= 500) {
        etp = round2(n);
      }
    }

    out.push({
      id: id.slice(0, 64),
      label,
      scheduleKind,
      bands: parsedBands.slice(0, 12),
      weeklyBands: scheduleKind === "weekly" ? weeklyBands : undefined,
      etp,
    });
  }
  return out;
}

export function emptyPresetDraft(): PlanningBandPreset {
  return {
    id: randomId(),
    label: "",
    scheduleKind: "same_daily",
    bands: [{ start: "11:30", end: "14:30" }],
    weeklyBands: undefined,
    etp: null,
  };
}

export function emptyWeeklyBandsDraft(): OpeningHoursMap {
  return {
    mon: [{ start: "11:30", end: "14:30" }],
    tue: [{ start: "11:30", end: "14:30" }],
    wed: [{ start: "11:30", end: "14:30" }],
    thu: [{ start: "11:30", end: "14:30" }],
    fri: [{ start: "11:30", end: "14:30" }],
    sat: [{ start: "11:30", end: "14:30" }],
    sun: [],
  };
}
