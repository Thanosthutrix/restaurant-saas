/** Formatage des rubriques NEODeS (DSN). */

export const DSN_NORM_VERSION = "P26V01";
export const DSN_SOFTWARE_NAME = "Restaurant SaaS";
export const DSN_EDITOR_NAME = "Restaurant SaaS";

export function dsnLine(rubrique: string, value: string | number): string {
  const v = typeof value === "number" ? formatAmount(value) : escapeDsnValue(value);
  return `${rubrique},'${v}'`;
}

export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "0.00";
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function formatDsnDateYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}${m}${y}`;
}

export function formatDsnMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${m}${y}`;
}

export function monthBoundsDsn(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: formatDsnDateYmd(`${ym}-01`),
    end: formatDsnDateYmd(`${ym}-${String(lastDay).padStart(2, "0")}`),
  };
}

export function parseSiret(siret: string): { siren: string; nic: string; siret14: string } | null {
  const clean = siret.replace(/\s/g, "");
  if (!/^\d{14}$/.test(clean)) return null;
  return { siren: clean.slice(0, 9), nic: clean.slice(9, 14), siret14: clean };
}

export function cleanNir(nir: string): string | null {
  const clean = nir.replace(/\s/g, "");
  if (!/^\d{13,15}$/.test(clean)) return null;
  return clean.slice(0, 15);
}

function escapeDsnValue(value: string): string {
  return value.replace(/'/g, " ").trim().slice(0, 200);
}

export function encodeDsnLatin1(content: string): Buffer {
  return Buffer.from(content, "latin1");
}
