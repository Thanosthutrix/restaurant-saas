/** Jours semaine (lundi = premier jour affiché). */
export const PLANNING_DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type PlanningDayKey = (typeof PLANNING_DAY_KEYS)[number];

export const PLANNING_DAY_LABELS_FR: Record<PlanningDayKey, string> = {
  mon: "Lun",
  tue: "Mar",
  wed: "Mer",
  thu: "Jeu",
  fri: "Ven",
  sat: "Sam",
  sun: "Dim",
};

/** Alias export pour libellés courts dans les messages. */
export const PLANNING_DAY_LABELS = PLANNING_DAY_LABELS_FR;

/** Plage horaire locale HH:mm (24h). */
export type TimeBand = { start: string; end: string };

/** Carte jour → plages (midi / soir / …). */
export type OpeningHoursMap = Partial<Record<PlanningDayKey, TimeBand[]>>;

export const CONTRACT_TYPES = [
  "cdi",
  "cdd",
  "interim",
  "extra",
  "apprentissage",
  "stage",
  "autre",
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_LABELS_FR: Record<ContractType, string> = {
  cdi: "CDI",
  cdd: "CDD",
  interim: "Intérim",
  extra: "Extra / occasionnel",
  apprentissage: "Apprentissage",
  stage: "Stage",
  autre: "Autre",
};

export function isContractType(s: string | null | undefined): s is ContractType {
  return s != null && (CONTRACT_TYPES as readonly string[]).includes(s);
}

export function parseOpeningHoursJson(raw: unknown): OpeningHoursMap {
  if (raw == null || typeof raw !== "object") return {};
  const out: OpeningHoursMap = {};
  for (const k of PLANNING_DAY_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (!Array.isArray(v)) continue;
    const bands: TimeBand[] = [];
    for (const item of v) {
      if (!item || typeof item !== "object") continue;
      const start = String((item as { start?: unknown }).start ?? "").trim();
      const end = String((item as { end?: unknown }).end ?? "").trim();
      if (TIME_RE.test(start) && TIME_RE.test(end)) {
        bands.push({ start, end });
      }
    }
    if (bands.length > 0) out[k] = bands;
  }
  return out;
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function minutesFromMidnight(hhmm: string): number | null {
  const m = TIME_RE.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Compare deux HH:mm. */
export function timeCmp(a: string, b: string): number {
  const ma = minutesFromMidnight(a);
  const mb = minutesFromMidnight(b);
  if (ma == null || mb == null) return 0;
  return ma - mb;
}
