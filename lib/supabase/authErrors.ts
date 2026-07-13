/** Message utilisateur pour les erreurs réseau Supabase Auth (Safari affiche souvent « Load failed »). */
export function formatAuthClientError(message: string): string {
  const normalized = message.trim().toLowerCase();
  if (
    normalized === "fetch failed" ||
    normalized === "load failed" ||
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed")
  ) {
    return "Impossible de contacter le serveur d'authentification. Vérifiez votre connexion internet. Si le problème persiste, la configuration Supabase du site doit être mise à jour.";
  }
  return message;
}

/** Session expirée ou cookies auth obsolètes (changement de projet Supabase, déconnexion serveur…). */
export function isStaleAuthSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; code?: string; status?: number };
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("refresh token not found") ||
    msg.includes("invalid refresh token") ||
    e.code === "refresh_token_not_found" ||
    (e.status === 400 && msg.includes("refresh"))
  );
}

/** Vérifie que l'API Supabase Auth répond (utilisé côté serveur). */
export async function isSupabaseAuthReachable(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return false;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { apikey: anonKey },
    });
    return res.ok;
  } catch {
    return false;
  }
}
