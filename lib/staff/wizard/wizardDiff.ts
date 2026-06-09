import type { FieldWriteTarget, HydratedField } from "./wizardFieldTypes";
import { isFieldModified } from "./wizardFieldTypes";
import type { WizardData } from "./wizardDataTypes";

/** Une écriture de rétro-enregistrement à exécuter côté serveur. */
export interface RetroSaveOp {
  target: FieldWriteTarget;
  value: unknown;
}

function collect<T>(field: HydratedField<T>, ops: RetroSaveOp[]): void {
  if (field.persistToDb && field.writeTarget && field.value != null) {
    ops.push({ target: field.writeTarget, value: field.value });
  }
}

/**
 * Liste les opérations de rétro-enregistrement : tous les champs dont l'utilisateur
 * a coché « mettre à jour définitivement ». Indépendant de l'ordre des étapes.
 */
export function collectRetroSaveOps(d: WizardData): RetroSaveOp[] {
  const ops: RetroSaveOp[] = [];

  collect(d.establishment.securityFloor, ops);

  for (const m of d.team.members) {
    collect(m.role, ops);
    collect(m.contractWeeklyHours, ops);
    collect(m.maxDailyHours, ops);
    collect(m.defaultShiftPattern, ops);
  }

  for (const rule of Object.values(d.constraints.restRulesByStaffId)) {
    // fixedRestDays, weeklyRestDays et requireConsecutive partagent la même cible staff.restRule :
    // on regroupe pour n'émettre qu'une écriture par collaborateur.
    if (
      (rule.fixedRestDays.persistToDb ||
        rule.weeklyRestDays.persistToDb ||
        rule.requireConsecutive.persistToDb) &&
      rule.fixedRestDays.writeTarget
    ) {
      ops.push({
        target: rule.fixedRestDays.writeTarget,
        value: {
          fixedRestDays: rule.fixedRestDays.value ?? [],
          weeklyRestDays: rule.weeklyRestDays.value ?? 2,
          requireConsecutive: rule.requireConsecutive.value ?? true,
        },
      });
    }
  }

  for (const f of Object.values(d.staffing.peakBandsByDay)) {
    if (f) collect(f, ops);
  }

  return ops;
}

/** Compte les champs surchargés par l'utilisateur (pour l'UI de revue). */
export function countModifiedFields(d: WizardData): number {
  let n = 0;
  const tick = <T>(f: HydratedField<T>) => {
    if (isFieldModified(f)) n += 1;
  };
  tick(d.establishment.securityFloor);
  for (const day of d.establishment.days) {
    tick(day.openingBands);
    tick(day.staffExtraBands);
  }
  for (const m of d.team.members) {
    tick(m.role);
    tick(m.contractWeeklyHours);
    tick(m.maxDailyHours);
    tick(m.defaultShiftPattern);
  }
  for (const rule of Object.values(d.constraints.restRulesByStaffId)) {
    tick(rule.fixedRestDays);
    tick(rule.weeklyRestDays);
    tick(rule.requireConsecutive);
  }
  for (const f of Object.values(d.staffing.peakBandsByDay)) {
    if (f) tick(f);
  }
  return n;
}
