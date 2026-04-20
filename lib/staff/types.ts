export type StaffMember = {
  id: string;
  restaurant_id: string;
  display_name: string;
  user_id: string | null;
  /** Poste affiché (salle, cuisine…). */
  role_label: string | null;
  /** Rôle applicatif une fois le compte lié (droits menu). */
  app_role: string | null;
  /** Contrat (cdi, cdd, …). */
  contract_type: string | null;
  /** Volume horaire cible hebdomadaire. */
  target_weekly_hours: number | null;
  /** Report cumulé (minutes) : contrat − prévu sur les semaines prises en compte. */
  planning_carryover_minutes: number;
  /** Notes internes planning. */
  planning_notes: string | null;
  /** Horaires habituels / souhaités (même format que l’établissement). */
  availability_json: Record<string, unknown> | null;
  /** Prépa / travail hors service client (même structure jour → plages). */
  planning_prep_bands_json: Record<string, unknown> | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkShift = {
  id: string;
  restaurant_id: string;
  staff_member_id: string;
  starts_at: string;
  ends_at: string;
  /** Pause planifiée (minutes). */
  break_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ShiftAttendance = {
  id: string;
  work_shift_id: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  updated_at: string;
};

export type WorkShiftWithDetails = WorkShift & {
  staff_display_name: string;
  staff_role_label: string | null;
  attendance: Pick<ShiftAttendance, "clock_in_at" | "clock_out_at"> | null;
  /** Brouillon simulation (pas de pointage ; ids ≠ work_shifts). */
  isSimulationDraft?: boolean;
};
