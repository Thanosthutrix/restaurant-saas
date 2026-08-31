export type OAuthFlow = "pro" | "consumer";

export type OAuthProvider = "google" | "apple";

/** Extrait prénom / nom depuis les métadonnées Supabase (Google, Apple…). */
export function extractOAuthNameParts(metadata: Record<string, unknown> | undefined): {
  firstName: string;
  lastName: string;
} {
  if (!metadata) return { firstName: "", lastName: "" };

  const given =
    (typeof metadata.given_name === "string" && metadata.given_name) ||
    (typeof metadata.first_name === "string" && metadata.first_name) ||
    "";
  const family =
    (typeof metadata.family_name === "string" && metadata.family_name) ||
    (typeof metadata.last_name === "string" && metadata.last_name) ||
    "";

  if (given || family) {
    return { firstName: given.trim(), lastName: family.trim() };
  }

  const full =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    "";
  if (!full.trim()) return { firstName: "", lastName: "" };

  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function safeOAuthNextPath(next: string | null | undefined, flow: OAuthFlow): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return flow === "consumer" ? "/compte" : "/dashboard";
}

export function buildOAuthCallbackUrl(origin: string, flow: OAuthFlow, nextPath: string): string {
  const next = safeOAuthNextPath(nextPath, flow);
  const params = new URLSearchParams({ flow, next });
  return `${origin.replace(/\/$/, "")}/auth/callback?${params.toString()}`;
}
