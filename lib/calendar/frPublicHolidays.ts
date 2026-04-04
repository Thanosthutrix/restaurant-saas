/**
 * Jours fériés métropole (décret) : fixes + Pâques, Ascension, Lundi de Pentecôte.
 * Réf. algorithmes usuels (Meeus) pour Pâques.
 */

function easterSundayUtc(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoFromYmd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

const FIXED: Record<string, string> = {
  "01-01": "Jour de l’an",
  "05-01": "Fête du travail",
  "05-08": "Victoire 1945",
  "07-14": "Fête nationale",
  "08-15": "Assomption",
  "11-01": "Toussaint",
  "11-11": "Armistice 1918",
};

/** Nom du jour férié pour une date locale YYYY-MM-DD, ou null. */
export function getFrenchPublicHolidayName(isoDate: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const md = `${m[2]}-${m[3]}`;
  if (FIXED[md]) return FIXED[md];

  const e = easterSundayUtc(y);
  const easter = new Date(Date.UTC(y, e.month - 1, e.day));
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  };
  const mondayEaster = addDays(easter, 1);
  const ascension = addDays(easter, 39);
  const whitMonday = addDays(easter, 50);

  const cur = new Date(Date.UTC(y, mm - 1, dd));
  const same = (a: Date, b: Date) =>
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();

  if (same(cur, mondayEaster)) return "Lundi de Pâques";
  if (same(cur, ascension)) return "Ascension";
  if (same(cur, whitMonday)) return "Lundi de Pentecôte";

  return null;
}
