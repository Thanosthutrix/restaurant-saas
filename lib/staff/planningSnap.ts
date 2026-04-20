/** Snap sur une grille de `stepMinutes` (ex. 15). */
export function snapLocalDateToStep(d: Date, stepMinutes: number): Date {
  const stepMs = stepMinutes * 60 * 1000;
  const t = Math.round(d.getTime() / stepMs) * stepMs;
  const out = new Date(t);
  return out;
}
