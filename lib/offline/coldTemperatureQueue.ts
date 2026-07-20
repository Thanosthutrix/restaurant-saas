import type { HygieneColdEventKind } from "@/lib/hygiene/types";
import { idbDelete, idbGetAll, idbPut } from "@/lib/offline/idb";

export const OFFLINE_QUEUE_CHANGED_EVENT = "ubion-offline-queue-changed";

const STORE = "coldTemperatureQueue";

export type QueuedColdTemperatureReading = {
  id: string;
  restaurantId: string;
  elementId: string;
  elementName?: string;
  eventKind: HygieneColdEventKind;
  temperatureCelsiusRaw: string;
  initials: string;
  comment: string | null;
  queuedAt: string;
};

function notifyQueueChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_CHANGED_EVENT));
}

export async function listQueuedColdReadings(): Promise<QueuedColdTemperatureReading[]> {
  if (typeof window === "undefined") return [];
  try {
    const rows = await idbGetAll<QueuedColdTemperatureReading>(STORE);
    return rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  } catch {
    return [];
  }
}

export async function listQueuedColdReadingsForRestaurant(
  restaurantId: string
): Promise<QueuedColdTemperatureReading[]> {
  const all = await listQueuedColdReadings();
  return all.filter((row) => row.restaurantId === restaurantId);
}

export async function enqueueColdTemperatureReading(
  entry: Omit<QueuedColdTemperatureReading, "id" | "queuedAt"> & { id?: string }
): Promise<QueuedColdTemperatureReading> {
  const row: QueuedColdTemperatureReading = {
    ...entry,
    id: entry.id ?? crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  };
  await idbPut(STORE, row);
  notifyQueueChanged();
  return row;
}

export async function removeQueuedColdReading(id: string): Promise<void> {
  await idbDelete(STORE, id);
  notifyQueueChanged();
}

export async function countQueuedColdReadings(): Promise<number> {
  const rows = await listQueuedColdReadings();
  return rows.length;
}
