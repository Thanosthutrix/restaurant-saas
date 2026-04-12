export const TEMPERATURE_POINT_TYPES = [
  "cold_storage",
  "freezer",
  "hot_holding",
  "cooling",
  "receiving",
] as const;
export type TemperaturePointType = (typeof TEMPERATURE_POINT_TYPES)[number];

export const TEMPERATURE_POINT_TYPE_LABEL_FR: Record<TemperaturePointType, string> = {
  cold_storage: "Froid positif (frigo, chambre froide)",
  freezer: "Congélation",
  hot_holding: "Maintien au chaud",
  cooling: "Refroidissement",
  receiving: "Réception",
};

export const TEMPERATURE_RECURRENCE_TYPES = ["daily", "per_service"] as const;
export type TemperatureRecurrenceType = (typeof TEMPERATURE_RECURRENCE_TYPES)[number];

export const TEMPERATURE_RECURRENCE_LABEL_FR: Record<TemperatureRecurrenceType, string> = {
  daily: "1 relevé / jour",
  per_service: "2 relevés / jour (midi & soir)",
};

export const TEMPERATURE_LOG_STATUSES = ["normal", "alert", "critical"] as const;
export type TemperatureLogStatus = (typeof TEMPERATURE_LOG_STATUSES)[number];

export const TEMPERATURE_LOG_STATUS_LABEL_FR: Record<TemperatureLogStatus, string> = {
  normal: "Normal",
  alert: "Alerte (proche seuil)",
  critical: "Critique (hors plage)",
};

export type TemperaturePoint = {
  id: string;
  restaurant_id: string;
  name: string;
  point_type: TemperaturePointType;
  location: string;
  min_threshold: number;
  max_threshold: number;
  recurrence_type: TemperatureRecurrenceType;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type TemperatureTask = {
  id: string;
  restaurant_id: string;
  temperature_point_id: string;
  period_key: string;
  due_at: string;
  status: "pending" | "completed";
  created_at: string;
};

export type TemperatureTaskWithPoint = TemperatureTask & {
  point_name: string;
  point_type: TemperaturePointType;
  location: string;
  min_threshold: number;
  max_threshold: number;
};

export type TemperatureLog = {
  id: string;
  restaurant_id: string;
  temperature_point_id: string;
  task_id: string | null;
  value: number;
  log_status: TemperatureLogStatus;
  recorded_by_user_id: string | null;
  recorded_by_display: string | null;
  comment: string | null;
  corrective_action: string | null;
  product_impact: string | null;
  created_at: string;
};

export type TemperatureLogWithPoint = TemperatureLog & {
  point_name: string;
  point_type: TemperaturePointType;
};
