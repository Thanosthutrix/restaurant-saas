import { NextResponse } from "next/server";
import { bootstrapConsumerProfileFromOAuth } from "@/lib/auth/bootstrapConsumerOAuth";
import { safeOAuthNextPath, type OAuthFlow } from "@/lib/auth/oauthProfile";
import { createClient } from "@/lib/supabase/server";

/** Évite les redirections ouvertes (next doit être un chemin relatif interne). */
function safeInternalPath(next: string | null, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  try {
    const u = new URL(next, "http://localhost");
    if (u.pathname.startsWith("//")) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

function loginPathForFlow(flow: OAuthFlow | null): string {
  return flow === "consumer" ? "/compte/connexion" : "/login";
}

/**
 * Échange le code PKCE (OAuth, recovery e-mail, etc.) contre une session.
 * Configurer dans Supabase : Authentication → URL Configuration → Redirect URLs :
 *   http://localhost:3000/auth/callback
 *   https://www.ubion.fr/auth/callback
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const flowRaw = url.searchParams.get("flow");
  const flow: OAuthFlow | null = flowRaw === "consumer" || flowRaw === "pro" ? flowRaw : null;
  const nextRaw = url.searchParams.get("next");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (!code) {
    const loginPath = loginPathForFlow(flow);
    const errKey = oauthError ? "oauth_echec" : "lien_invalide";
    return NextResponse.redirect(new URL(`${loginPath}?error=${encodeURIComponent(errKey)}`, url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginPath = loginPathForFlow(flow);
    return NextResponse.redirect(
      new URL(`${loginPath}?error=${encodeURIComponent("session_echec")}`, url.origin)
    );
  }

  if (flow === "consumer") {
    const next = safeOAuthNextPath(nextRaw, "consumer");
    if (data.user) {
      await bootstrapConsumerProfileFromOAuth(data.user);
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (flow === "pro") {
    const next = safeOAuthNextPath(nextRaw, "pro");
    const postLogin = `/api/auth/post-login?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(new URL(postLogin, url.origin));
  }

  const next = safeInternalPath(nextRaw, "/auth/update-password");
  return NextResponse.redirect(new URL(next, url.origin));
}
