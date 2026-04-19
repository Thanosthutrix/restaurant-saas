import { parseTimeBandsArray } from "@/lib/staff/planningResolve";
import type { TimeBand } from "@/lib/staff/planningHoursTypes";

export type PlanningBandPreset = {
  id: string;
  label: string;
  bands: TimeBand[];
  /** ETP optionnel : appliqué avec ce modèle au calendrier (fériés / vacances). */
  etp?: number | null;
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

export function findPresetMatchingBands(
  presets: PlanningBandPreset[],
  bands: TimeBand[] | null
): PlanningBandPreset | null {
  if (!bands || bands.length === 0) return null;
  const sig = bandsSignature(bands);
  return presets.find((p) => bandsSignature(p.bands) === sig) ?? null;
}

/** Preset dont les plages et l’ETP coïncident avec une ligne d’exception (calendrier guidé). */
export function findPresetForCalendarRow(
  presets: PlanningBandPreset[],
  bands: TimeBand[] | null,
  staffTarget: number | null
): PlanningBandPreset | null {
  if (!bands?.length) return null;
  const bSig = bandsSignature(bands);
  const rowEtp =
    staffTarget != null && Number.isFinite(Number(staffTarget)) ? round2(Number(staffTarget)) : null;
  for (const p of presets) {
    if (bandsSignature(p.bands) !== bSig) continue;
    const pEtp = p.etp != null && Number.isFinite(Number(p.etp)) ? round2(Number(p.etp)) : null;
    if (pEtp === rowEtp) return p;
  }
  return null;
}

/**
 * Parse et valide le JSON stocké en base (liste de modèles).
 * Limite : 30 modèles, 12 plages par modèle.
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
    const bandsRaw = rec.bands;
    const parsed = parseTimeBandsArray(bandsRaw);
    if (parsed == null || parsed.length === 0) continue;
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
      bands: parsed.slice(0, 12),
      etp,
    });
  }
  return out;
}

export function emptyPresetDraft(): PlanningBandPreset {
  return {
    id: randomId(),
    label: "",
    bands: [{ start: "11:30", end: "14:30" }],
    etp: null,
  };
}
