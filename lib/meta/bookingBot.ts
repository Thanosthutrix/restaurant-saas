import "server-only";

import { revalidatePath } from "next/cache";
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
  formatReservationReference,
} from "./metaReservationService";
import { notifyTeamMetaReservationCreated } from "@/lib/push/notifyMetaReservation";
import {
  getMetaConversationContext,
  updateConversationBookingState,
} from "./messagingDb";
import {
  BOOKING_CONFIRM_QUICK_REPLIES,
  BOOKING_QUICK_REPLY,
  BOOKING_START_QUICK_REPLIES,
  getMetaPageMessagingCredentials,
  getRestaurantMessagingDetails,
  sendMetaConversationReply,
  sendMetaConversationReplyWithQuickReplies,
} from "./messagingSend";
import type { MetaMessagingPlatform } from "./messagingTypes";

const BOOKING_START = /\b(r[eé]serv(er|ation)|table|booking|book)\b/i;

function isBookingStartIntent(inbound: string, actionPayload: string | null): boolean {
  if (actionPayload === BOOKING_QUICK_REPLY.start) return true;
  return BOOKING_START.test(inbound);
}
const BOOKING_CANCEL = /\b(annuler|cancel|stop|quit|recommencer)\b/i;
const YES = /^(oui|ok|yes|confirmer|valider)\s*!?\s*$/i;
const NO = /^(non|no)\s*!?\s*$/i;

function resolveConfirmChoice(
  inbound: string,
  quickReplyPayload?: string | null
): "yes" | "no" | null {
  if (quickReplyPayload === BOOKING_QUICK_REPLY.confirmYes) return "yes";
  if (quickReplyPayload === BOOKING_QUICK_REPLY.confirmNo) return "no";
  if (YES.test(inbound.trim())) return "yes";
  if (NO.test(inbound.trim())) return "no";
  return null;
}

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
  quickReplies?: typeof BOOKING_CONFIRM_QUICK_REPLIES;
}): Promise<void> {
  const creds = await getMetaPageMessagingCredentials(params.restaurantId);
  if (!creds) return;

  if (params.quickReplies?.length) {
    await sendMetaConversationReplyWithQuickReplies({
      restaurantId: params.restaurantId,
      platform: params.platform,
      externalUserId: params.externalUserId,
      facebookPageId: creds.facebookPageId,
      pageAccessToken: creds.pageAccessToken,
      text: params.text,
      quickReplies: params.quickReplies,
      customerName: params.customerName,
    });
    return;
  }

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

async function markInboundProcessed(
  conversationId: string,
  state: ConversationBookingState,
  inboundMessageId: string | null | undefined
): Promise<void> {
  if (!inboundMessageId) return;
  await saveState(conversationId, {
    ...state,
    lastProcessedInboundId: inboundMessageId,
  });
}

export async function processInboundMetaBookingBot(params: {
  restaurantId: string;
  conversationId: string;
  platform: MetaMessagingPlatform;
  externalUserId: string;
  customerName: string | null;
  text: string | null;
  inboundMessageId?: string | null;
  quickReplyPayload?: string | null;
  postbackPayload?: string | null;
}): Promise<void> {
  const inbound = params.text?.trim() ?? "";
  const actionPayload = params.quickReplyPayload ?? params.postbackPayload ?? null;
  if (!inbound && !actionPayload) return;

  const ctx = await getMetaConversationContext(params.restaurantId, params.conversationId);
  if (!ctx) return;

  let state = parseConversationBookingState(ctx.bookingState);

  if (params.inboundMessageId && state.lastProcessedInboundId === params.inboundMessageId) {
    return;
  }

  if (BOOKING_CANCEL.test(inbound) && state.step !== "idle") {
    await saveState(params.conversationId, {
      ...IDLE_BOOKING_STATE,
      welcomeSent: state.welcomeSent,
      lastProcessedInboundId: params.inboundMessageId ?? state.lastProcessedInboundId,
    });
    await reply({
      ...params,
      text: "D'accord, j'annule la demande de réservation. Utilisez le bouton « Réserver » ou tapez « réserver » pour recommencer.",
    });
    return;
  }

  if (state.step === "idle") {
    if (isBookingStartIntent(inbound, actionPayload)) {
      state = {
        step: "party_size",
        draft: {},
        welcomeSent: true,
        lastProcessedInboundId: params.inboundMessageId ?? state.lastProcessedInboundId,
      };
      await saveState(params.conversationId, state);
      await reply({
        ...params,
        text: "Avec plaisir ! Pour combien de personnes souhaitez-vous réserver ? (1 à 12)",
      });
      return;
    }

    if (!state.welcomeSent && (inbound || actionPayload)) {
      await saveState(params.conversationId, {
        step: "idle",
        welcomeSent: true,
        lastProcessedInboundId: params.inboundMessageId ?? state.lastProcessedInboundId,
      });
      await reply({
        ...params,
        text: "Bonjour ! Souhaitez-vous réserver une table ?",
        quickReplies: BOOKING_START_QUICK_REPLIES,
      });
      return;
    }

    await markInboundProcessed(params.conversationId, state, params.inboundMessageId);
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
    state = {
      step: "date",
      draft,
      welcomeSent: true,
      lastProcessedInboundId: params.inboundMessageId ?? state.lastProcessedInboundId,
    };
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
    state = {
      step: "time",
      draft,
      welcomeSent: true,
      lastProcessedInboundId: params.inboundMessageId ?? state.lastProcessedInboundId,
    };
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
    state = {
      step: "confirm",
      draft,
      welcomeSent: true,
      lastProcessedInboundId: params.inboundMessageId ?? state.lastProcessedInboundId,
    };
    await saveState(params.conversationId, state);

    await reply({
      ...params,
      text: [
        "Récapitulatif :",
        `• ${draft.partySize} personne${(draft.partySize ?? 0) > 1 ? "s" : ""}`,
        `• ${formatYmdFr(draft.ymd)} à ${timeHm.replace(":", "h")}`,
        "",
        "Confirmez-vous cette réservation ?",
      ].join("\n"),
      quickReplies: BOOKING_CONFIRM_QUICK_REPLIES,
    });
    return;
  }

  if (state.step === "confirm") {
    const choice = resolveConfirmChoice(inbound, actionPayload);
    if (choice === "no") {
      await saveState(params.conversationId, {
        ...IDLE_BOOKING_STATE,
        welcomeSent: true,
        lastProcessedInboundId: params.inboundMessageId ?? state.lastProcessedInboundId,
      });
      await reply({
        ...params,
        text: "Réservation annulée. Utilisez le bouton « Réserver » ou tapez « réserver » pour recommencer.",
      });
      return;
    }
    if (choice !== "yes") {
      await reply({
        ...params,
        text: "Répondez Oui pour confirmer ou Non pour annuler (boutons ou texte).",
        quickReplies: BOOKING_CONFIRM_QUICK_REPLIES,
      });
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

    const details = await getRestaurantMessagingDetails(params.restaurantId);
    await saveState(params.conversationId, {
      step: "idle",
      reservationId: created.reservationId,
      welcomeSent: true,
      lastProcessedInboundId: params.inboundMessageId ?? state.lastProcessedInboundId,
    });

    revalidatePath("/reservations");
    revalidatePath("/communication");

    void notifyTeamMetaReservationCreated({
      restaurantId: params.restaurantId,
      reservationId: created.reservationId,
      partySize: draft.partySize,
      startsAtIso: created.startsAt,
      contactName: params.customerName ?? ctx.customerName,
      platform: params.platform,
    }).catch((err) => {
      console.warn("[meta/bookingBot] push équipe:", err);
    });

    await reply({
      ...params,
      text: formatReservationConfirmationMessage({
        partySize: draft.partySize,
        startsAtIso: created.startsAt,
        reservationRef: formatReservationReference(created.reservationId),
        restaurantName: details.name,
        restaurantAddress: details.address,
        restaurantPhone: details.phone,
      }),
    });
  }
}
