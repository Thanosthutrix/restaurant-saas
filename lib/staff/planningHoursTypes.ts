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
      const startN = normalizeClockToHhMm(start);
      const endN = normalizeClockToHhMm(end);
      if (startN && endN) {
        bands.push({ start: startN, end: endN });
      }
    }
    if (bands.length > 0) out[k] = bands;
  }
  return out;
}

/**
 * Accepte HH:mm, HH:mm:ss (saisie navigateur, JSON, imports) et renvoie HH:mm canonique.
 * Les secondes sont ignorées (heure « murale » locale).
 */
export function normalizeClockToHhMm(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?:\.\d+)?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function minutesFromMidnight(hhmm: string): number | null {
  const n = normalizeClockToHhMm(hhmm);
  if (!n) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(n);
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
