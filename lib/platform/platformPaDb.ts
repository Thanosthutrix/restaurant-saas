import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { PA_ACTIVE_PROVIDER } from "@/lib/pa/config";

export type PlatformPaConnection = {
  company_id: string;
  provider: string;
  provider_company_id: string | null;
  company_number: string | null;
  enrollment_status: string;
  company_verification_status: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  last_invoice_received_at: string | null;
  last_invoice_emitted_at: string | null;
  last_error: string | null;
};

export async function getPlatformPaConnection(companyId: string): Promise<PlatformPaConnection | null> {
  const { data, error } = await supabaseServer
    .from("platform_pa_connections")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PlatformPaConnection;
}

export async function upsertPlatformPaConnection(
  companyId: string,
  patch: Partial<Omit<PlatformPaConnection, "company_id">>
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer.from("platform_pa_connections").upsert(
    { company_id: companyId, provider: PA_ACTIVE_PROVIDER, ...patch, updated_at: new Date().toISOString() },
    { onConflict: "company_id" }
  );
  return { error: error ? new Error(error.message) : null };
}

export async function listActivePlatformPaConnections(): Promise<PlatformPaConnection[]> {
  const { data, error } = await supabaseServer
    .from("platform_pa_connections")
    .select("*")
    .not("access_token", "is", null)
    .not("provider_company_id", "is", null);
  if (error || !data) return [];
  return data as PlatformPaConnection[];
}
