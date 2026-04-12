import type { HygieneRiskLevel } from "./types";
import { HYGIENE_RISK_WEIGHT } from "./types";

export type HygieneScoreTaskRow = {
  risk_level: HygieneRiskLevel;
  status: "pending" | "completed" | "missed";
  due_at: string;
  completed_at: string | null;
};

/**
 * Score hygiène V1 — 7 jours glissants, explicable :
 * - pondération : standard=1, important=2, critical=4
 * - à temps : completed_at <= due_at → 100 % du poids
 * - en retard mais fait : 50 % du poids
 * - non fait (pending/missed) après échéance : 0 % (on ne compte que les tâches dont l’échéance est passée pour le dénominateur partiel — voir ci-dessous)
 *
 * Dénominateur : somme des poids des tâches dont due_at est dans la fenêtre et due_at <= now (échues ou à échoir aujourd’hui inclus).
 * Pour V1 : on prend les tâches avec due_at dans [start, end] incluses, end = maintenant.
 */
export function computeHygieneScore(
  tasks: HygieneScoreTaskRow[],
  now: Date = new Date()
): { score: number; earned: number; max: number; detail: string } {
  const relevant = tasks.filter((t) => {
    const due = new Date(t.due_at).getTime();
    return due <= now.getTime();
  });

  let max = 0;
  let earned = 0;

  for (const t of relevant) {
    const w = HYGIENE_RISK_WEIGHT[t.risk_level] ?? 1;
    max += w;

    if (t.status === "completed" && t.completed_at) {
      const done = new Date(t.completed_at).getTime();
      const due = new Date(t.due_at).getTime();
      if (done <= due) {
        earned += w;
      } else {
        earned += 0.5 * w;
      }
    } else {
      earned += 0;
    }
  }

  const score = max <= 0 ? 100 : Math.round((earned / max) * 100);
  const detail =
    max <= 0
      ? "Aucune tâche échue sur la période — score neutre."
      : `Points obtenus ${earned.toFixed(1)} / ${max} (pondération criticité), sur les tâches dont l’échéance est passée.`;

  return { score, earned, max, detail };
}
