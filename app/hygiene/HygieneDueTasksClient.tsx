"use client";

import type { HygieneTaskWithElement } from "@/lib/hygiene/hygieneDb";
import { HygieneTasksPanel } from "@/components/hygiene/HygieneTasksPanel";

export function HygieneDueTasksClient({
  restaurantId,
  tasks,
  dueCount,
}: {
  restaurantId: string;
  tasks: HygieneTaskWithElement[];
  dueCount: number;
}) {
  return (
    <HygieneTasksPanel
      restaurantId={restaurantId}
      due={tasks}
      preview
      totalDueCount={dueCount}
    />
  );
}
