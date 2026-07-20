import { logColdTemperatureReadingAction } from "@/app/hygiene/actions";
import type { HygieneColdEventKind } from "@/lib/hygiene/types";
import { enqueueColdTemperatureReading } from "@/lib/offline/coldTemperatureQueue";

export type ColdReadingSubmitParams = {
  eventKind: HygieneColdEventKind;
  temperatureCelsiusRaw: string;
  initials: string;
  comment: string | null;
  elementName?: string;
};

export type ColdReadingSubmitResult =
  | { ok: true; queued: false }
  | { ok: true; queued: true }
  | { ok: false; error: string };

function shouldQueueAfterFailure(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("timeout") ||
    lower.includes("connexion")
  );
}

export async function submitColdTemperatureReading(
  restaurantId: string,
  elementId: string,
  params: ColdReadingSubmitParams
): Promise<ColdReadingSubmitResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueColdTemperatureReading({
      restaurantId,
      elementId,
      elementName: params.elementName,
      eventKind: params.eventKind,
      temperatureCelsiusRaw: params.temperatureCelsiusRaw,
      initials: params.initials,
      comment: params.comment,
    });
    return { ok: true, queued: true };
  }

  try {
    const result = await logColdTemperatureReadingAction(restaurantId, elementId, {
      eventKind: params.eventKind,
      temperatureCelsiusRaw: params.temperatureCelsiusRaw,
      initials: params.initials,
      comment: params.comment,
    });

    if (result.ok) return { ok: true, queued: false };

    if (shouldQueueAfterFailure(result.error)) {
      await enqueueColdTemperatureReading({
        restaurantId,
        elementId,
        elementName: params.elementName,
        eventKind: params.eventKind,
        temperatureCelsiusRaw: params.temperatureCelsiusRaw,
        initials: params.initials,
        comment: params.comment,
      });
      return { ok: true, queued: true };
    }

    return result;
  } catch {
    await enqueueColdTemperatureReading({
      restaurantId,
      elementId,
      elementName: params.elementName,
      eventKind: params.eventKind,
      temperatureCelsiusRaw: params.temperatureCelsiusRaw,
      initials: params.initials,
      comment: params.comment,
    });
    return { ok: true, queued: true };
  }
}
