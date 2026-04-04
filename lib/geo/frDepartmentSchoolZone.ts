/**
 * Zone de vacances scolaires (calendrier national) à partir du département métropolitain.
 * Répartition académique (hors DOM), alignée sur le calendrier Ministère (groupes A / B / C).
 */

import type { SchoolZone } from "@/lib/calendar/schoolVacationsFr";

/** Île-de-France → zone C */
const ZONE_C = new Set([
  "75",
  "77",
  "78",
  "91",
  "92",
  "93",
  "94",
  "95",
]);

/**
 * Académies en zone A (hors IDF) : Besançon, Bordeaux, Clermont, Dijon, Grenoble, Limoges, Lyon, Poitiers, Toulouse.
 */
const ZONE_A = new Set([
  "01",
  "03",
  "07",
  "09",
  "12",
  "15",
  "16",
  "17",
  "19",
  "21",
  "23",
  "24",
  "25",
  "26",
  "31",
  "32",
  "33",
  "38",
  "39",
  "40",
  "42",
  "43",
  "46",
  "47",
  "58",
  "63",
  "64",
  "65",
  "69",
  "70",
  "71",
  "73",
  "74",
  "79",
  "81",
  "82",
  "86",
  "87",
  "89",
  "90",
]);

/** Code département depuis code postal français (métropole + Corse). */
export function departmentFromFrenchPostcode(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const p = String(postcode).replace(/\s/g, "");
  if (!/^\d{5}$/.test(p)) return null;
  if (p.startsWith("97") || p.startsWith("98")) return p.slice(0, 3);
  if (p.startsWith("20")) {
    const n = parseInt(p.slice(0, 3), 10);
    if (n >= 200 && n <= 201) return "2A";
    return "2B";
  }
  return p.slice(0, 2);
}

export function schoolZoneFromDepartment(dep: string | null): SchoolZone | null {
  if (!dep) return null;
  const d = dep.toUpperCase();
  if (ZONE_C.has(d)) return "C";
  if (d === "2A" || d === "2B") return "B";
  if (!/^\d{2}$/.test(d)) return null;
  if (ZONE_A.has(d)) return "A";
  return "B";
}
