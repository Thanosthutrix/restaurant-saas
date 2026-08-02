/**
 * Utilitaires du seed de démo : dates murales Paris, aléatoire reproductible,
 * et petites aides d'écriture en base.
 */

const PARIS = "Europe/Paris";

/** Décalage Paris↔UTC (en minutes) pour un instant donné. */
function parisOffsetMinutes(utcMs: number): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") o[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(o.year), Number(o.month) - 1, Number(o.day),
    Number(o.hour === "24" ? "00" : o.hour), Number(o.minute), Number(o.second)
  );
  return (asUtc - utcMs) / 60000;
}

/**
 * Convertit une heure murale Paris (AAAA-MM-JJ + HH:MM) en instant ISO UTC.
 * Gère le passage heure d'été / heure d'hiver.
 */
export function parisToUtcIso(dateYmd: string, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const naive = Date.parse(`${dateYmd}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  // Première approximation, puis correction (le décalage dépend de l'instant réel).
  let guess = naive - parisOffsetMinutes(naive) * 60000;
  guess = naive - parisOffsetMinutes(guess) * 60000;
  return new Date(guess).toISOString();
}

/** Date civile AAAA-MM-JJ. */
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateYmd: string, n: number): string {
  const d = new Date(`${dateYmd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

export function dayOfWeek(dateYmd: string): number {
  return new Date(`${dateYmd}T12:00:00.000Z`).getUTCDay();
}

/** Lundi de la semaine contenant `dateYmd`. */
export function mondayOf(dateYmd: string): string {
  const dow = dayOfWeek(dateYmd);
  return addDays(dateYmd, dow === 0 ? -6 : 1 - dow);
}

/** Toutes les dates de `from` à `to` incluses. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// ALÉATOIRE REPRODUCTIBLE
// ---------------------------------------------------------------------------

/** PRNG déterministe : deux exécutions du seed produisent le même restaurant. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Entier dans [min, max] inclus. */
export function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Flottant arrondi à `decimals`. */
export function randFloat(rng: () => number, min: number, max: number, decimals = 1): number {
  const v = min + rng() * (max - min);
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/** Tire un élément selon des poids (mix de ventes réaliste). */
export function weightedPick<T>(rng: () => number, items: { item: T; weight: number }[]): T {
  const total = items.reduce((a, i) => a + i.weight, 0);
  let r = rng() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i.item;
  }
  return items[items.length - 1].item;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// ÉCRITURE EN BASE
// ---------------------------------------------------------------------------

/** Insère par paquets pour éviter les requêtes trop volumineuses. */
export async function insertChunked(
  sb: { from: (t: string) => { insert: (rows: unknown[]) => Promise<{ error: { message: string } | null }> } },
  table: string,
  rows: unknown[],
  chunkSize = 500
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error } = await sb.from(table).insert(slice);
    if (error) {
      throw new Error(`Insertion ${table} (lot ${i / chunkSize + 1}) : ${error.message}`);
    }
  }
}
