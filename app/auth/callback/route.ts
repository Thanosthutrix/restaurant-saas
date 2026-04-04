import { NextResponse } from "next/server";
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

/**
 * Échange le code PKCE reçu par e-mail (inscription, recovery, etc.) contre une session.
 * Configurer dans Supabase : Authentication → URL Configuration → Redirect URLs :
 *   http://localhost:3000/auth/callback
 *   https://votre-domaine.com/auth/callback
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next");
  const next = safeInternalPath(nextRaw, "/auth/update-password");

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("lien_invalide")}`, url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("session_echec")}`, url.origin)
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
