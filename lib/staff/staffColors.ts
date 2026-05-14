/**
 * Palette de 10 couleurs collaborateurs — partagée entre le planning, l'équipe et l'avatar header.
 * L'index correspond à `staff_members.color_index` (0-9).
 * Quand `color_index` est NULL, la couleur est calculée automatiquement d'après le tri par id.
 */

export const STAFF_COLORS = [
  "bg-violet-600",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-fuchsia-600",
  "bg-lime-700",
  "bg-orange-600",
  "bg-sky-600",
  "bg-teal-600",
] as const;

/** Couleurs hex correspondantes (même ordre). Utilisées pour les styles inline (avatar, picker). */
export const STAFF_COLOR_HEX: readonly string[] = [
  "#7c3aed", // violet-600
  "#d97706", // amber-600
  "#059669", // emerald-600
  "#e11d48", // rose-600
  "#0891b2", // cyan-600
  "#c026d3", // fuchsia-600
  "#4d7c0f", // lime-700
  "#ea580c", // orange-600
  "#0284c7", // sky-600
  "#0d9488", // teal-600
];

/** Libellés lisibles pour le sélecteur de couleur. */
export const STAFF_COLOR_LABELS: readonly string[] = [
  "Violet",
  "Ambre",
  "Émeraude",
  "Rose",
  "Cyan",
  "Fuchsia",
  "Citron",
  "Orange",
  "Ciel",
  "Teal",
];

/**
 * Retourne l'index de couleur effectif pour un collaborateur.
 * Si `colorIndex` est défini (0-9), on l'utilise directement.
 * Sinon on calcule à partir du rang dans le tableau trié par id.
 */
export function resolveStaffColorIndex(
  staffId: string,
  colorIndex: number | null | undefined,
  allStaffIds: string[]
): number {
  if (colorIndex != null && colorIndex >= 0 && colorIndex <= 9) return colorIndex;
  const sorted = [...allStaffIds].sort((a, b) => a.localeCompare(b));
  const pos = sorted.indexOf(staffId);
  return pos < 0 ? 0 : pos % STAFF_COLORS.length;
}
