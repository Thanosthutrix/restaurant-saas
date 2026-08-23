/** Parse `AAAA-MM-JJTHH:mm` comme heure locale (formulaire datetime-local). */
export function parseLocalDateTimeInput(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error("Format date/heure attendu : AAAA-MM-JJTHH:mm.");
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0);
}
