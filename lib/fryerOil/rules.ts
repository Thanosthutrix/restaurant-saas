import type { FryerOilLogStatus, FryerUnit } from "./types";
import { FRYER_OIL_DEFAULTS } from "./types";

/** Marge °C pour alerte température huile (proche limite). */
export const FRYER_OIL_TEMP_ALERT_MARGIN_C = 5;

export function classifyOilTemperatureStatus(
  value: number,
  minC: number,
  maxC: number
): FryerOilLogStatus {
  if (value < minC || value > maxC) return "critical";
  if (
    value - minC <= FRYER_OIL_TEMP_ALERT_MARGIN_C ||
    maxC - value <= FRYER_OIL_TEMP_ALERT_MARGIN_C
  ) {
    return "alert";
  }
  return "normal";
}

export function classifyTpmStatus(
  tpmPercent: number,
  unit: Pick<FryerUnit, "tpm_alert_threshold_pct" | "tpm_change_threshold_pct">
): { status: FryerOilLogStatus; changeRequired: boolean } {
  if (tpmPercent >= unit.tpm_change_threshold_pct) {
    return { status: "critical", changeRequired: true };
  }
  if (tpmPercent >= unit.tpm_alert_threshold_pct) {
    return { status: "alert", changeRequired: false };
  }
  return { status: "normal", changeRequired: false };
}

/** Statut global = le plus sévère parmi TPM, température et qualité. */
export function classifyFryerOilCheck(params: {
  unit: FryerUnit;
  tpmPercent: number | null;
  oilTemperatureCelsius: number;
  qualityOk: boolean;
  filtrationDone: boolean;
}): {
  logStatus: FryerOilLogStatus;
  changeOilRequired: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let logStatus: FryerOilLogStatus = "normal";
  let changeOilRequired = false;

  const bump = (next: FryerOilLogStatus) => {
    if (next === "critical") logStatus = "critical";
    else if (next === "alert" && logStatus === "normal") logStatus = "alert";
  };

  if (params.tpmPercent != null && Number.isFinite(params.tpmPercent)) {
    const tpm = classifyTpmStatus(params.tpmPercent, params.unit);
    bump(tpm.status);
    if (tpm.changeRequired) changeOilRequired = true;
  }

  const tempStatus = classifyOilTemperatureStatus(
    params.oilTemperatureCelsius,
    params.unit.oil_temp_min_celsius,
    params.unit.oil_temp_max_celsius
  );
  bump(tempStatus);

  if (!params.qualityOk) {
    bump("alert");
    warnings.push("Qualité huile signalée (odeur, mousse ou fumée).");
  }

  if (!params.filtrationDone) {
    warnings.push("Filtration non effectuée aujourd'hui.");
  }

  if (!params.qualityOk && params.tpmPercent != null && params.tpmPercent >= params.unit.tpm_alert_threshold_pct) {
    changeOilRequired = true;
    logStatus = "critical";
  }

  return { logStatus, changeOilRequired, warnings };
}

export function requiresCorrectiveFields(status: FryerOilLogStatus): boolean {
  return status === "alert" || status === "critical";
}

export function parseTpmInput(
  raw: string
): { ok: true; value: number } | { ok: false; error: string } {
  const s = raw.trim().replace(",", ".").replace(/\s+/g, "").replace("%", "");
  if (s === "") return { ok: false, error: "Indiquez le taux TPM." };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 40) {
    return { ok: false, error: "TPM invalide (0 à 40 %)." };
  }
  return { ok: true, value: Math.round(n * 10) / 10 };
}

export function parseOilTemperatureInput(
  raw: string
): { ok: true; value: number } | { ok: false; error: string } {
  const s = raw.trim().replace(",", ".").replace(/\s+/g, "");
  if (s === "") return { ok: false, error: "Indiquez la température de l'huile." };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 80 || n > 220) {
    return { ok: false, error: "Température invalide (80 à 220 °C)." };
  }
  return { ok: true, value: Math.round(n * 10) / 10 };
}

export function defaultFryerUnitThresholds() {
  return {
    oil_temp_min_celsius: FRYER_OIL_DEFAULTS.oilTempMin,
    oil_temp_max_celsius: FRYER_OIL_DEFAULTS.oilTempMax,
    tpm_alert_threshold_pct: FRYER_OIL_DEFAULTS.tpmAlertPct,
    tpm_change_threshold_pct: FRYER_OIL_DEFAULTS.tpmChangePct,
  };
}
