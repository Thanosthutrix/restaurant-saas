import { readFileSync } from "fs";
import { join } from "path";

export type SchoolVacationPeriod = {
  /** Stable id for React keys */
  id: string;
  name: string;
  start: string;
  end: string;
  /** Tous les jours calendaires de la période (zone + année scolaire concernée). */
  days: string[];
};

let cachedLines: string[] | null = null;

function getCsvLines(): string[] {
  if (cachedLines) return cachedLines;
  const p = join(process.cwd(), "lib/franceCalendars/vacances-scolaires-data.csv");
  const raw = readFileSync(p, "utf8");
  cachedLines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  return cachedLines;
}

function parseRow(line: string): {
  date: string;
  zoneA: boolean;
  zoneB: boolean;
  zoneC: boolean;
  name: string;
} | null {
  const m = /^(\d{4}-\d{2}-\d{2}),(True|False),(True|False),(True|False),(.*)$/.exec(line);
  if (!m) return null;
  return {
    date: m[1],
    zoneA: m[2] === "True",
    zoneB: m[3] === "True",
    zoneC: m[4] === "True",
    name: m[5].trim(),
  };
}

function zoneCol(zone: "A" | "B" | "C", row: { zoneA: boolean; zoneB: boolean; zoneC: boolean }): boolean {
  if (zone === "A") return row.zoneA;
  if (zone === "B") return row.zoneB;
  return row.zoneC;
}

/**
 * Regroupe les jours consécutifs de vacances (même libellé) pour une zone.
 * Données : jeu data.gouv « vacances scolaires par zones » (fichier CSV filtré 2024–2030).
 */
export function listSchoolVacationPeriods(year: number, zone: "A" | "B" | "C"): SchoolVacationPeriod[] {
  const lines = getCsvLines();
  const rows: { date: string; name: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const p = parseRow(lines[i]);
    if (!p) continue;
    if (!p.date.startsWith(String(year))) continue;
    if (!zoneCol(zone, p) || !p.name) continue;
    rows.push({ date: p.date, name: p.name });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  const periods: SchoolVacationPeriod[] = [];
  let cur: { name: string; start: string; end: string; days: string[] } | null = null;

  function flush() {
    if (!cur || cur.days.length === 0) return;
    const slug = cur.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const id = `${year}-${zone}-${slug}-${cur.start}`;
    periods.push({
      id,
      name: cur.name,
      start: cur.start,
      end: cur.end,
      days: [...cur.days],
    });
    cur = null;
  }

  for (const r of rows) {
    const prev = cur;
    const prevEnd = prev
      ? new Date(prev.end + "T12:00:00")
      : null;
    const thisD = new Date(r.date + "T12:00:00");
    const contiguous =
      prev &&
      prev.name === r.name &&
      prevEnd &&
      (thisD.getTime() - prevEnd.getTime()) / 86400000 === 1;

    if (contiguous && cur) {
      cur.end = r.date;
      cur.days.push(r.date);
    } else {
      flush();
      cur = { name: r.name, start: r.date, end: r.date, days: [r.date] };
    }
  }
  flush();

  return periods;
}
