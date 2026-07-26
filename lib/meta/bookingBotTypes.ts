export type BookingBotStep = "idle" | "party_size" | "date" | "time" | "confirm";

export type BookingBotDraft = {
  partySize?: number;
  ymd?: string;
  timeHm?: string;
  offeredSlots?: string[];
};

export type ConversationBookingState = {
  step: BookingBotStep;
  draft?: BookingBotDraft;
  reservationId?: string;
};

export const IDLE_BOOKING_STATE: ConversationBookingState = { step: "idle" };

export function parseConversationBookingState(raw: unknown): ConversationBookingState {
  if (!raw || typeof raw !== "object") return { ...IDLE_BOOKING_STATE };
  const obj = raw as Record<string, unknown>;
  const step = obj.step;
  if (
    step !== "idle" &&
    step !== "party_size" &&
    step !== "date" &&
    step !== "time" &&
    step !== "confirm"
  ) {
    return { ...IDLE_BOOKING_STATE };
  }
  const draftRaw = obj.draft;
  const draft =
    draftRaw && typeof draftRaw === "object"
      ? {
          partySize:
            typeof (draftRaw as { partySize?: unknown }).partySize === "number"
              ? (draftRaw as { partySize: number }).partySize
              : undefined,
          ymd:
            typeof (draftRaw as { ymd?: unknown }).ymd === "string"
              ? (draftRaw as { ymd: string }).ymd
              : undefined,
          timeHm:
            typeof (draftRaw as { timeHm?: unknown }).timeHm === "string"
              ? (draftRaw as { timeHm: string }).timeHm
              : undefined,
          offeredSlots: Array.isArray((draftRaw as { offeredSlots?: unknown }).offeredSlots)
            ? ((draftRaw as { offeredSlots: unknown[] }).offeredSlots.filter(
                (s) => typeof s === "string"
              ) as string[])
            : undefined,
        }
      : undefined;

  return {
    step,
    draft,
    reservationId:
      typeof obj.reservationId === "string" ? obj.reservationId : undefined,
  };
}
