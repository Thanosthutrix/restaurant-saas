import type { TemperatureLogStatus } from "./types";

/** Marge (°C) par rapport aux seuils pour classer une mesure en « alerte » sans être hors plage. */
export const HACCP_TEMPERATURE_ALERT_MARGIN_C = 1;

/**
 * Classe une valeur mesurée selon min/max du point.
 * - critical : hors plage
 * - alert : dans la plage mais à moins de `HACCP_TEMPERATURE_ALERT_MARGIN_C` d’une borne
 * - normal : sinon
 */
export function classifyTemperatureStatus(
  value: number,
  minThreshold: number,
  maxThreshold: number
): TemperatureLogStatus {
  if (value < minThreshold || value > maxThreshold) return "critical";
  if (
    value - minThreshold <= HACCP_TEMPERATURE_ALERT_MARGIN_C ||
    maxThreshold - value <= HACCP_TEMPERATURE_ALERT_MARGIN_C
  ) {
    return "alert";
  }
  return "normal";
}

export function requiresCorrectiveFields(status: TemperatureLogStatus): boolean {
  return status === "alert" || status === "critical";
}

export function parseTemperatureInput(
  raw: string
): { ok: true; value: number } | { ok: false; error: string } {
  const s = raw.trim().replace(",", ".").replace(/\s+/g, "");
  if (s === "") return { ok: false, error: "Indiquez la température." };
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false, error: "Valeur invalide." };
  return { ok: true, value: Math.round(n * 100) / 100 };
}
