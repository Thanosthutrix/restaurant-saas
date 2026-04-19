"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import { isAppRole } from "@/lib/auth/appRoles";
import { consumeStaffInvite, createStaffInviteRecord, getStaffInviteByToken } from "@/lib/staff/inviteDb";
import { generateAutoSimulationShifts } from "@/lib/staff/autoSimulation";
import { resolveWeekPlanningDays } from "@/lib/staff/planningResolve";
import { addDays, parseISODateLocal, toISODateString } from "@/lib/staff/weekUtils";
import {
  getPlanningWeekSimulation,
  getRestaurantPlanningOpeningHours,
  getRestaurantPlanningStaffTargetsWeekly,
  getStaffMemberById,
  getStaffMemberByUserAndRestaurant,
  getWorkShiftById,
  listPlanningDayOverridesInRange,
  listSimulationShiftsWithDetails,
  listStaffMembers,
} from "@/lib/staff/staffDb";
import {
  CONTRACT_TYPES,
  isContractType,
  parseOpeningHoursJson,
} from "@/lib/staff/planningHoursTypes";
import { supabaseServer } from "@/lib/supabaseServer";

async function assertRestaurantOwner(userId: string, restaurantId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .eq("owner_id", userId)
    .maybeSingle();
  return Boolean(data);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parse `AAAA-MM-JJTHH:mm` comme heure locale (formulaire datetime-local). */
function parseLocalDateTimeInput(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error("Format date/heure attendu : AAAA-MM-JJTHH:mm.");
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    0,
    0
  );
}

export async function createStaffMemberAction(
  restaurantId: string,
  payload: { displayName: string; roleLabel?: string | null }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "staff.manage");
  if (!gate.ok) return gate;
  const name = payload.displayName?.trim();
  if (!name) return { ok: false, error: "Le nom est requis." };

  const { data, error } = await supabaseServer
    .from("staff_members")
    .insert({
      restaurant_id: restaurantId,
      display_name: name,
      role_label: payload.roleLabel?.trim() || null,
      app_role: "lecture_seule",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Insertion impossible." };
  revalidatePath("/equipe");
  return { ok: true, id: (data as { id: string }).id };
}

export async function deactivateStaffMemberAction(
  restaurantId: string,
  staffMemberId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "staff.manage");
  if (!gate.ok) return gate;

  const { error } = await supabaseServer
    .from("staff_members")
    .update({ active: false })
    .eq("id", staffMemberId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipe");
  return { ok: true };
}

export async function updateStaffAppRoleAction(
  restaurantId: string,
  staffMemberId: string,
  appRole: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "staff.manage");
  if (!gate.ok) return gate;

  const role = appRole?.trim() || null;
  if (role && !isAppRole(role)) {
    return { ok: false, error: "Rôle applicatif invalide." };
  }

  const { error } = await supabaseServer
    .from("staff_members")
    .update({ app_role: role })
    .eq("id", staffMemberId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipe");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Associe le compte connecté à une fiche collaborateur (pour pointer depuis « Mon planning »). */
export async function linkMyAccountToStaffAction(
  restaurantId: string,
  staffMemberId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "staff.manage");
  if (!gate.ok) return gate;

  const row = await getStaffMemberById(restaurantId, staffMemberId);
  if (!row) return { ok: false, error: "Collaborateur introuvable." };
  if (row.user_id && row.user_id !== user.id) {
    return { ok: false, error: "Cette fiche est déjà liée à un autre compte." };
  }

  const { error } = await supabaseServer
    .from("staff_members")
    .update({ user_id: user.id })
    .eq("id", staffMemberId)
    .eq("restaurant_id", restaurantId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ce compte est déjà lié à une autre fiche dans ce restaurant." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/equipe");
  revalidatePath("/equipe/mon-planning");
  return { ok: true };
}

/** Retire le compte associé à une fiche (gérant uniquement). */
export async function clearStaffUserLinkAction(
  restaurantId: string,
  staffMemberId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "staff.manage");
  if (!gate.ok) return gate;

  const { error } = await supabaseServer
    .from("staff_members")
    .update({ user_id: null })
    .eq("id", staffMemberId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipe");
  revalidatePath("/equipe/mon-planning");
  return { ok: true };
}

export async function updateRestaurantOpeningHoursAction(
  restaurantId: string,
  hours: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "planning.mutate");
  if (!gate.ok) return gate;

  const parsed = parseOpeningHoursJson(hours);
  const { error } = await supabaseServer
    .from("restaurants")
    .update({ planning_opening_hours: parsed })
    .eq("id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipe");
  revalidatePath(`/restaurants/${restaurantId}/edit`);
  return { ok: true };
}

export async function updateStaffPlanningProfileAction(
  restaurantId: string,
  staffMemberId: string,
  payload: {
    contractType: string | null;
    targetWeeklyHours: number | null;
    planningNotes: string | null;
    availability: unknown;
    prepBands: unknown;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "staff.manage");
  if (!gate.ok) return gate;

  const ct = payload.contractType?.trim() || null;
  if (ct && !isContractType(ct)) {
    return { ok: false, error: `Type de contrat invalide (${CONTRACT_TYPES.join(", ")}).` };
  }

  let target: number | null = null;
  if (payload.targetWeeklyHours != null) {
    const n = Number(payload.targetWeeklyHours);
    if (!Number.isFinite(n) || n < 0 || n > 80) {
      return { ok: false, error: "Volume horaire cible invalide (0 à 80 h)." };
    }
    target = Math.round(n * 10) / 10;
  }

  const notes = payload.planningNotes?.trim() || null;
  const availability = parseOpeningHoursJson(payload.availability);
  const prepBands = parseOpeningHoursJson(payload.prepBands);

  const { error } = await supabaseServer
    .from("staff_members")
    .update({
      contract_type: ct,
      target_weekly_hours: target,
      planning_notes: notes,
      availability_json: availability,
      planning_prep_bands_json: prepBands,
    })
    .eq("id", staffMemberId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipe");
  return { ok: true };
}

export async function createWorkShiftAction(
  restaurantId: string,
  payload: {
    staffMemberId: string;
    startsAtLocal: string;
    endsAtLocal: string;
    notes?: string | null;
    breakMinutes?: number | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "planning.mutate");
  if (!gate.ok) return gate;

  let starts: Date;
  let ends: Date;
  try {
    starts = parseLocalDateTimeInput(payload.startsAtLocal);
    ends = parseLocalDateTimeInput(payload.endsAtLocal);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Date invalide." };
  }
  if (!(ends > starts)) return { ok: false, error: "La fin doit être après le début." };

  const sm = await getStaffMemberById(restaurantId, payload.staffMemberId);
  if (!sm?.active) return { ok: false, error: "Collaborateur invalide ou inactif." };

  let breakM: number | null = null;
  if (payload.breakMinutes != null) {
    const b = Number(payload.breakMinutes);
    if (!Number.isFinite(b) || b < 0 || b > 600) {
      return { ok: false, error: "Pause : nombre de minutes invalide (0 à 600)." };
    }
    breakM = b;
  }

  const { data, error } = await supabaseServer
    .from("work_shifts")
    .insert({
      restaurant_id: restaurantId,
      staff_member_id: payload.staffMemberId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      break_minutes: breakM,
      notes: payload.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Création impossible." };
  revalidatePath("/equipe");
  revalidatePath("/equipe/mon-planning");
  return { ok: true, id: (data as { id: string }).id };
}

function weekRangeIsoFromMondayYmd(weekMondayYmd: string): { startIso: string; endExclusiveIso: string } | null {
  const monday = parseISODateLocal(weekMondayYmd.trim());
  if (!monday) return null;
  const end = addDays(monday, 7);
  return { startIso: monday.toISOString(), endExclusiveIso: end.toISOString() };
}

/** Brouillon : une simulation par restaurant et par semaine (lundi). */
export async function createWeekSimulationAction(
  restaurantId: string,
  weekMondayYmd: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "planning.mutate");
  if (!gate.ok) return gate;

  const ymd = weekMondayYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { ok: false, error: "Semaine invalide." };

  const existing = await getPlanningWeekSimulation(restaurantId, ymd);
  if (existing) return { ok: true, id: existing.id };

  const { data, error } = await supabaseServer
    .from("planning_week_simulations")
    .insert({ restaurant_id: restaurantId, week_monday: ymd })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const again = await getPlanningWeekSimulation(restaurantId, ymd);
    if (again) return { ok: true, id: again.id };
  }
  if (error || !data) return { ok: false, error: error?.message ?? "Création impossible." };
  revalidatePath("/equipe");
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * Remplit le brouillon de simulation à partir des horaires d’ouverture, objectifs d’effectif (par jour)
 * et disponibilités / volumes cibles des fiches équipe. Efface les créneaux simulés existants puis régénère.
 */
export async function generateAutoSimulationShiftsAction(
  restaurantId: string,
  weekMondayYmd: string
): Promise<{ ok: true; generatedCount: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "planning.mutate");
  if (!gate.ok) return gate;

  const ymd = weekMondayYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { ok: false, error: "Semaine invalide." };

  const monday = parseISODateLocal(ymd);
  if (!monday) return { ok: false, error: "Semaine invalide." };

  const weekEndExclusive = addDays(monday, 7);
  const weekFromYmd = toISODateString(monday);
  const weekToYmdExclusive = toISODateString(weekEndExclusive);

  const [staff, openingHours, staffTargetsWeekly, overrides] = await Promise.all([
    listStaffMembers(restaurantId, true),
    getRestaurantPlanningOpeningHours(restaurantId),
    getRestaurantPlanningStaffTargetsWeekly(restaurantId),
    listPlanningDayOverridesInRange(restaurantId, weekFromYmd, weekToYmdExclusive),
  ]);

  const resolvedWeekDays = resolveWeekPlanningDays(monday, openingHours, staffTargetsWeekly, overrides);
  const generated = generateAutoSimulationShifts({ resolvedWeekDays, staff });

  let sim = await getPlanningWeekSimulation(restaurantId, ymd);
  if (!sim) {
    const { data, error } = await supabaseServer
      .from("planning_week_simulations")
      .insert({ restaurant_id: restaurantId, week_monday: ymd })
      .select("id")
      .single();
    if (error?.code === "23505") {
      sim = await getPlanningWeekSimulation(restaurantId, ymd);
    } else if (error || !data) {
      return { ok: false, error: error?.message ?? "Impossible de créer la simulation." };
    } else {
      sim = { id: String((data as { id: string }).id), week_monday: ymd };
    }
  }
  if (!sim) return { ok: false, error: "Simulation introuvable." };

  const { error: delErr } = await supabaseServer
    .from("planning_simulation_shifts")
    .delete()
    .eq("simulation_id", sim.id);

  if (delErr) return { ok: false, error: delErr.message };

  if (generated.length === 0) {
    revalidatePath("/equipe");
    return { ok: true, generatedCount: 0 };
  }

  const rows = generated.map((g) => ({
    simulation_id: sim.id,
    staff_member_id: g.staff_member_id,
    starts_at: g.starts_at,
    ends_at: g.ends_at,
    break_minutes: g.break_minutes,
    notes: g.notes,
  }));

  const { error: insErr } = await supabaseServer.from("planning_simulation_shifts").insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/equipe");
  return { ok: true, generatedCount: generated.length };
}

export async function createSimulationShiftAction(
  restaurantId: string,
  simulationId: string,
  payload: {
    staffMemberId: string;
    startsAtLocal: string;
    endsAtLocal: string;
    notes?: string | null;
    breakMinutes?: number | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "planning.mutate");
  if (!gate.ok) return gate;

  const { data: sim, error: eSim } = await supabaseServer
    .from("planning_week_simulations")
    .select("id, week_monday")
    .eq("id", simulationId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (eSim || !sim) return { ok: false, error: "Simulation introuvable." };

  let starts: Date;
  let ends: Date;
  try {
    starts = parseLocalDateTimeInput(payload.startsAtLocal);
    ends = parseLocalDateTimeInput(payload.endsAtLocal);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Date invalide." };
  }
  if (!(ends > starts)) return { ok: false, error: "La fin doit être après le début." };

  const rawWeek = (sim as { week_monday: unknown }).week_monday;
  const weekYmd =
    typeof rawWeek === "string"
      ? rawWeek.slice(0, 10)
      : rawWeek instanceof Date
        ? `${rawWeek.getFullYear()}-${String(rawWeek.getMonth() + 1).padStart(2, "0")}-${String(rawWeek.getDate()).padStart(2, "0")}`
        : String(rawWeek ?? "").slice(0, 10);
  const range = weekRangeIsoFromMondayYmd(weekYmd);
  if (range) {
    const sIso = starts.toISOString();
    const eIso = ends.toISOString();
    if (!(sIso < range.endExclusiveIso && eIso > range.startIso)) {
      return { ok: false, error: "Le créneau doit chevaucher la semaine affichée." };
    }
  }

  const sm = await getStaffMemberById(restaurantId, payload.staffMemberId);
  if (!sm?.active) return { ok: false, error: "Collaborateur invalide ou inactif." };

  let breakM: number | null = null;
  if (payload.breakMinutes != null) {
    const b = Number(payload.breakMinutes);
    if (!Number.isFinite(b) || b < 0 || b > 600) {
      return { ok: false, error: "Pause : nombre de minutes invalide (0 à 600)." };
    }
    breakM = b;
  }

  const { data, error } = await supabaseServer
    .from("planning_simulation_shifts")
    .insert({
      simulation_id: simulationId,
      staff_member_id: payload.staffMemberId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      break_minutes: breakM,
      notes: payload.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Création impossible." };
  revalidatePath("/equipe");
  return { ok: true, id: (data as { id: string }).id };
}

export async function deleteSimulationShiftAction(
  restaurantId: string,
  simulationShiftId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "planning.mutate");
  if (!gate.ok) return gate;

  const { data: row, error: e0 } = await supabaseServer
    .from("planning_simulation_shifts")
    .select("id, simulation_id")
    .eq("id", simulationShiftId)
    .maybeSingle();

  if (e0 || !row) return { ok: false, error: "Créneau introuvable." };

  const simId = String((row as { simulation_id: string }).simulation_id);
  const { data: sim, error: e1 } = await supabaseServer
    .from("planning_week_simulations")
    .select("id")
    .eq("id", simId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (e1 || !sim) return { ok: false, error: "Accès refusé." };

  const { error } = await supabaseServer.from("planning_simulation_shifts").delete().eq("id", simulationShiftId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipe");
  return { ok: true };
}

/** Supprime le brouillon (créneaux simulés) sans toucher au planning réel. */
export async function discardWeekSimulationAction(
  restaurantId: string,
  weekMondayYmd: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "planning.mutate");
  if (!gate.ok) return gate;

  const ymd = weekMondayYmd.trim();
  const { error } = await supabaseServer
    .from("planning_week_simulations")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("week_monday", ymd);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipe");
  return { ok: true };
}

/** Remplace les work_shifts de la semaine par le contenu de la simulation, puis supprime le brouillon. */
export async function publishWeekSimulationAction(
  restaurantId: string,
  weekMondayYmd: string
): Promise<{ ok: true; publishedCount: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "planning.mutate");
  if (!gate.ok) return gate;

  const ymd = weekMondayYmd.trim();
  const range = weekRangeIsoFromMondayYmd(ymd);
  if (!range) return { ok: false, error: "Semaine invalide." };

  const sim = await getPlanningWeekSimulation(restaurantId, ymd);
  if (!sim) return { ok: false, error: "Aucune simulation pour cette semaine." };

  const draftShifts = await listSimulationShiftsWithDetails(restaurantId, sim.id);

  const { error: delErr } = await supabaseServer
    .from("work_shifts")
    .delete()
    .eq("restaurant_id", restaurantId)
    .lt("starts_at", range.endExclusiveIso)
    .gt("ends_at", range.startIso);

  if (delErr) return { ok: false, error: delErr.message };

  if (draftShifts.length > 0) {
    const rows = draftShifts.map((s) => ({
      restaurant_id: restaurantId,
      staff_member_id: s.staff_member_id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      break_minutes: s.break_minutes,
      notes: s.notes,
    }));
    const { error: insErr } = await supabaseServer.from("work_shifts").insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  const { error: rmSim } = await supabaseServer
    .from("planning_week_simulations")
    .delete()
    .eq("id", sim.id)
    .eq("restaurant_id", restaurantId);

  if (rmSim) return { ok: false, error: rmSim.message };

  revalidatePath("/equipe");
  revalidatePath("/equipe/mon-planning");
  return { ok: true, publishedCount: draftShifts.length };
}

export async function deleteWorkShiftAction(
  restaurantId: string,
  shiftId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "planning.mutate");
  if (!gate.ok) return gate;

  const { error } = await supabaseServer
    .from("work_shifts")
    .delete()
    .eq("id", shiftId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipe");
  revalidatePath("/equipe/mon-planning");
  return { ok: true };
}

async function canClockShift(userId: string, restaurantId: string, shiftId: string): Promise<boolean> {
  const shift = await getWorkShiftById(restaurantId, shiftId);
  if (!shift) return false;
  if (await assertRestaurantOwner(userId, restaurantId)) return true;
  const staff = await getStaffMemberByUserAndRestaurant(userId, restaurantId);
  return Boolean(staff && staff.id === shift.staff_member_id);
}

export async function clockInAction(
  restaurantId: string,
  shiftId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  if (!(await canClockShift(user.id, restaurantId, shiftId))) {
    return { ok: false, error: "Accès refusé." };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("shift_attendance")
    .update({ clock_in_at: now })
    .eq("work_shift_id", shiftId)
    .is("clock_in_at", null)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Entrée déjà pointée ou shift introuvable." };
  revalidatePath("/equipe");
  revalidatePath("/equipe/mon-planning");
  return { ok: true };
}

export async function clockOutAction(
  restaurantId: string,
  shiftId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  if (!(await canClockShift(user.id, restaurantId, shiftId))) {
    return { ok: false, error: "Accès refusé." };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("shift_attendance")
    .update({ clock_out_at: now })
    .eq("work_shift_id", shiftId)
    .not("clock_in_at", "is", null)
    .is("clock_out_at", null)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return { ok: false, error: "Sortie déjà pointée, ou entrée manquante." };
  }

  revalidatePath("/equipe");
  revalidatePath("/equipe/mon-planning");
  return { ok: true };
}

/** Ajustement manuel par le gérant (saisie ISO ou null pour effacer). */
export async function managerSetAttendanceAction(
  restaurantId: string,
  shiftId: string,
  clockInIso: string | null,
  clockOutIso: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "planning.mutate");
  if (!gate.ok) return gate;

  if (clockInIso && clockOutIso && new Date(clockOutIso) < new Date(clockInIso)) {
    return { ok: false, error: "La sortie doit être après l’entrée." };
  }

  const { error } = await supabaseServer
    .from("shift_attendance")
    .update({
      clock_in_at: clockInIso,
      clock_out_at: clockOutIso,
    })
    .eq("work_shift_id", shiftId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipe");
  revalidatePath("/equipe/mon-planning");
  return { ok: true };
}

/** Lien d’invitation (7 jours) pour lier le compte du collaborateur à sa fiche. */
export async function createStaffInviteAction(
  restaurantId: string,
  staffMemberId: string
): Promise<{ ok: true; joinUrl: string; expiresAtIso: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "staff.manage");
  if (!gate.ok) return gate;

  const sm = await getStaffMemberById(restaurantId, staffMemberId);
  if (!sm?.active) return { ok: false, error: "Collaborateur introuvable ou inactif." };
  if (sm.user_id) return { ok: false, error: "Un compte est déjà lié à cette fiche." };

  const created = await createStaffInviteRecord({
    restaurantId,
    staffMemberId,
    createdByUserId: user.id,
  });
  if ("error" in created) return { ok: false, error: created.error };

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "");
  const path = `/join?token=${created.token}`;
  const joinUrl = base ? `${base}${path}` : path;

  revalidatePath("/equipe");
  return { ok: true, joinUrl, expiresAtIso: created.expires_at };
}

export async function acceptStaffInviteAction(
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const t = token.trim();
  if (!UUID_RE.test(t)) return { ok: false, error: "Lien d’invitation invalide." };

  const inv = await getStaffInviteByToken(t);
  if (!inv) return { ok: false, error: "Invitation expirée, déjà utilisée ou invalide." };

  const done = await consumeStaffInvite({
    inviteId: inv.id,
    staffMemberId: inv.staff_member_id,
    restaurantId: inv.restaurant_id,
    userId: user.id,
  });
  if (!done.ok) return done;

  revalidatePath("/join");
  revalidatePath("/dashboard");
  revalidatePath("/equipe");
  revalidatePath("/equipe/mon-planning");
  return { ok: true };
}
