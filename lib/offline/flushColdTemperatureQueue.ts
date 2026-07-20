import { logColdTemperatureReadingAction } from "@/app/hygiene/actions";
import {
  listQueuedColdReadings,
  removeQueuedColdReading,
  type QueuedColdTemperatureReading,
} from "@/lib/offline/coldTemperatureQueue";

export type FlushQueueResult = {
  synced: number;
  failed: number;
  remaining: number;
};

async function syncOne(item: QueuedColdTemperatureReading): Promise<boolean> {
  const result = await logColdTemperatureReadingAction(item.restaurantId, item.elementId, {
    eventKind: item.eventKind,
    temperatureCelsiusRaw: item.temperatureCelsiusRaw,
    initials: item.initials,
    comment: item.comment,
  });
  if (!result.ok) return false;
  await removeQueuedColdReading(item.id);
  return true;
}

export async function flushColdTemperatureQueue(): Promise<FlushQueueResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const remaining = (await listQueuedColdReadings()).length;
    return { synced: 0, failed: 0, remaining };
  }

  const items = await listQueuedColdReadings();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    const ok = await syncOne(item);
    if (ok) synced += 1;
    else failed += 1;
  }

  const remaining = (await listQueuedColdReadings()).length;
  return { synced, failed, remaining };
}
