/** Catégories d’éléments (alignées sur le CHECK SQL + seed presets). */
export const HYGIENE_ELEMENT_CATEGORIES = [
  "plan_travail",
  "sol",
  "mur",
  "chambre_froide",
  "frigo",
  "congelateur",
  "etagere",
  "hotte",
  "four",
  "piano_plaque",
  "trancheuse",
  "machine",
  "ustensile",
  "bac_gastronorme",
  "plonge",
  "sanitaire",
  "poubelle",
  "poignee_contact",
  "zone_dechets",
  "reserve",
  "vehicule",
  "autre",
] as const;

export type HygieneElementCategory = (typeof HYGIENE_ELEMENT_CATEGORIES)[number];

export const HYGIENE_CATEGORY_LABEL_FR: Record<HygieneElementCategory, string> = {
  plan_travail: "Plan de travail",
  sol: "Sol",
  mur: "Mur",
  chambre_froide: "Chambre froide",
  frigo: "Frigo",
  congelateur: "Congélateur",
  etagere: "Étagère",
  hotte: "Hotte",
  four: "Four",
  piano_plaque: "Piano / plaque",
  trancheuse: "Trancheuse",
  machine: "Machine",
  ustensile: "Ustensile",
  bac_gastronorme: "Bac gastronorme",
  plonge: "Plonge",
  sanitaire: "Sanitaire",
  poubelle: "Poubelle",
  poignee_contact: "Poignée / point de contact",
  zone_dechets: "Zone déchets",
  reserve: "Réserve",
  vehicule: "Véhicule",
  autre: "Autre",
};

export const HYGIENE_RECURRENCE_TYPES = [
  "after_each_service",
  "daily",
  "weekly",
  "monthly",
] as const;
export type HygieneRecurrenceType = (typeof HYGIENE_RECURRENCE_TYPES)[number];

export const HYGIENE_RECURRENCE_LABEL_FR: Record<HygieneRecurrenceType, string> = {
  after_each_service: "Après chaque service (manuel)",
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
};

export const HYGIENE_RISK_LEVELS = ["critical", "important", "standard"] as const;
export type HygieneRiskLevel = (typeof HYGIENE_RISK_LEVELS)[number];

/** Poids pour le score V1 (explicable). */
export const HYGIENE_RISK_WEIGHT: Record<HygieneRiskLevel, number> = {
  standard: 1,
  important: 2,
  critical: 4,
};

export const HYGIENE_RISK_LABEL_FR: Record<HygieneRiskLevel, string> = {
  critical: "Critique",
  important: "Important",
  standard: "Standard",
};

export const HYGIENE_TASK_STATUSES = ["pending", "completed", "missed"] as const;
export type HygieneTaskStatus = (typeof HYGIENE_TASK_STATUSES)[number];

/** Type d’intervention à l’enregistrement (registre). */
export const HYGIENE_CLEANING_ACTION_TYPES = ["cleaning", "disinfection", "both"] as const;
export type HygieneCleaningActionType = (typeof HYGIENE_CLEANING_ACTION_TYPES)[number];

export const HYGIENE_CLEANING_ACTION_LABEL_FR: Record<HygieneCleaningActionType, string> = {
  cleaning: "Nettoyage",
  disinfection: "Désinfection",
  both: "Nettoyage + désinfection",
};

/** Catégories d’éléments nécessitant un relevé de température (ouverture / fermeture). */
export const HYGIENE_COLD_ELEMENT_CATEGORIES = ["chambre_froide", "frigo", "congelateur"] as const;
export type HygieneColdElementCategory = (typeof HYGIENE_COLD_ELEMENT_CATEGORIES)[number];

export const HYGIENE_COLD_EVENT_KINDS = ["opening", "closing"] as const;
export type HygieneColdEventKind = (typeof HYGIENE_COLD_EVENT_KINDS)[number];

export const HYGIENE_COLD_EVENT_LABEL_FR: Record<HygieneColdEventKind, string> = {
  opening: "Ouverture",
  closing: "Fermeture",
};

export type HygieneColdTemperatureReading = {
  id: string;
  restaurant_id: string;
  element_id: string;
  event_kind: HygieneColdEventKind;
  temperature_celsius: number;
  recorded_at: string;
  recorded_by_user_id: string | null;
  recorded_by_display: string | null;
  recorded_by_initials: string | null;
  comment: string | null;
};

export type HygieneColdTemperatureReadingWithElement = HygieneColdTemperatureReading & {
  element_name: string;
  element_category: string;
  area_label: string;
};

export type HygieneElement = {
  id: string;
  restaurant_id: string;
  name: string;
  category: string;
  area_label: string;
  description: string | null;
  risk_level: HygieneRiskLevel;
  recurrence_type: HygieneRecurrenceType;
  recurrence_day_of_week: number | null;
  recurrence_day_of_month: number | null;
  cleaning_protocol: string;
  disinfection_protocol: string;
  product_used: string | null;
  dosage: string | null;
  contact_time: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type HygieneRecurrencePreset = {
  category: string;
  default_recurrence_type: string;
  recurrence_day_of_week: number | null;
  recurrence_day_of_month: number | null;
  label_fr: string;
};

export type HygieneTask = {
  id: string;
  restaurant_id: string;
  element_id: string;
  period_key: string;
  due_at: string;
  risk_level: HygieneRiskLevel;
  status: HygieneTaskStatus;
  completed_at: string | null;
  completed_by_user_id: string | null;
  completed_by_display: string | null;
  /** Initiales saisies sur le terrain. */
  completed_by_initials: string | null;
  /** Nettoyage / désinfection / les deux. */
  cleaning_action_type: HygieneCleaningActionType | null;
  completion_comment: string | null;
  proof_photo_path: string | null;
  created_at: string;
};
