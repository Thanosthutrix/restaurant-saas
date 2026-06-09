import { minutesFromMidnight } from "@/lib/staff/planningHoursTypes";
import { isFieldBlocking } from "./wizardFieldTypes";
import type { WizardData } from "./wizardDataTypes";

export type WizardStepId = "establishment" | "team" | "constraints" | "staffing";

export const WIZARD_STEPS: { id: WizardStepId; title: string; subtitle: string }[] = [
  { id: "establishment", title: "Cadre établissement", subtitle: "Horaires, talon, calendrier" },
  { id: "team", title: "Équipe & contrats", subtitle: "Postes, heures, shifts" },
  { id: "constraints", title: "Contraintes humaines", subtitle: "Congés, repos, indispos" },
  { id: "staffing", title: "Besoin prédictif", subtitle: "Pointe & ajustements" },
];

export interface BlockingField {
  label: string;
  reason: string;
}

/** Champs bloquants d'une étape (donnée obligatoire manquante). Vide = on peut avancer. */
export function blockingFieldsForStep(stepId: WizardStepId, d: WizardData): BlockingField[] {
  const out: BlockingField[] = [];

  if (stepId === "establishment") {
    if (isFieldBlocking(d.establishment.securityFloor)) {
      out.push({ label: "Talon de sécurité", reason: "Effectif minimum requis non défini" });
    }
    for (const day of d.establishment.days) {
      for (const band of day.openingBands.value ?? []) {
        const start = minutesFromMidnight(band.start);
        const end = minutesFromMidnight(band.end);
        if (start == null || end == null || end <= start) {
          out.push({ label: `Horaires ${day.ymd}`, reason: "Chaque créneau doit avoir une fin après le début" });
          break;
        }
      }
    }
  }

  if (stepId === "team") {
    for (const m of d.team.members) {
      if (!m.active) continue;
      if (isFieldBlocking(m.contractWeeklyHours)) {
        out.push({ label: `${m.displayName} · heures de contrat`, reason: "Donnée manquante" });
      }
      if (isFieldBlocking(m.role)) {
        out.push({ label: `${m.displayName} · poste`, reason: "Donnée manquante" });
      }
    }
  }

  // Étapes "constraints" et "staffing" : pas de champ strictement bloquant
  // (congés/repos optionnels ; besoin prédictif toujours calculable).
  return out;
}

export function canAdvanceFromStep(stepId: WizardStepId, d: WizardData): boolean {
  return blockingFieldsForStep(stepId, d).length === 0;
}
