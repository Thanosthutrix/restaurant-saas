/** Normalisation légère pour dédoublonnage / index (chiffres, mobile FR → préfixe 33). */
export function normalizePhoneForDedup(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 0) return null;
  if (d.startsWith("33") && d.length >= 11) return d;
  if (d.startsWith("0") && d.length === 10) return `33${d.slice(1)}`;
  if (d.startsWith("0033")) return d.replace(/^0033/, "33");
  return d;
}
