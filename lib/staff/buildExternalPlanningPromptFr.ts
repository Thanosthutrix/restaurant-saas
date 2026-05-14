import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import {
  type OpeningHoursMap,
  type PlanningDayKey,
  PLANNING_DAY_LABELS,
  parseOpeningHoursJson,
} from "@/lib/staff/planningHoursTypes";
import { mergeTimeBands } from "@/lib/staff/staffWorkWindows";
import type { StaffMember } from "@/lib/staff/types";

function bandsLine(bands: { start: string; end: string }[]): string {
  if (bands.length === 0) return "fermé / aucune plage";
  return bands.map((b) => `${b.start}–${b.end}`).join(", ");
}

/**
 * Bloc texte FR identique à l’esprit de « Copier le prompt » : même contexte que la grille (semaine résolue + équipe).
 */
export function buildExternalPlanningPromptFr(params: {
  restaurantName: string;
  weekMondayIso: string;
  openingHours: OpeningHoursMap;
  staffExtraBands: OpeningHoursMap;
  staffTargetsWeekly: Partial<Record<PlanningDayKey, number>>;
  resolvedWeekDays: WeekResolvedDay[];
  staff: StaffMember[];
}): string {
  const lines: string[] = [];
  const name = params.restaurantName.trim() || "Restaurant";
  lines.push(`# ${name}`);
  lines.push("");
  lines.push(`Semaine affichée (lundi ISO) : **${params.weekMondayIso.trim()}**`);
  lines.push("");
  lines.push("## Modèle hebdo — ouverture public (par jour)");
  for (const k of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) {
    const bands = params.openingHours[k] ?? [];
    lines.push(`- **${PLANNING_DAY_LABELS[k]}** : ${bandsLine(bands)}`);
  }
  lines.push("");
  lines.push("## Modèle hebdo — plages travail hors client (établissement, par jour)");
  for (const k of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) {
    const bands = params.staffExtraBands[k] ?? [];
    if (bands.length === 0) continue;
    lines.push(`- **${PLANNING_DAY_LABELS[k]}** : ${bandsLine(bands)}`);
  }
  lines.push("");
  lines.push("## Objectifs d’effectif (nombre de personnes distinctes planifiées sur la journée, par jour modèle)");
  const tgt = params.staffTargetsWeekly;
  for (const k of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) {
    const n = tgt[k];
    if (n == null || !Number.isFinite(n)) continue;
    lines.push(`- **${PLANNING_DAY_LABELS[k]}** : ${n}`);
  }
  lines.push("");
  lines.push("## Semaine résolue (exceptions, fériés, ouvertures effectives)");
  for (const wd of params.resolvedWeekDays) {
    const lab = wd.exceptionLabel ? ` — ${wd.exceptionLabel}` : "";
    const tgtDay = wd.staffTarget != null ? ` ; objectif effectif jour : ${wd.staffTarget}` : "";
    const mergedDay = mergeTimeBands([...wd.openingBands, ...wd.staffExtraBands]);
    if (mergedDay.length === 0) {
      lines.push(
        `- **${wd.ymd}** (${PLANNING_DAY_LABELS[wd.dayKey]})${lab} : **JOUR SANS AUCUNE PLAGE DE TRAVAIL (ouverture + hors client établissement)** — ne planifier **personne** ; dans le JSON format A : \`"closed": true\` et \`"staff": []\`.${tgtDay}`
      );
    } else {
      lines.push(
        `- **${wd.ymd}** (${PLANNING_DAY_LABELS[wd.dayKey]})${lab} : ouverture public ${bandsLine(wd.openingBands)} ; hors client établissement ${bandsLine(wd.staffExtraBands)}${tgtDay}`
      );
    }
  }
  lines.push("");
  lines.push("## Équipe (utiliser ces noms ou les UUID pour les créneaux)");
  for (const m of params.staff.filter((s) => s.active)) {
    const cap =
      m.target_weekly_hours != null && Number.isFinite(m.target_weekly_hours)
        ? `${m.target_weekly_hours} h / semaine (cible contrat)`
        : "volume hebdo non renseigné";
    const av = parseOpeningHoursJson(m.availability_json ?? {});
    const prep = parseOpeningHoursJson(m.planning_prep_bands_json ?? {});
    lines.push(
      `- \`${m.id}\` — **${(m.display_name ?? "").trim() || "(sans nom)"}** (${m.role_label ?? "poste ?"}) ; ${cap} ; dispo service (intersection déjà gérée côté app, JSON jour) : ${JSON.stringify(av)} ; prépa perso : ${JSON.stringify(prep)}`
    );
  }
  return lines.join("\n");
}
