import {
  planningDayOverrideReplacesWeeklyModel,
  type PlanningDayOverrideRow,
  type WeekResolvedDay,
} from "@/lib/staff/planningResolve";
import {
  PLANNING_DAY_LABELS_FR,
  type PlanningDayKey,
  type TimeBand,
  minutesFromMidnight,
} from "@/lib/staff/planningHoursTypes";
import type { PeakBandsWeeklyMap } from "@/lib/staff/planningPeakBands";
import type { StaffMember } from "@/lib/staff/types";

export type DraftDayIntensity = "quiet" | "normal" | "busy" | "event";

export type DraftPeakBandRow = {
  start: string;
  end: string;
  staffCount: string;
};

export type PlanningDraftDayRow = {
  ymd: string;
  dayKey: PlanningDayKey;
  dateLabel: string;
  openingLabel: string;
  exceptionLabel: string | null;
  calendarSource: PlanningDayOverrideRow["calendar_source"];
  isClosed: boolean;
  staffTarget: string;
  customLabel: string;
  intensity: DraftDayIntensity;
  /** true = ne pas écraser le modèle hebdo (lun–dim) lors de l’enregistrement du questionnaire. */
  exceptionReplacesModel: boolean;
  /** Plages où l’effectif doit être renforcé (midi, soir…). */
  peakBands: DraftPeakBandRow[];
};

export type PlanningDraftBriefPayload = {
  weekMondayYmd: string;
  securityFloor?: number;
  days: {
    ymd: string;
    isClosed: boolean;
    openingBandsOverride?: TimeBand[] | null;
    staffTargetOverride: number | null;
    label: string | null;
  }[];
  updateWeeklyTargets: boolean;
  weeklyTargets: Partial<Record<PlanningDayKey, number>>;
  unavailableStaffIds: string[];
  prioritizeRoleBalance: boolean;
  peakBandsByDay: Record<string, { start: string; end: string; staffCount: number }[]>;
  allowWeeklyOvertime: {
    enabled: boolean;
    maxOvertimePercent: number;
    staffIds: string[];
  };
  applyCarryoverAfterGenerate: boolean;
  maxDailyHoursByStaffId: Record<string, number | null>;
  /** Heures supplémentaires autorisées cette semaine (id → h ajoutées au contrat). */
  weeklyHoursBonusByStaffId: Record<string, number>;
  /** Surcharges contrat depuis le wizard (id → h) — appliquées à la génération même sans rétro-save. */
  contractWeeklyHoursByStaffId?: Record<string, number>;
  /** Absences datées : ymd → ids exclus ce jour-là uniquement. */
  absentStaffIdsByYmd?: Record<string, string[]>;
  /** Repos fixes issus du wizard : id → jours semaine. */
  fixedRestDaysByStaffId?: Partial<Record<string, PlanningDayKey[]>>;
  /** Nombre de jours de repos souhaités par semaine : id → 0..7. */
  weeklyRestDaysByStaffId?: Record<string, number>;
};

function formatBands(bands: TimeBand[]): string {
  if (bands.length === 0) return "Fermé";
  return bands.map((b) => `${b.start}–${b.end}`).join(", ");
}

function formatDayHoursLabel(wd: WeekResolvedDay, isClosed: boolean): string {
  if (isClosed) return "Fermé";
  const opening = formatBands(wd.openingBands);
  const extra = wd.staffExtraBands ?? [];
  if (extra.length === 0) return opening;
  return `${opening} · hors client ${formatBands(extra)}`;
}

function bandTotalMinutes(bands: TimeBand[]): number {
  return bands.reduce((sum, b) => {
    const a = minutesFromMidnight(b.start);
    const e = minutesFromMidnight(b.end);
    if (a == null || e == null || e <= a) return sum;
    return sum + (e - a);
  }, 0);
}

/** Suggestion heuristique : ~1 personne / 4 h de service. */
export function suggestStaffTargetFromDay(wd: WeekResolvedDay): number | null {
  const bands =
    (wd.staffExtraBands?.length ?? 0) > 0
      ? [...wd.openingBands, ...wd.staffExtraBands]
      : wd.openingBands;
  if (bands.length === 0) return null;
  const hours = bandTotalMinutes(bands) / 60;
  if (hours <= 0) return null;
  return Math.max(1, Math.ceil(hours / 4));
}

function minutesToHhmm(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Préremplit des plages de pointe (rush midi / soir) avec un effectif supérieur à la base. */
export function suggestPeakBandsForDay(
  wd: WeekResolvedDay,
  staffTarget: number | null,
  isClosed: boolean
): DraftPeakBandRow[] {
  if (isClosed || staffTarget == null || staffTarget <= 0) return [];
  const bands = wd.openingBands.length > 0 ? wd.openingBands : [...(wd.staffExtraBands ?? [])];
  if (bands.length === 0) return [];
  const base = Math.max(1, Math.ceil(staffTarget));
  const bonus = wd.dayKey === "sat" || wd.dayKey === "fri" || wd.exceptionLabel ? 2 : 1;
  const eveningBonus = wd.dayKey === "sat" ? 1 : 0;

  const rows: DraftPeakBandRow[] = [];
  for (const b of bands) {
    const startM = minutesFromMidnight(b.start);
    const endM = minutesFromMidnight(b.end);
    if (startM == null || endM == null || endM <= startM) continue;
    const dur = endM - startM;

    if (dur > 300 && startM < 900 && endM > 1020) {
      rows.push({
        start: b.start,
        end: minutesToHhmm(Math.min(endM, Math.max(startM + 120, 840))),
        staffCount: String(Math.min(500, base + bonus)),
      });
      rows.push({
        start: minutesToHhmm(Math.max(startM, endM - 150)),
        end: b.end,
        staffCount: String(Math.min(500, base + bonus + eveningBonus)),
      });
      continue;
    }

    if (dur > 180) {
      if (endM >= 1080) {
        rows.push({
          start: minutesToHhmm(Math.max(startM, endM - 150)),
          end: b.end,
          staffCount: String(Math.min(500, base + bonus)),
        });
      } else {
        rows.push({
          start: b.start,
          end: minutesToHhmm(Math.min(endM, startM + 150)),
          staffCount: String(Math.min(500, base + bonus)),
        });
      }
      continue;
    }

    rows.push({
      start: b.start,
      end: b.end,
      staffCount: String(Math.min(500, base + bonus)),
    });
  }
  return rows;
}

function peakWeeklyToDraftRows(bands: { start: string; end: string; staffCount: number }[]): DraftPeakBandRow[] {
  return bands.map((b) => ({
    start: b.start,
    end: b.end,
    staffCount: String(b.staffCount),
  }));
}

/** Plages de pointe : modèle établissement (jour type) si défini, sinon suggestion automatique. */
export function resolvePeakBandsForDay(
  wd: WeekResolvedDay,
  staffTarget: number | null,
  isClosed: boolean,
  peakBandsWeekly?: PeakBandsWeeklyMap
): DraftPeakBandRow[] {
  if (isClosed) return [];
  const fromModel = peakBandsWeekly?.[wd.dayKey];
  if (fromModel?.length) return peakWeeklyToDraftRows(fromModel);
  return suggestPeakBandsForDay(wd, staffTarget, isClosed);
}

export function parsePeakRows(rows: DraftPeakBandRow[]): { start: string; end: string; staffCount: number }[] {
  const out: { start: string; end: string; staffCount: number }[] = [];
  for (const r of rows) {
    const start = r.start.trim();
    const end = r.end.trim();
    const n = Number(r.staffCount.replace(",", "."));
    if (!start || !end || !Number.isFinite(n) || n <= 0) continue;
    out.push({ start, end, staffCount: Math.min(500, Math.ceil(n)) });
  }
  return out;
}

export function effectiveStaffTarget(
  base: number | null,
  intensity: DraftDayIntensity,
  isClosed: boolean
): number | null {
  if (isClosed) return null;
  if (base == null || !Number.isFinite(base) || base < 0) return null;
  if (intensity === "busy") return Math.min(500, base + 1);
  if (intensity === "event") return Math.min(500, base + 2);
  if (intensity === "quiet") return Math.max(0, base - 1);
  return base;
}

export function buildInitialDraftDays(
  resolvedWeekDays: WeekResolvedDay[],
  overrides: PlanningDayOverrideRow[],
  peakBandsWeekly?: PeakBandsWeeklyMap
): PlanningDraftDayRow[] {
  const ovByDay = new Map(overrides.map((o) => [o.day, o]));

  return resolvedWeekDays.map((wd) => {
    const ov = ovByDay.get(wd.ymd);
    const isClosed =
      ov?.is_closed ?? (wd.openingBands.length === 0 && (wd.staffExtraBands?.length ?? 0) === 0);
    const baseTarget =
      wd.staffTarget ??
      (isClosed ? null : suggestStaffTargetFromDay(wd));

    const replacesModel = ov != null && planningDayOverrideReplacesWeeklyModel(ov);
    const targetNum =
      baseTarget != null && Number.isFinite(baseTarget) ? baseTarget : null;

    return {
      ymd: wd.ymd,
      dayKey: wd.dayKey,
      dateLabel: wd.date.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      openingLabel: formatDayHoursLabel(wd, isClosed),
      exceptionLabel: wd.exceptionLabel,
      calendarSource: ov?.calendar_source ?? null,
      isClosed,
      staffTarget: baseTarget != null ? String(baseTarget) : "",
      customLabel: ov?.label?.trim() ?? wd.exceptionLabel ?? "",
      intensity: "normal" as DraftDayIntensity,
      exceptionReplacesModel: replacesModel,
      peakBands: resolvePeakBandsForDay(wd, targetNum, isClosed, peakBandsWeekly),
    };
  });
}

export type PlanningBriefWarning = {
  level: "info" | "warn";
  message: string;
};

export function computeBriefWarnings(
  days: PlanningDraftDayRow[],
  staff: StaffMember[],
  unavailableStaffIds: string[]
): PlanningBriefWarning[] {
  const warnings: PlanningBriefWarning[] = [];
  const availableCount = staff.filter((s) => s.active && !unavailableStaffIds.includes(s.id)).length;

  if (availableCount === 0) {
    warnings.push({ level: "warn", message: "Aucun collaborateur disponible cette semaine." });
  }

  let daysWithoutTarget = 0;
  let daysOverCapacity = 0;

  let maxDayTarget = 0;
  let maxPeakTarget = 0;

  for (const d of days) {
    if (d.isClosed) continue;
    const base = d.staffTarget.trim() === "" ? null : Number(d.staffTarget.replace(",", "."));
    const eff = effectiveStaffTarget(base, d.intensity, d.isClosed);
    if (eff == null || eff <= 0) {
      daysWithoutTarget += 1;
      continue;
    }
    maxDayTarget = Math.max(maxDayTarget, eff);
    if (eff > availableCount) daysOverCapacity += 1;

    for (const p of d.peakBands) {
      const n = Number(p.staffCount.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) continue;
      maxPeakTarget = Math.max(maxPeakTarget, Math.ceil(n));
      if (n > availableCount) {
        warnings.push({
          level: "warn",
          message: `${d.dateLabel} : pointe ${p.start}–${p.end} demande ${Math.ceil(n)} pers. — seulement ${availableCount} disponible(s) : l’ébauche plafonnera à ${availableCount} et signalera le manque.`,
        });
      }
    }
  }

  const maxNeeded = Math.max(maxDayTarget, maxPeakTarget);
  if (maxNeeded > availableCount && availableCount > 0) {
    warnings.push({
      level: "warn",
      message: `Objectif jusqu’à ${maxNeeded} personne(s) simultanées, mais ${availableCount} disponible(s) cette semaine : il manque ${maxNeeded - availableCount} personne(s) pour atteindre la cible. L’ébauche répartira au mieux (${availableCount} max/jour).`,
    });
  }

  if (daysWithoutTarget > 0) {
    warnings.push({
      level: "warn",
      message: `${daysWithoutTarget} jour(s) ouvert(s) sans effectif cible — l’ébauche risque de ne rien générer.`,
    });
  }

  if (daysOverCapacity > 0 && availableCount > 0) {
    warnings.push({
      level: "warn",
      message: `${daysOverCapacity} jour(s) demandent plus de personnes (${availableCount} disponible(s)). L’algo plafonne à l’effectif réel.`,
    });
  }

  const totalContractHours = staff
    .filter((s) => s.active && !unavailableStaffIds.includes(s.id))
    .reduce((sum, s) => sum + (s.target_weekly_hours ?? 0), 0);

  if (totalContractHours > 0 && totalContractHours < 20) {
    warnings.push({
      level: "info",
      message: "Contrats hebdo faibles renseignés — vérifiez les volumes horaires dans les fiches collaborateurs.",
    });
  }

  const noHoursConfigured = days.some((d) => !d.isClosed && d.openingLabel === "Fermé");
  if (noHoursConfigured) {
    warnings.push({
      level: "info",
      message: "Certains jours n’ont pas d’horaires d’ouverture — configurez-les dans les infos établissement si besoin.",
    });
  }

  return warnings;
}

export function buildBriefPayload(
  weekMondayYmd: string,
  days: PlanningDraftDayRow[],
  updateWeeklyTargets: boolean,
  unavailableStaffIds: string[],
  prioritizeRoleBalance: boolean,
  allowWeeklyOvertime: {
    enabled: boolean;
    maxOvertimePercent: number;
    staffIds: string[];
  },
  applyCarryoverAfterGenerate: boolean,
  maxDailyHoursByStaffId: Record<string, number | null>,
  weeklyHoursBonusByStaffId: Record<string, number>
): PlanningDraftBriefPayload {
  const weeklyTargets: Partial<Record<PlanningDayKey, number>> = {};
  for (const d of days) {
    if (d.isClosed || d.exceptionReplacesModel) continue;
    const base = d.staffTarget.trim() === "" ? null : Number(d.staffTarget.replace(",", "."));
    if (base != null && Number.isFinite(base) && base >= 0) {
      weeklyTargets[d.dayKey] = base;
    }
  }

  const peakBandsByDay: Record<string, { start: string; end: string; staffCount: number }[]> = {};
  for (const d of days) {
    if (d.isClosed) continue;
    const peaks = parsePeakRows(d.peakBands);
    if (peaks.length > 0) peakBandsByDay[d.ymd] = peaks;
  }

  return {
    weekMondayYmd,
    securityFloor: undefined,
    days: days.map((d) => {
      const base = d.staffTarget.trim() === "" ? null : Number(d.staffTarget.replace(",", "."));
      const eff = effectiveStaffTarget(base, d.intensity, d.isClosed);
      return {
        ymd: d.ymd,
        isClosed: d.isClosed,
        openingBandsOverride: d.isClosed ? null : null,
        staffTargetOverride: d.isClosed ? null : eff,
        label: d.customLabel.trim() || null,
      };
    }),
    updateWeeklyTargets,
    weeklyTargets,
    unavailableStaffIds,
    prioritizeRoleBalance,
    peakBandsByDay,
    allowWeeklyOvertime,
    applyCarryoverAfterGenerate,
    maxDailyHoursByStaffId,
    weeklyHoursBonusByStaffId,
  };
}

export function intensityLabelFr(i: DraftDayIntensity): string {
  switch (i) {
    case "quiet":
      return "Calme";
    case "busy":
      return "Fort";
    case "event":
      return "Événement";
    default:
      return "Normal";
  }
}

export function dayKeyLabelFr(k: PlanningDayKey): string {
  return PLANNING_DAY_LABELS_FR[k];
}

export function parseWeeklyHoursBonusFromWizard(values: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, raw] of Object.entries(values)) {
    const t = raw.trim();
    if (!t) continue;
    const n = Number(t.replace(",", "."));
    if (Number.isFinite(n) && n > 0) out[id] = Math.min(40, Math.round(n * 10) / 10);
  }
  return out;
}

export function parseMaxDailyHoursFromWizard(
  staff: StaffMember[],
  values: Record<string, string>
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const s of staff) {
    if (!s.active) continue;
    const raw = values[s.id]?.trim() ?? "";
    if (raw === "") {
      out[s.id] = null;
      continue;
    }
    const n = Number(raw.replace(",", "."));
    out[s.id] = Number.isFinite(n) && n > 0 ? Math.min(16, Math.round(n * 10) / 10) : null;
  }
  return out;
}

export function initialMaxDailyHoursFields(staff: StaffMember[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of staff) {
    if (!s.active) continue;
    out[s.id] = s.max_daily_hours != null ? String(s.max_daily_hours) : "";
  }
  return out;
}
