import {
  countHygieneTasksDue,
  ensureHygieneTasksForRestaurant,
  getHygieneScoreForRestaurant,
  listHygieneTasksDue,
} from "@/lib/hygiene/hygieneDb";
import {
  countPendingTemperatureTasks,
  ensureTemperatureTasksForRestaurant,
  listPendingTemperatureTasks,
} from "@/lib/haccpTemperature/haccpTemperatureDb";
import type { DashboardHygieneTaskItem } from "@/lib/dashboard/hygieneTileTypes";
import { HYGIENE_RISK_LABEL_FR, type HygieneRiskLevel } from "@/lib/hygiene/types";

function formatDueLabel(iso: string, now: Date): { label: string; overdue: boolean } {
  const due = new Date(iso);
  const overdue = due.getTime() < now.getTime();
  const label = due.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { label: overdue ? `En retard · ${label}` : `Échéance ${label}`, overdue };
}

export async function loadDashboardHygieneTileData(restaurantId: string): Promise<{
  score: number;
  scoreDetail: string;
  tasks: DashboardHygieneTaskItem[];
}> {
  await Promise.all([
    ensureHygieneTasksForRestaurant(restaurantId, 14),
    ensureTemperatureTasksForRestaurant(restaurantId, 14),
  ]);

  const now = new Date();
  const [score, cleaningTasks, tempTasks] = await Promise.all([
    getHygieneScoreForRestaurant(restaurantId, 7),
    listHygieneTasksDue(restaurantId, 25),
    listPendingTemperatureTasks(restaurantId, 25),
  ]);

  type SortableItem = DashboardHygieneTaskItem & { dueAt: string };
  const items: SortableItem[] = [];

  for (const t of cleaningTasks) {
    const { label, overdue } = formatDueLabel(t.due_at, now);
    const riskLabel =
      t.risk_level in HYGIENE_RISK_LABEL_FR
        ? HYGIENE_RISK_LABEL_FR[t.risk_level as HygieneRiskLevel]
        : t.risk_level;
    items.push({
      id: t.id,
      kind: "cleaning",
      title: t.element_name,
      subtitle: t.area_label || "",
      dueLabel: label,
      riskLabel,
      href: "/hygiene/a-faire",
      overdue,
      dueAt: t.due_at,
    });
  }

  for (const t of tempTasks) {
    const { label, overdue } = formatDueLabel(t.due_at, now);
    items.push({
      id: t.id,
      kind: "temperature",
      title: t.point_name,
      subtitle: t.location || "Relevé HACCP",
      dueLabel: label,
      href: "/hygiene/haccp/check",
      overdue,
      dueAt: t.due_at,
    });
  }

  items.sort((a, b) => {
    const overdueDiff = Number(b.overdue) - Number(a.overdue);
    if (overdueDiff !== 0) return overdueDiff;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });

  return {
    score: score.score,
    scoreDetail: score.detail,
    tasks: items.slice(0, 12).map(({ dueAt: _dueAt, ...task }) => task),
  };
}

export async function countDashboardHygienePending(restaurantId: string): Promise<number> {
  const [cleaning, temp] = await Promise.all([
    countHygieneTasksDue(restaurantId),
    countPendingTemperatureTasks(restaurantId),
  ]);
  return cleaning + temp;
}
