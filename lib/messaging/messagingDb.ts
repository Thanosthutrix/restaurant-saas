import { supabaseServer } from "@/lib/supabaseServer";

export type MessageChannel = "email" | "sms" | "whatsapp";

/**
 * Tente d’inscrire un envoi « en cours ». Si la clé existe déjà, pas de second envoi.
 */
export async function tryClaimIdempotentDelivery(params: {
  restaurantId: string;
  channel: MessageChannel;
  category: string;
  action: string;
  toAddress: string | null;
  subject: string | null;
  idempotencyKey: string;
}): Promise<{ id: string } | { skip: "duplicate" }> {
  const { data, error } = await supabaseServer
    .from("restaurant_message_deliveries")
    .insert({
      restaurant_id: params.restaurantId,
      channel: params.channel,
      category: params.category,
      action: params.action,
      to_address: params.toAddress,
      subject: params.subject,
      status: "pending",
      idempotency_key: params.idempotencyKey,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { skip: "duplicate" };
    }
    throw new Error(error.message);
  }
  if (!data) {
    return { skip: "duplicate" };
  }
  return { id: (data as { id: string }).id };
}

/**
 * Comme `tryClaimIdempotentDelivery`, mais autorise une nouvelle tentative si l'ancien envoi
 * était `failed` ou `skipped` (ex. configuration Resend corrigée après coup).
 */
export async function tryClaimOrRetryIdempotentDelivery(params: {
  restaurantId: string;
  channel: MessageChannel;
  category: string;
  action: string;
  toAddress: string | null;
  subject: string | null;
  idempotencyKey: string;
}): Promise<{ id: string } | { skip: "duplicate" }> {
  const claim = await tryClaimIdempotentDelivery(params);
  if (!("skip" in claim)) return claim;

  const { data: existing, error: findErr } = await supabaseServer
    .from("restaurant_message_deliveries")
    .select("id, status")
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  const row = existing as { id: string; status: string } | null;
  if (!row) return { skip: "duplicate" };
  if (row.status !== "failed" && row.status !== "skipped") {
    return { skip: "duplicate" };
  }

  const { data: updated, error: updateErr } = await supabaseServer
    .from("restaurant_message_deliveries")
    .update({
      restaurant_id: params.restaurantId,
      channel: params.channel,
      category: params.category,
      action: params.action,
      to_address: params.toAddress,
      subject: params.subject,
      status: "pending",
      provider: null,
      provider_message_id: null,
      error_detail: null,
    })
    .eq("id", row.id)
    .select("id")
    .maybeSingle();

  if (updateErr) throw new Error(updateErr.message);
  if (!updated) return { skip: "duplicate" };
  return { id: (updated as { id: string }).id };
}

export async function updateMessageDelivery(
  id: string,
  patch: {
    status: "pending" | "sent" | "failed" | "skipped";
    provider?: string | null;
    provider_message_id?: string | null;
    error_detail?: string | null;
  }
): Promise<void> {
  const { error } = await supabaseServer
    .from("restaurant_message_deliveries")
    .update({
      status: patch.status,
      provider: patch.provider ?? null,
      provider_message_id: patch.provider_message_id ?? null,
      error_detail: patch.error_detail ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Enregistre un envoi volontairement non effectué (ex. clé Resend absente) — idempotent.
 */
export async function tryRecordSkippedDelivery(params: {
  restaurantId: string;
  channel: MessageChannel;
  category: string;
  action: string;
  toAddress: string | null;
  subject: string | null;
  idempotencyKey: string;
  errorDetail: string;
}): Promise<void> {
  const { error } = await supabaseServer.from("restaurant_message_deliveries").insert({
    restaurant_id: params.restaurantId,
    channel: params.channel,
    category: params.category,
    action: params.action,
    to_address: params.toAddress,
    subject: params.subject,
    status: "skipped",
    idempotency_key: params.idempotencyKey,
    error_detail: params.errorDetail,
  });
  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}
