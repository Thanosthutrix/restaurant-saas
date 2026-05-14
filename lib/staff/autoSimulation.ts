import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import { minutesFromMidnight, type TimeBand } from "@/lib/staff/planningHoursTypes";
import { intersectTimeBands, mergeTimeBands, mergedStaffWorkBands } from "@/lib/staff/staffWorkWindows";
import type { StaffMember } from "@/lib/staff/types";

export type GeneratedSimulationShift = {
  staff_member_id: string;
  starts_at: string;
  ends_at: string;
  break_minutes: number | null;
  notes: string | null;
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function bandDuration(b: TimeBand): number {
  const a = minutesFromMidnight(b.start);
  const e = minutesFromMidnight(b.end);
  if (a == null || e == null || e <= a) return 0;
  return e - a;
}

function breakFor(durM: number): number | null {
  if (durM > 360) return 30;
  if (durM > 240) return 15;
  return null;
}

function netMin(durM: number): number {
  return Math.max(0, durM - (breakFor(durM) ?? 0));
}

function hhmmFromMs(msFromEpoch: number): string {
  const d = new Date(msFromEpoch);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function startOfDay(day: Date, hhmm: string): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return new Date(day);
  const d = new Date(day);
  d.setHours(+m[1], +m[2], 0, 0);
  return d;
}

/** Toutes les intersections dispo × bande (≥ 15 min). */
function overlaps(band: TimeBand, eff: TimeBand[]): TimeBand[] {
  return intersectTimeBands([band], eff).filter((b) => bandDuration(b) >= 15);
}

/** Minutes nettes disponibles pour un membre sur toutes les bandes du jour. */
function memberAvailNet(m: StaffMember, wd: WeekResolvedDay, bands: TimeBand[]): number {
  const eff = mergedStaffWorkBands(m, wd);
  return bands.reduce((s, b) => s + overlaps(b, eff).reduce((a, seg) => a + netMin(bandDuration(seg)), 0), 0);
}

/** Priorité de rôle pour équilibrer salle / cuisine / gestion. */
function roleFamily(m: StaffMember): number {
  const r = (m.role_label ?? "").toLowerCase();
  if (/g[eé]rant|manager/.test(r)) return 0;
  if (/chef|cuisine|cuisinier|commis/.test(r)) return 1;
  if (/serveur|serveuse|salle|h[oô]te/.test(r)) return 2;
  return 3;
}

/**
 * Priorité de renfort pour un jour (plus petit = plus prioritaire).
 * Samedi > vendredi / jours fériés travaillés > jeudi > reste.
 */
function reinforcementPriority(wd: WeekResolvedDay): number {
  if (wd.dayKey === "sat") return 1;
  if (wd.dayKey === "fri") return 2;
  if (wd.exceptionLabel) return 2; // jour férié ou exception
  if (wd.dayKey === "sun") return 3;
  if (wd.dayKey === "thu") return 4;
  if (wd.dayKey === "wed") return 5;
  if (wd.dayKey === "tue") return 6;
  return 7;
}

// ─── Placement d'un membre sur un jour ───────────────────────────────────────

/**
 * Place le membre sur toutes ses bandes disponibles pour ce jour,
 * dans la limite du budget hebdomadaire restant.
 * Retourne les minutes nettes placées (0 si rien).
 */
function placeOnDay(
  m: StaffMember,
  wd: WeekResolvedDay,
  bands: TimeBand[],
  weeklyBudget: Map<string, number | null>,
  usedNet: Map<string, number>,
  out: GeneratedSimulationShift[]
): number {
  const eff = mergedStaffWorkBands(m, wd);
  let placed = 0;
  let lastEndMs = 0;

  // Chrono : déjeuner avant dîner
  const chronoBands = [...bands].sort(
    (a, b) => (minutesFromMidnight(a.start) ?? 0) - (minutesFromMidnight(b.start) ?? 0)
  );

  for (const band of chronoBands) {
    const segs = mergeTimeBands(overlaps(band, eff));
    for (const seg of segs) {
      const durM = bandDuration(seg);
      if (durM < 15) continue;

      const start = startOfDay(wd.date, seg.start);
      const end = startOfDay(wd.date, seg.end);
      if (!(end > start) || start.getTime() < lastEndMs) continue;

      // Budget restant
      const bud = weeklyBudget.get(m.id);
      const used = usedNet.get(m.id) ?? 0;
      const remaining = bud != null ? Math.max(0, bud - used) : 999999;
      if (remaining < 15) continue;

      const net = netMin(durM);
      let finalEnd = end;

      if (net > remaining) {
        // Tronquer pour ne pas dépasser le contrat
        const br = breakFor(durM) ?? 0;
        const grossCap = remaining + br;
        if (grossCap < 15) continue;
        finalEnd = new Date(start.getTime() + grossCap * 60000);
      }

      const finalDur = Math.round((finalEnd.getTime() - start.getTime()) / 60000);
      if (finalDur < 15) continue;
      const finalNet = netMin(finalDur);
      const finalBr = breakFor(finalDur);

      usedNet.set(m.id, used + finalNet);
      lastEndMs = finalEnd.getTime();
      placed += finalNet;

      out.push({
        staff_member_id: m.id,
        starts_at: start.toISOString(),
        ends_at: finalEnd.toISOString(),
        break_minutes: finalBr,
        notes: `Auto · ${seg.start}–${hhmmFromMs(finalEnd.getTime())}`,
      });
    }
  }

  return placed;
}

// ─── Algorithme principal ─────────────────────────────────────────────────────

/**
 * Génère les créneaux de la semaine en deux passes :
 *
 * **Passe 1 — Couverture minimum** (ordre chronologique lun → dim)
 *   Pour chaque jour ouvert, on remplit jusqu'à l'objectif d'effectif (`staffTarget`).
 *   Tri des candidats : proportion de contrat remplie la plus faible en premier,
 *   avec équilibre des rôles (salle / cuisine / gestion) comme critère secondaire.
 *   → Chaque personne travaille en priorité les jours où elle est la plus "en retard"
 *     sur ses heures contractuelles.
 *
 * **Passe 2 — Renfort** (tri par priorité : sam > ven / fériés > jeu > …)
 *   Les membres qui ont encore des heures à effectuer sont ajoutés sur les jours
 *   qu'ils n'ont pas encore travaillés, en commençant par les jours les plus chargés.
 *   → Un membre n'est ajouté en renfort que s'il lui reste au moins 1 h de contrat.
 */
export function generateAutoSimulationShifts(params: {
  resolvedWeekDays: WeekResolvedDay[];
  staff: StaffMember[];
}): GeneratedSimulationShift[] {
  const { resolvedWeekDays, staff } = params;
  const active = staff.filter((s) => s.active);
  if (active.length === 0) return [];

  // Budget net en minutes (null = pas de cible horaire).
  const weeklyBudget = new Map<string, number | null>(
    active.map((m) => [
      m.id,
      m.target_weekly_hours != null && m.target_weekly_hours > 0
        ? Math.round(m.target_weekly_hours * 60)
        : null,
    ])
  );

  const usedNet = new Map<string, number>(active.map((m) => [m.id, 0]));

  // Qui a travaillé quel jour (ymd) — pour ne pas doubler en passe 2.
  const workedDays = new Map<string, Set<string>>(active.map((m) => [m.id, new Set()]));

  const out: GeneratedSimulationShift[] = [];

  // Jours ouverts (au moins une plage de travail)
  const openDays = resolvedWeekDays.filter(
    (wd) => mergeTimeBands([...wd.openingBands, ...(wd.staffExtraBands ?? [])]).length > 0
  );

  // ── PASSE 1 : couverture minimum, ordre chronologique ─────────────────────

  for (const wd of openDays) {
    const bands = mergeTimeBands([...wd.openingBands, ...(wd.staffExtraBands ?? [])]);
    const target =
      wd.staffTarget != null && wd.staffTarget > 0
        ? Math.min(Math.ceil(wd.staffTarget), active.length)
        : 0;
    if (target === 0) continue;

    // Proportion du contrat déjà couverte (ascending = priorité haute)
    function contractPct(m: StaffMember): number {
      const bud = weeklyBudget.get(m.id);
      if (!bud) return 0;
      return (usedNet.get(m.id) ?? 0) / bud;
    }

    // Nombre de membres déjà planifiés aujourd'hui (pour l'équilibre des rôles)
    const todayMembers: StaffMember[] = [];

    function roleScore(m: StaffMember): number {
      const fam = roleFamily(m);
      const total = active.filter((x) => roleFamily(x) === fam).length;
      const done = todayMembers.filter((x) => roleFamily(x) === fam).length;
      const expected = todayMembers.length > 0 ? todayMembers.length * (total / active.length) : 0;
      return Math.max(0, expected - done); // manque → score élevé → priorité haute
    }

    const candidates = active
      .filter((m) => {
        const bud = weeklyBudget.get(m.id);
        const remaining = bud != null ? bud - (usedNet.get(m.id) ?? 0) : 999999;
        return remaining >= 30 && memberAvailNet(m, wd, bands) > 0;
      })
      .sort((a, b) => {
        const rs = roleScore(b) - roleScore(a);
        if (Math.abs(rs) > 0.01) return rs; // rôle manquant en priorité
        return contractPct(a) - contractPct(b); // le plus en retard sur son contrat en premier
      });

    let placed = 0;
    for (const m of candidates) {
      if (placed >= target) break;
      const net = placeOnDay(m, wd, bands, weeklyBudget, usedNet, out);
      if (net > 0) {
        workedDays.get(m.id)!.add(wd.ymd);
        todayMembers.push(m);
        placed++;
      }
    }
  }

  // ── PASSE 2 : renfort, ordre de priorité (sam > ven / fériés > jeu > …) ──

  const reinforcementDays = [...openDays].sort(
    (a, b) => reinforcementPriority(a) - reinforcementPriority(b)
  );

  for (const wd of reinforcementDays) {
    const bands = mergeTimeBands([...wd.openingBands, ...(wd.staffExtraBands ?? [])]);

    // Membres qui n'ont pas encore travaillé ce jour et qui ont encore des heures
    const reinforceCandidates = active
      .filter((m) => {
        if (workedDays.get(m.id)!.has(wd.ymd)) return false; // déjà planifié ce jour
        const bud = weeklyBudget.get(m.id);
        const remaining = bud != null ? bud - (usedNet.get(m.id) ?? 0) : 999999;
        return remaining >= 60 && memberAvailNet(m, wd, bands) > 0; // au moins 1 h restante
      })
      .sort((a, b) => {
        // Le plus en retard sur son contrat en premier
        const bA = weeklyBudget.get(a.id) ?? 1;
        const bB = weeklyBudget.get(b.id) ?? 1;
        const remA = bA - (usedNet.get(a.id) ?? 0);
        const remB = bB - (usedNet.get(b.id) ?? 0);
        return remB - remA;
      });

    for (const m of reinforceCandidates) {
      const net = placeOnDay(m, wd, bands, weeklyBudget, usedNet, out);
      if (net > 0) {
        workedDays.get(m.id)!.add(wd.ymd);
      }
    }
  }

  return out;
}
