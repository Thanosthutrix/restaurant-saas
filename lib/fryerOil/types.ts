export const FRYER_RECURRENCE_TYPES = ["daily", "per_service"] as const;
export type FryerRecurrenceType = (typeof FRYER_RECURRENCE_TYPES)[number];

export const FRYER_RECURRENCE_LABEL_FR: Record<FryerRecurrenceType, string> = {
  daily: "1 contrôle / jour",
  per_service: "2 contrôles / jour (midi & soir)",
};

export const FRYER_OIL_LOG_STATUSES = ["normal", "alert", "critical"] as const;
export type FryerOilLogStatus = (typeof FRYER_OIL_LOG_STATUSES)[number];

export const FRYER_OIL_LOG_STATUS_LABEL_FR: Record<FryerOilLogStatus, string> = {
  normal: "Conforme",
  alert: "Alerte",
  critical: "Changement d'huile requis",
};

export const TPM_TEST_METHODS = ["strip", "meter", "visual_estimated"] as const;
export type TpmTestMethod = (typeof TPM_TEST_METHODS)[number];

export const TPM_TEST_METHOD_LABEL_FR: Record<TpmTestMethod, string> = {
  strip: "Bandelette TPM",
  meter: "Appareil TPM (testeur)",
  visual_estimated: "Estimation visuelle / couleur",
};

export const OIL_BATCH_END_REASONS = ["tpm_threshold", "quality", "scheduled", "other"] as const;
export type OilBatchEndReason = (typeof OIL_BATCH_END_REASONS)[number];

export const OIL_BATCH_END_REASON_LABEL_FR: Record<OilBatchEndReason, string> = {
  tpm_threshold: "Seuil TPM atteint",
  quality: "Qualité dégradée",
  scheduled: "Changement programmé",
  other: "Autre",
};

export type FryerUnit = {
  id: string;
  restaurant_id: string;
  name: string;
  location: string;
  capacity_liters: number | null;
  oil_temp_min_celsius: number;
  oil_temp_max_celsius: number;
  tpm_alert_threshold_pct: number;
  tpm_change_threshold_pct: number;
  recurrence_type: FryerRecurrenceType;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type FryerOilBatch = {
  id: string;
  restaurant_id: string;
  fryer_unit_id: string;
  started_at: string;
  ended_at: string | null;
  end_reason: OilBatchEndReason | null;
  oil_product_name: string | null;
  initial_volume_liters: number | null;
  recorded_by_display: string | null;
  notes: string | null;
  created_at: string;
};

export type FryerOilTask = {
  id: string;
  restaurant_id: string;
  fryer_unit_id: string;
  period_key: string;
  due_at: string;
  status: "pending" | "completed";
  created_at: string;
};

export type FryerOilTaskWithUnit = FryerOilTask & {
  unit_name: string;
  location: string;
  oil_temp_min_celsius: number;
  oil_temp_max_celsius: number;
  tpm_alert_threshold_pct: number;
  tpm_change_threshold_pct: number;
};

export type FryerOilLog = {
  id: string;
  restaurant_id: string;
  fryer_unit_id: string;
  oil_batch_id: string | null;
  task_id: string | null;
  tpm_percent: number | null;
  tpm_test_method: TpmTestMethod;
  oil_temperature_celsius: number;
  filtration_done: boolean;
  quality_ok: boolean;
  quality_issues: string | null;
  log_status: FryerOilLogStatus;
  change_oil_required: boolean;
  oil_changed: boolean;
  recorded_by_user_id: string | null;
  recorded_by_display: string | null;
  comment: string | null;
  corrective_action: string | null;
  created_at: string;
};

export type FryerOilLogWithUnit = FryerOilLog & {
  unit_name: string;
};

/** Seuils réglementaires / DGCCRF — valeurs par défaut des friteuses. */
export const FRYER_OIL_DEFAULTS = {
  oilTempMin: 160,
  oilTempMax: 190,
  tpmAlertPct: 22,
  tpmChangePct: 25,
} as const;
