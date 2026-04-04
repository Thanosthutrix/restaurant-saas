/**
 * Périodes de vacances scolaires France (métropole), zones A / B / C.
 * Source : calendrier officiel Ministère (résumé manuel, à mettre à jour chaque rentrée).
 * Les dates sont inclusives côté élève (reprise le matin du lendemain de la fin).
 * Important : pour l’hiver et le printemps, l’ordre des créneaux (quelle zone part en premier)
 * change chaque année — ne pas recopier les zones d’une année sur l’autre sans vérifier le PDF gouv.
 */

export type SchoolZone = "A" | "B" | "C";

type Period = { from: string; to: string; label: string; zones: SchoolZone[] | "all" };

const PERIODS: Period[] = [
  /* 2024–2025 */
  { from: "2024-10-19", to: "2024-11-04", label: "Vacances de la Toussaint", zones: "all" },
  { from: "2024-12-21", to: "2025-01-06", label: "Vacances de Noël", zones: "all" },
  { from: "2025-02-08", to: "2025-02-24", label: "Vacances d’hiver", zones: ["B"] },
  { from: "2025-02-15", to: "2025-03-03", label: "Vacances d’hiver", zones: ["C"] },
  { from: "2025-02-22", to: "2025-03-10", label: "Vacances d’hiver", zones: ["A"] },
  { from: "2025-04-05", to: "2025-04-22", label: "Vacances de printemps", zones: ["B"] },
  { from: "2025-04-12", to: "2025-04-28", label: "Vacances de printemps", zones: ["C"] },
  { from: "2025-04-19", to: "2025-05-05", label: "Vacances de printemps", zones: ["A"] },
  { from: "2025-07-05", to: "2025-08-31", label: "Vacances d’été", zones: "all" },
  /* 2025–2026 */
  { from: "2025-10-18", to: "2025-11-03", label: "Vacances de la Toussaint", zones: "all" },
  { from: "2025-12-20", to: "2026-01-05", label: "Vacances de Noël", zones: "all" },
  { from: "2026-02-07", to: "2026-02-23", label: "Vacances d’hiver", zones: ["A"] },
  { from: "2026-02-14", to: "2026-03-02", label: "Vacances d’hiver", zones: ["B"] },
  { from: "2026-02-21", to: "2026-03-09", label: "Vacances d’hiver", zones: ["C"] },
  { from: "2026-04-04", to: "2026-04-20", label: "Vacances de printemps", zones: ["A"] },
  { from: "2026-04-11", to: "2026-04-27", label: "Vacances de printemps", zones: ["B"] },
  { from: "2026-04-18", to: "2026-05-04", label: "Vacances de printemps", zones: ["C"] },
  { from: "2026-07-04", to: "2026-08-31", label: "Vacances d’été", zones: "all" },
  /* 2026–2027 */
  { from: "2026-10-17", to: "2026-11-02", label: "Vacances de la Toussaint", zones: "all" },
  { from: "2026-12-19", to: "2027-01-04", label: "Vacances de Noël", zones: "all" },
  { from: "2027-02-06", to: "2027-02-22", label: "Vacances d’hiver", zones: ["C"] },
  { from: "2027-02-13", to: "2027-03-01", label: "Vacances d’hiver", zones: ["A"] },
  { from: "2027-02-20", to: "2027-03-08", label: "Vacances d’hiver", zones: ["B"] },
  { from: "2027-04-03", to: "2027-04-19", label: "Vacances de printemps", zones: ["C"] },
  { from: "2027-04-10", to: "2027-04-26", label: "Vacances de printemps", zones: ["A"] },
  { from: "2027-04-17", to: "2027-05-03", label: "Vacances de printemps", zones: ["B"] },
  { from: "2027-07-03", to: "2027-08-31", label: "Vacances d’été", zones: "all" },
];

function inRange(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}

/** Libellé de vacances pour la date et la zone, ou null. */
export function getSchoolVacationLabel(isoDate: string, zone: SchoolZone | null): string | null {
  if (!zone) return null;
  for (const p of PERIODS) {
    if (!inRange(isoDate, p.from, p.to)) continue;
    if (p.zones === "all") return `${p.label} (toutes zones)`;
    if (p.zones.includes(zone)) return `${p.label} (zone ${zone})`;
  }
  return null;
}
