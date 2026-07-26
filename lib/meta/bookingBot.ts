import "server-only";

import { revalidatePath } from "next/cache";
import { getRestaurantById } from "@/lib/auth";
import {
  addDaysToYmd,
  checkReservationSlotAvailable,
  listAvailableReservationSlots,
  parseFrenchDateInput,
  parseTimeHmInput,
  parisTodayYmd,
} from "@/lib/reservations/availability";
import {
  IDLE_BOOKING_STATE,
  parseConversationBookingState,
  type ConversationBookingState,
} from "./bookingBotTypes";
import {
  createReservationFromMetaConversation,
  formatReservationConfirmationMessage,
} from "./metaReservationService";
import {
  getMetaConversationContext,
  updateConversationBookingState,
} from "./messagingDb";
import { getMetaPageMessagingCredentials, sendMetaConversationReply } from "./messagingSend";
import type { MetaMessagingPlatform } from "./messagingTypes";

const BOOKING_START = /\b(r[eé]serv(er|ation)|table|booking|book)\b/i;
const BOOKING_CANCEL = /\b(annuler|cancel|stop|quit|recommencer)\b/i;
const YES = /^(oui|ok|yes|confirmer|valider)\s*!?\s*$/i;
const NO = /^(non|no)\s*!?\s*$/i;

function formatYmdFr(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

async function reply(params: {
  restaurantId: string;
  platform: MetaMessagingPlatform;
  externalUserId: string;
  customerName: string | null;
  text: string;
}): Promise<void> {
  const creds = await getMetaPageMessagingCredentials(params.restaurantId);
  if (!creds) return;

  await sendMetaConversationReply({
    restaurantId: params.restaurantId,
    platform: params.platform,
    externalUserId: params.externalUserId,
    facebookPageId: creds.facebookPageId,
    pageAccessToken: creds.pageAccessToken,
    text: params.text,
    customerName: params.customerName,
  });
}

async function saveState(conversationId: string, state: ConversationBookingState): Promise<void> {
  await updateConversationBookingState(conversationId, state);
}

export async function processInboundMetaBookingBot(params: {
  restaurantId: string;
  conversationId: string;
  platform: MetaMessagingPlatform;
  externalUserId: string;
  customerName: string | null;
  text: string | null;
}): Promise<void> {
  const inbound = params.text?.trim();
  if (!inbound) return;

  const ctx = await getMetaConversationContext(params.restaurantId, params.conversationId);
  if (!ctx) return;

  let state = parseConversationBookingState(ctx.bookingState);

  if (BOOKING_CANCEL.test(inbound) && state.step !== "idle") {
    await saveState(params.conversationId, { ...IDLE_BOOKING_STATE });
    await reply({
      ...params,
      text: "D'accord, j'annule la demande de réservation. Tapez « réserver » quand vous voulez recommencer.",
    });
    return;
  }

  if (state.step === "idle") {
    if (!BOOKING_START.test(inbound)) return;
    state = { step: "party_size", draft: {} };
    await saveState(params.conversationId, state);
    await reply({
      ...params,
      text: "Avec plaisir ! Pour combien de personnes souhaitez-vous réserver ? (1 à 12)",
    });
    return;
  }

  const draft = { ...(state.draft ?? {}) };

  if (state.step === "party_size") {
    const n = Number.parseInt(inbound.replace(/\D/g, ""), 10);
    if (!Number.isInteger(n) || n < 1 || n > 12) {
      await reply({
        ...params,
        text: "Indiquez un nombre entre 1 et 12 (ex. 4).",
      });
      return;
    }
    draft.partySize = n;
    state = { step: "date", draft };
    await saveState(params.conversationId, state);
    await reply({
      ...params,
      text: `Pour ${n} personne${n > 1 ? "s" : ""}. Quelle date ? (ex. demain, 28/07 ou 28/07/2026)`,
    });
    return;
  }

  if (state.step === "date") {
    const ymd = parseFrenchDateInput(inbound);
    if (!ymd) {
      await reply({
        ...params,
        text: "Date non reconnue. Exemples : demain, 26/07 ou 26/07/2026.",
      });
      return;
    }
    if (ymd < parisTodayYmd()) {
      await reply({ ...params, text: "Choisissez une date à partir d'aujourd'hui." });
      return;
    }

    draft.ymd = ymd;
    const { slots, error } = await listAvailableReservationSlots({
      restaurantId: params.restaurantId,
      ymd,
      partySize: draft.partySize ?? 2,
      limit: 8,
    });

    if (error || slots.length === 0) {
      await saveState(params.conversationId, { step: "date", draft: { partySize: draft.partySize } });
      await reply({
        ...params,
        text:
          error ??
          "Aucun créneau disponible ce jour-là. Proposez une autre date (ex. " +
            formatYmdFr(addDaysToYmd(ymd, 1)) +
            ").",
      });
      return;
    }

    draft.offeredSlots = slots;
    state = { step: "time", draft };
    await saveState(params.conversationId, state);

    const lines = slots.map((slot, i) => `${i + 1}. ${slot.replace(":", "h")}`);
    await reply({
      ...params,
      text: `Créneaux disponibles le ${formatYmdFr(ymd)} :\n${lines.join("\n")}\n\nRépondez avec le numéro ou l'heure (ex. 19h30).`,
    });
    return;
  }

  if (state.step === "time") {
    let timeHm: string | null = null;
    const trimmed = inbound.trim();
    const offered = draft.offeredSlots ?? [];

    if (/^\d+$/.test(trimmed)) {
      const option = Number.parseInt(trimmed, 10);
      if (option >= 1 && option <= offered.length) {
        timeHm = offered[option - 1] ?? null;
      }
    }

    if (!timeHm) {
      timeHm = parseTimeHmInput(trimmed);
    }

    if (!timeHm || !draft.ymd) {
      await reply({
        ...params,
        text: "Heure non reconnue. Choisissez un numéro dans la liste ou tapez une heure (ex. 19h30).",
      });
      return;
    }

    const pickedFromOfferedList = offered.includes(timeHm);
    if (!pickedFromOfferedList) {
      const available = await checkReservationSlotAvailable({
        restaurantId: params.restaurantId,
        ymd: draft.ymd,
        timeHm,
        partySize: draft.partySize ?? 2,
      });
      if (!available) {
        await reply({
          ...params,
          text: "Ce créneau n'est pas disponible. Choisissez un numéro dans la liste ou une autre heure.",
        });
        return;
      }
    }

    draft.timeHm = timeHm;
    state = { step: "confirm", draft };
    await saveState(params.conversationId, state);

    await reply({
      ...params,
      text: [
        "Récapitulatif :",
        `• ${draft.partySize} personne${(draft.partySize ?? 0) > 1 ? "s" : ""}`,
        `• ${formatYmdFr(draft.ymd)} à ${timeHm.replace(":", "h")}`,
        "",
        "Confirmez-vous ? (oui / non)",
      ].join("\n"),
    });
    return;
  }

  if (state.step === "confirm") {
    if (NO.test(inbound)) {
      await saveState(params.conversationId, { ...IDLE_BOOKING_STATE });
      await reply({ ...params, text: "Réservation annulée. Tapez « réserver » pour recommencer." });
      return;
    }
    if (!YES.test(inbound)) {
      await reply({ ...params, text: "Répondez oui pour confirmer ou non pour annuler." });
      return;
    }

    if (!draft.ymd || !draft.timeHm || !draft.partySize) {
      await saveState(params.conversationId, { ...IDLE_BOOKING_STATE });
      await reply({ ...params, text: "La session a expiré. Tapez « réserver » pour recommencer." });
      return;
    }

    const created = await createReservationFromMetaConversation({
      restaurantId: params.restaurantId,
      platform: params.platform,
      contactName: params.customerName ?? ctx.customerName,
      ymd: draft.ymd,
      timeHm: draft.timeHm,
      partySize: draft.partySize,
    });

    if ("error" in created) {
      await reply({
        ...params,
        text: `Impossible d'enregistrer la réservation : ${created.error}. Tapez « réserver » pour réessayer.`,
      });
      return;
    }

    const restaurant = await getRestaurantById(params.restaurantId);
    await saveState(params.conversationId, {
      step: "idle",
      reservationId: created.reservationId,
    });

    revalidatePath("/reservations");
    revalidatePath("/communication");

    await reply({
      ...params,
      text: formatReservationConfirmationMessage({
        partySize: draft.partySize,
        ymd: draft.ymd,
        timeHm: draft.timeHm,
        restaurantName: restaurant?.name ?? null,
      }),
    });
  }
}
