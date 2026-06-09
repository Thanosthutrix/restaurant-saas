import type { PlanningDayKey, TimeBand } from "@/lib/staff/planningHoursTypes";
import type { PeakBandWeeklyEntry } from "@/lib/staff/planningPeakBands";
import type { ShiftPattern } from "@/lib/staff/types";
import type { HydratedField } from "./wizardFieldTypes";

export type { ShiftPattern };

// ── Étape 1 : Cadre établissement ───────────────────────────────────────────

export interface DetectedCalendarDay {
  ymd: string;
  dayKey: PlanningDayKey;
  kind: "public_holiday" | "school_vacation";
  label: string;
}

export interface EstablishmentDayFrame {
  dayKey: PlanningDayKey;
  ymd: string;
  /** [] = jour fermé (ouverture + hors client vides). */
  isClosed: boolean;
  openingBands: HydratedField<TimeBand[]>;
  staffExtraBands: HydratedField<TimeBand[]>;
  /** Effectif cible simultané (modèle établissement ou suggestion, min. talon de sécurité). */
  staffTarget: HydratedField<number>;
}

export interface EstablishmentFrameData {
  establishmentType: HydratedField<string>; // template_slug
  days: EstablishmentDayFrame[];
  securityFloor: HydratedField<number>; // talon de sécurité
  /** Détecté par le calendrier global (lecture seule, computed). */
  detectedCalendar: DetectedCalendarDay[];
}

// ── Étape 2 : Profil équipe & contrats ──────────────────────────────────────

export interface TeamMemberDraft {
  staffMemberId: string;
  displayName: string; // non éditable ici
  active: boolean;
  role: HydratedField<string>; // role_label
  contractWeeklyHours: HydratedField<number>; // target_weekly_hours (required)
  maxDailyHours: HydratedField<number>; // 0 = illimité
  defaultShiftPattern: HydratedField<ShiftPattern>;
}

export interface TeamProfileData {
  members: TeamMemberDraft[];
}

// ── Étape 3 : Contraintes humaines & légales ────────────────────────────────

export interface LeaveEntry {
  ymd: string;
  kind: "leave" | "unavailable";
  label: string;
}

export interface RestRuleDraft {
  staffMemberId: string;
  fixedRestDays: HydratedField<PlanningDayKey[]>; // ex: ["mon"]
  weeklyRestDays: HydratedField<number>; // nombre de jours off souhaités / semaine
  requireConsecutive: HydratedField<boolean>;
}

export interface HumanConstraintsData {
  /** Congés/indispos datés par employé (computed depuis staff_leave). */
  leavesByStaffId: Record<string, LeaveEntry[]>;
  restRulesByStaffId: Record<string, RestRuleDraft>;
}

// ── Étape 4 : Besoin staff prédictif ────────────────────────────────────────

export interface StaffingAdjustments {
  heatwave: boolean; // « Alerte Canicule »
  highTraffic: boolean; // « Forte Affluence »
}

export interface BaseNeedSlot {
  /** Minutes depuis minuit (pas de 30 min). */
  minute: number;
  need: number;
}

export interface StaffingNeedData {
  peakBandsByDay: Partial<Record<PlanningDayKey, HydratedField<PeakBandWeeklyEntry[]>>>;
  adjustments: StaffingAdjustments;
  /** Besoin de base h/h calculé (computed, recalculé selon adjustments). */
  baseNeedByDay: Partial<Record<PlanningDayKey, BaseNeedSlot[]>>;
}

// ── Agrégat racine ──────────────────────────────────────────────────────────

export interface WizardData {
  restaurantId: string;
  weekMondayYmd: string;
  establishment: EstablishmentFrameData;
  team: TeamProfileData;
  constraints: HumanConstraintsData;
  staffing: StaffingNeedData;
}
