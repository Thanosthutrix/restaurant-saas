"use server";

import { revalidatePath } from "next/cache";
import { getAccessibleRestaurantsForUser, getCurrentUser } from "@/lib/auth";
import { isPaOAuthConfigured } from "@/lib/pa/config";
import { buildPaAuthorizeUrl } from "@/lib/pa/oauthClient";
import { encodePaOAuthState } from "@/lib/pa/oauthState";
import { syncPaInvoicesForRestaurant, type SyncResult } from "@/lib/pa/syncInvoices";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function assertRestaurantAccess(userId: string, restaurantId: string): Promise<ActionResult> {
  const list = await getAccessibleRestaurantsForUser(userId);
  if (!list.some((r) => r.id === restaurantId)) {
    return { ok: false, error: "Accès refusé à ce restaurant." };
  }
  return { ok: true };
}

/** Construit l'URL de consentement Super PDP pour ce restaurant (bouton « Connecter »). */
export async function startPaOAuthAction(restaurantId: string): Promise<ActionResult<{ url: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour continuer." };
  if (!isPaOAuthConfigured()) {
    return { ok: false, error: "OAuth Super PDP non configuré (SUPER_PDP_CLIENT_ID / SUPER_PDP_CLIENT_SECRET)." };
  }

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  const state = encodePaOAuthState({ restaurantId, userId: user.id, ts: Date.now() });
  const url = buildPaAuthorizeUrl({ state, companyNumberScheme: "sandbox" });
  return { ok: true, data: { url } };
}

/** Déclenche un sondage manuel des factures reçues (avant qu'un cron ne le fasse automatiquement). */
export async function syncPaInvoicesAction(restaurantId: string): Promise<ActionResult<SyncResult>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour continuer." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  const result = await syncPaInvoicesForRestaurant(restaurantId);
  revalidatePath("/supplier-invoices");
  if (result.error) return { ok: false, error: result.error };
  return { ok: true, data: result };
}
