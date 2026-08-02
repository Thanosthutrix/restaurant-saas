/**
 * Équipe : fiches salariés, contrats HCR, planning et pointages.
 *
 * Les trois doivent raconter la même histoire : le contrat fixe des heures
 * hebdomadaires, le planning les respecte, et les pointages correspondent aux
 * créneaux planifiés à quelques minutes près.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HcrContractDraft, HcrJobCode, HcrLevel, HcrEchelon } from "@/lib/hcr-contracts/types";
import { STAFF, buildWeekShifts, type PlannedShift, type StaffDef } from "./team";
import { addDays, insertChunked, makeRng, mondayOf, parisToUtcIso, randInt, round2 } from "./util";

const EMPLOYER = {
  companyName: "Le Comptoir du Marché",
  legalName: "SARL LE COMPTOIR DU MARCHÉ",
  legalForm: "SARL",
  siret: "89241735600017",
  urssafOffice: "URSSAF Île-de-France",
  address: "14 rue du Marché Saint-Honoré, 75001 Paris",
  representativeName: "Medhi Thuleau",
  representativeRole: "Gérant",
  collectiveAgreementIdcc: "1979",
  retirementFund: "AG2R La Mondiale",
  healthProvider: "Klesia Prévoyance",
};

/** Correspondance poste → code métier et grille HCR. */
const JOB_META: Record<string, { code: HcrJobCode; level: HcrLevel; echelon: HcrEchelon; missions: string }> = {
  "Chef de cuisine": {
    code: "headChef", level: "4", echelon: "1",
    missions: "Conception de la carte, gestion des commandes et des stocks, encadrement de la brigade, application du plan de maîtrise sanitaire.",
  },
  "Second de cuisine": {
    code: "chefDePartie", level: "3", echelon: "2",
    missions: "Production chaude et froide, remplacement du chef de cuisine en son absence, contrôle des préparations et des températures.",
  },
  "Commis de cuisine": {
    code: "commis", level: "1", echelon: "2",
    missions: "Mise en place, épluchage et taillage, aide à l'envoi, nettoyage du poste et respect des protocoles d'hygiène.",
  },
  "Plonge / polyvalente": {
    code: "commis", level: "1", echelon: "1",
    missions: "Plonge batterie et vaisselle, nettoyage des sols et locaux, sortie des déchets, appui à la mise en place.",
  },
  "Responsable de salle": {
    code: "manager", level: "3", echelon: "3",
    missions: "Organisation du service, accueil et placement de la clientèle, encadrement de l'équipe de salle, gestion de la caisse.",
  },
  Serveur: {
    code: "server", level: "2", echelon: "1",
    missions: "Accueil, prise de commande, service à l'assiette, encaissement, mise en place et nettoyage de la salle.",
  },
  Barman: {
    code: "server", level: "2", echelon: "2",
    missions: "Préparation des boissons, gestion du bar et des stocks de boissons, service au comptoir, nettoyage des équipements.",
  },
  "Serveuse (extra)": {
    code: "server", level: "1", echelon: "3",
    missions: "Renfort de service lors des périodes de forte affluence : accueil, service à l'assiette, débarrassage.",
  },
};

/** Heures mensualisées : 39 h/semaine → 169 h/mois (52 × 39 / 12). */
function monthlyGross(weeklyHours: number, hourlyRate: number): number {
  return round2((weeklyHours * 52 / 12) * hourlyRate);
}

// ---------------------------------------------------------------------------
// FICHES SALARIÉS
// ---------------------------------------------------------------------------

export async function seedStaffMembers(
  sb: SupabaseClient,
  restaurantId: string
): Promise<string[]> {
  const ids: string[] = [];

  for (const s of STAFF) {
    const { data, error } = await sb
      .from("staff_members")
      .insert({
        restaurant_id: restaurantId,
        display_name: s.displayName,
        role_label: s.roleLabel,
        app_role: s.appRole,
        contract_type: s.contractType,
        target_weekly_hours: s.weeklyHours,
        hourly_gross_rate: s.hourlyRate,
        contract_start_date: s.contractStart,
        contract_end_date: s.contractEnd ?? null,
        active: true,
        color_index: s.colorIndex,
        max_daily_hours: 11,
        planning_fixed_rest_days: s.restDays,
        planning_require_consecutive_rest: true,
        paid_leave_balance_days: s.contractType === "extra" ? 4 : randInt(makeRng(s.colorIndex + 1), 8, 18),
        withholding_tax_rate_pct: s.hourlyRate > 15 ? 4.3 : 1.8,
        planning_notes: null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Salarié « ${s.displayName} » : ${error.message}`);
    ids.push((data as { id: string }).id);
  }

  return ids;
}

// ---------------------------------------------------------------------------
// CONTRATS HCR
// ---------------------------------------------------------------------------

function buildDraft(s: StaffDef, staffMemberId: string, restaurantId: string): HcrContractDraft {
  const meta = JOB_META[s.roleLabel];
  const kind = s.contractType === "cdd" ? "cdd" : s.contractType === "extra" ? "extra" : "cdi";

  return {
    contractKind: kind,
    employer: { restaurantId, ...EMPLOYER },
    employee: {
      staffMemberId,
      firstName: s.firstName,
      lastName: s.lastName,
      address: s.address,
      socialSecurityNumber: "",
      nationality: "Française",
      birthDate: s.birthDate,
      birthPlace: "Paris",
    },
    jobAndPay: {
      jobCode: meta.code,
      jobTitle: s.roleLabel,
      missions: meta.missions,
      status: meta.code === "headChef" || meta.code === "manager" ? "supervisor" : "employee",
      level: meta.level,
      echelon: meta.echelon,
      hourlyRateGross: s.hourlyRate,
      weeklyHours: s.weeklyHours,
      monthlyGross: monthlyGross(s.weeklyHours, s.hourlyRate),
    },
    ...(kind === "cdi"
      ? {}
      : {
          termDetails: {
            reason: kind === "cdd" ? "temporaryIncrease" : "temporaryIncrease",
            startDate: s.contractStart,
            endDate: s.contractEnd,
            hasUncertainTerm: false,
            renewalClause: kind === "cdd",
            ...(kind === "extra"
              ? { extraMission: "Renfort de service en salle lors des services de forte affluence." }
              : {}),
          },
        }),
    clauses: {
      trialPeriod: true,
      workingTimeModulation: false,
      mealBenefits: true,
      overtimePay: s.weeklyHours >= 35,
      workClothes: true,
      nonCompete: false,
      logement: false,
      transport: true,
      materiel: false,
      exclusivite: false,
      image: false,
      dedit: false,
      delegation: meta.code === "headChef" || meta.code === "manager",
      videosurveillance: false,
      permis: false,
      confidentialiteRenforcee: false,
      tenueTravail: true,
      heuresComplementaires: s.weeklyHours < 35,
      forfaitJours: false,
      remunerationVariable: false,
      responsabiliteCaisse: meta.code === "manager",
      charteInformatique: false,
      travailleurNuit: false,
      isPolyvalenceActive: true,
      mobilityZoneType: "ville",
      isTrialRenewable: kind === "cdi",
      planningNoticeDays: 7,
      mutuelleEmployerShare: 50,
      congesCalculMode: "ouvrables",
      absenceJustificationHours: 48,
      preavisMode: "auto",
      // Période d'essai HCR : 1 mois employé, 2 mois agent de maîtrise.
      trialPeriodValue: meta.code === "headChef" || meta.code === "manager" ? 2 : 1,
      trialPeriodUnit: "mois",
      // Avantage en nature repas 2026 : 4,22 € par repas.
      mealBasketAmount: 4.22,
      transportCoveragePercent: 50,
      uniformProvidedList: "Veste de service, tablier, chaussures de sécurité.",
      ...(s.weeklyHours < 35 ? { maxComplementaryHoursPercent: 10 } : {}),
    },
    signatureCity: "Paris",
    signatureDate: s.contractStart,
  };
}

export async function seedContracts(
  sb: SupabaseClient,
  restaurantId: string,
  staffIds: string[]
): Promise<void> {
  const rows = STAFF.map((s, i) => {
    const kind = s.contractType === "cdd" ? "cdd" : s.contractType === "extra" ? "extra" : "cdi";
    return {
      restaurant_id: restaurantId,
      staff_member_id: staffIds[i],
      contract_kind: kind,
      employee_first_name: s.firstName,
      employee_last_name: s.lastName,
      title: `${kind.toUpperCase()} — ${s.displayName} (${s.roleLabel})`,
      draft_json: buildDraft(s, staffIds[i], restaurantId),
      // Les contrats en cours ont été édités et signés ; l'extra vient d'arriver.
      status: s.contractType === "extra" ? "draft" : "exported",
    };
  });

  const { error } = await sb.from("hcr_contracts").insert(rows);
  if (error) throw new Error(`Contrats HCR : ${error.message}`);
}

// ---------------------------------------------------------------------------
// PLANNING ET POINTAGES
// ---------------------------------------------------------------------------

export type ShiftRecord = PlannedShift & { shiftId: string };

/**
 * Écrit le planning sur toute la période puis les pointages des créneaux passés.
 * Le pointage colle au créneau à quelques minutes près : arrivée un peu en avance,
 * départ un peu après la fin du service.
 */
export async function seedShifts(
  sb: SupabaseClient,
  restaurantId: string,
  staffIds: string[],
  opts: { from: string; to: string; today: string }
): Promise<{ shifts: PlannedShift[]; count: number; attendance: number }> {
  const rng = makeRng(31415);
  const allShifts: PlannedShift[] = [];

  // Le planning est bâti semaine par semaine, comme dans l'application.
  let monday = mondayOf(opts.from);
  while (monday <= opts.to) {
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    for (const s of buildWeekShifts(weekDates)) {
      if (s.date < opts.from || s.date > opts.to) continue;
      // Un salarié ne peut pas être planifié avant son entrée dans l'effectif.
      if (s.date < STAFF[s.staffIndex].contractStart) continue;
      allShifts.push(s);
    }
    monday = addDays(monday, 7);
  }

  const rows = allShifts.map((s) => ({
    restaurant_id: restaurantId,
    staff_member_id: staffIds[s.staffIndex],
    starts_at: parisToUtcIso(s.date, s.start),
    ends_at: parisToUtcIso(s.date, s.end),
    break_minutes: s.breakMinutes,
    notes: null,
  }));

  const inserted: { id: string; starts_at: string; staff_member_id: string }[] = [];
  for (let i = 0; i < rows.length; i += 400) {
    const { data, error } = await sb
      .from("work_shifts")
      .insert(rows.slice(i, i + 400))
      .select("id, starts_at, staff_member_id");
    if (error) throw new Error(`Planning : ${error.message}`);
    inserted.push(...((data ?? []) as typeof inserted));
  }

  // Pointages des créneaux passés. La base renvoie les horodatages dans son
  // propre format (« +00:00 ») : on indexe sur l'instant, pas sur la chaîne.
  const byKey = new Map<string, string>();
  for (const r of inserted) byKey.set(`${r.staff_member_id}|${Date.parse(r.starts_at)}`, r.id);

  const attendanceRows: Record<string, unknown>[] = [];
  // Un créneau ne peut porter qu'un pointage (contrainte d'unicité en base).
  const stamped = new Set<string>();

  for (const s of allShifts) {
    if (s.date >= opts.today) continue;
    const startIso = parisToUtcIso(s.date, s.start);
    const shiftId = byKey.get(`${staffIds[s.staffIndex]}|${Date.parse(startIso)}`);
    if (!shiftId || stamped.has(shiftId)) continue;
    stamped.add(shiftId);

    const startMs = Date.parse(startIso);
    const endMs = Date.parse(parisToUtcIso(s.date, s.end));
    // Badgeage : entre 8 min avant et 3 min après l'heure prévue.
    const clockIn = startMs + randInt(rng, -8, 3) * 60000;
    // Sortie : de l'heure prévue à 20 min après (fin de service qui s'étire).
    const clockOut = endMs + randInt(rng, 0, 20) * 60000;

    attendanceRows.push({
      work_shift_id: shiftId,
      clock_in_at: new Date(clockIn).toISOString(),
      clock_out_at: new Date(clockOut).toISOString(),
    });
  }

  // La base crée déjà une ligne de pointage vide pour chaque créneau : on la
  // complète plutôt que d'en insérer une seconde (contrainte d'unicité).
  for (let i = 0; i < attendanceRows.length; i += 200) {
    const { error } = await sb
      .from("shift_attendance")
      .upsert(attendanceRows.slice(i, i + 200), { onConflict: "work_shift_id" });
    if (error) throw new Error(`Pointages : ${error.message}`);
  }

  return { shifts: allShifts, count: rows.length, attendance: attendanceRows.length };
}

// ---------------------------------------------------------------------------
// CONGÉS
// ---------------------------------------------------------------------------

/** Les congés sont enregistrés jour par jour : une ligne par journée d'absence. */
export async function seedLeave(
  sb: SupabaseClient,
  restaurantId: string,
  staffIds: string[],
  today: string
): Promise<number> {
  const periods: { staffIndex: number; from: number; to: number; kind: "leave" | "unavailable"; status: "pending" | "validated"; label: string }[] = [
    { staffIndex: 5, from: 21, to: 33, kind: "leave", status: "validated", label: "Congés payés d'été" },
    { staffIndex: 3, from: 10, to: 12, kind: "unavailable", status: "pending", label: "Demande d'absence personnelle" },
    { staffIndex: 6, from: 45, to: 51, kind: "leave", status: "validated", label: "Congés payés" },
  ];

  const rows: Record<string, unknown>[] = [];
  for (const p of periods) {
    for (let d = p.from; d <= p.to; d++) {
      rows.push({
        restaurant_id: restaurantId,
        staff_member_id: staffIds[p.staffIndex],
        day: addDays(today, d),
        kind: p.kind,
        status: p.status,
        label: p.label,
      });
    }
  }

  const { error } = await sb.from("staff_leave").insert(rows);
  if (error) throw new Error(`Congés : ${error.message}`);
  return rows.length;
}
