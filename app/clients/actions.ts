"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import {
  addTimelineEvent,
  assignTagToCustomer,
  createCustomer,
  createCustomerTag,
  fetchAllCustomersForExport,
  buildCustomersCsvExport,
  findDuplicateCandidates,
  registerVisit,
  removeTagFromCustomer,
  searchCustomersLookup,
  updateCustomer,
} from "@/lib/customers/customersDb";
import { normalizePhoneForDedup } from "@/lib/customers/phoneNormalize";
import type { TimelineEventType } from "@/lib/customers/types";

async function assertClientsMutate(userId: string, restaurantId: string) {
  return assertRestaurantAction(userId, restaurantId, "clients.mutate");
}

export async function createCustomerAction(
  restaurantId: string,
  payload: Parameters<typeof createCustomer>[1]
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const c = await createCustomer(restaurantId, { ...payload, created_by_user_id: user.id });
  if (!c) return { ok: false, error: "Impossible de créer la fiche." };
  revalidatePath("/clients");
  return { ok: true, id: c.id };
}

export async function updateCustomerAction(
  restaurantId: string,
  customerId: string,
  payload: Parameters<typeof updateCustomer>[2]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const c = await updateCustomer(restaurantId, customerId, payload, user.id);
  if (!c) return { ok: false, error: "Mise à jour impossible." };
  revalidatePath("/clients");
  revalidatePath(`/clients/${customerId}`);
  revalidatePath("/salle");
  revalidatePath("/caisse");
  return { ok: true };
}

export async function createCustomerTagAction(
  restaurantId: string,
  label: string,
  color?: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const t = await createCustomerTag(restaurantId, label, color);
  if (!t) return { ok: false, error: "Étiquette déjà existante ou invalide." };
  revalidatePath("/clients");
  return { ok: true, id: t.id };
}

export async function assignCustomerTagAction(
  restaurantId: string,
  customerId: string,
  tagId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const ok = await assignTagToCustomer(restaurantId, customerId, tagId, user.id);
  if (!ok) return { ok: false, error: "Impossible d’assigner l’étiquette." };
  revalidatePath("/clients");
  revalidatePath(`/clients/${customerId}`);
  return { ok: true };
}

export async function removeCustomerTagAction(
  restaurantId: string,
  customerId: string,
  tagId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const ok = await removeTagFromCustomer(restaurantId, customerId, tagId, user.id);
  if (!ok) return { ok: false, error: "Impossible de retirer l’étiquette." };
  revalidatePath("/clients");
  revalidatePath(`/clients/${customerId}`);
  return { ok: true };
}

export async function addCustomerNoteAction(
  restaurantId: string,
  customerId: string,
  title: string,
  body: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const ev = await addTimelineEvent(
    restaurantId,
    customerId,
    "note",
    title,
    body.trim() || null,
    {},
    user.id
  );
  if (!ev) return { ok: false, error: "Impossible d’ajouter la note." };
  revalidatePath(`/clients/${customerId}`);
  return { ok: true };
}

export async function addCustomerTimelineEventAction(
  restaurantId: string,
  customerId: string,
  eventType: TimelineEventType,
  title: string,
  body: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const ev = await addTimelineEvent(restaurantId, customerId, eventType, title, body, {}, user.id);
  if (!ev) return { ok: false, error: "Impossible d’enregistrer l’événement." };
  revalidatePath(`/clients/${customerId}`);
  return { ok: true };
}

export async function registerCustomerVisitAction(
  restaurantId: string,
  customerId: string,
  note?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const ok = await registerVisit(restaurantId, customerId, user.id, note);
  if (!ok) return { ok: false, error: "Impossible d’enregistrer la visite." };
  revalidatePath("/clients");
  revalidatePath(`/clients/${customerId}`);
  return { ok: true };
}

export async function deactivateCustomerAction(
  restaurantId: string,
  customerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const c = await updateCustomer(restaurantId, customerId, { is_active: false }, user.id);
  if (!c) return { ok: false, error: "Impossible d’archiver." };
  revalidatePath("/clients");
  revalidatePath(`/clients/${customerId}`);
  return { ok: true };
}

export async function exportCustomersCsvAction(
  restaurantId: string
): Promise<{ ok: true; csv: string; filename: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const rows = await fetchAllCustomersForExport(restaurantId);
  const csv = buildCustomersCsvExport(rows);
  const fn = `clients-${restaurantId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
  return { ok: true, csv, filename: fn };
}

/** Pour avertissement avant création : fiches avec même email ou téléphone normalisé. */
/** Recherche pour ticket caisse / association commande (autocomplétion serveur). */
export async function searchCustomersLookupAction(
  restaurantId: string,
  query: string
): Promise<
  { ok: true; rows: Awaited<ReturnType<typeof searchCustomersLookup>> } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const rows = await searchCustomersLookup(restaurantId, query, 12);
  return { ok: true, rows };
}

export async function findDuplicateCustomersAction(
  restaurantId: string,
  email: string | null,
  phone: string | null,
  excludeCustomerId?: string
): Promise<{ ok: true; matches: Awaited<ReturnType<typeof findDuplicateCandidates>> } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertClientsMutate(user.id, restaurantId);
  if (!gate.ok) return gate;
  const phoneNorm = normalizePhoneForDedup(phone);
  const matches = await findDuplicateCandidates(restaurantId, email, phoneNorm, excludeCustomerId);
  return { ok: true, matches };
}
