"use client";

import type { HygieneTaskWithElement } from "@/lib/hygiene/hygieneDb";
import { HygieneTasksPanel } from "@/components/hygiene/HygieneTasksPanel";

export function HygieneTasksClient({
  restaurantId,
  due,
  upcoming,
}: {
  restaurantId: string;
  due: HygieneTaskWithElement[];
  upcoming: HygieneTaskWithElement[];
}) {
  return <HygieneTasksPanel restaurantId={restaurantId} due={due} upcoming={upcoming} />;
}
