"use client";

import { useEffect, useState } from "react";
import {
  listQueuedColdReadingsForRestaurant,
  OFFLINE_QUEUE_CHANGED_EVENT,
  type QueuedColdTemperatureReading,
} from "@/lib/offline/coldTemperatureQueue";
import type { HygieneColdEventKind } from "@/lib/hygiene/types";

export function useQueuedColdReadings(restaurantId: string, eventKind?: HygieneColdEventKind) {
  const [queued, setQueued] = useState<QueuedColdTemperatureReading[]>([]);

  useEffect(() => {
    async function load() {
      const rows = await listQueuedColdReadingsForRestaurant(restaurantId);
      setQueued(eventKind ? rows.filter((r) => r.eventKind === eventKind) : rows);
    }
    void load();

    function handleChange() {
      void load();
    }
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleChange);
  }, [restaurantId, eventKind]);

  return queued;
}

export function queuedReadingsByElement(
  queued: QueuedColdTemperatureReading[]
): Record<string, QueuedColdTemperatureReading> {
  return Object.fromEntries(queued.map((row) => [row.elementId, row]));
}
