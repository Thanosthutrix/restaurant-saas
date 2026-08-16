import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { PA_ACTIVE_PROVIDER } from "./config";

export type RestaurantPaConnection = {
  restaurant_id: string;
  provider: string;
  provider_company_id: string | null;
  company_number: string | null;
  enrollment_status: string;
  company_verification_status: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  last_invoice_received_at: string | null;
  last_error: string | null;
};

export async function getPaConnection(restaurantId: string): Promise<RestaurantPaConnection | null> {
  const { data, error } = await supabaseServer
    .from("restaurant_pa_connections")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error || !data) return null;
  return data as RestaurantPaConnection;
}

export async function upsertPaConnection(
  restaurantId: string,
  patch: Partial<Omit<RestaurantPaConnection, "restaurant_id">>
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("restaurant_pa_connections")
    .upsert(
      { restaurant_id: restaurantId, provider: PA_ACTIVE_PROVIDER, ...patch },
      { onConflict: "restaurant_id" }
    );
  return { error: error ? new Error(error.message) : null };
}

/** Toutes les connexions actives, pour le sondage périodique. */
export async function listActivePaConnections(): Promise<RestaurantPaConnection[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_pa_connections")
    .select("*")
    .not("access_token", "is", null)
    .not("provider_company_id", "is", null);
  if (error || !data) return [];
  return data as RestaurantPaConnection[];
}
