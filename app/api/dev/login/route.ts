import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient } from "@/lib/supabase/server";

/**
 * Connexion DEV-ONLY sur un compte de test — pour les tests automatisés locaux
 * (agent/outillage) sans saisie de mot de passe.
 *
 * Triple verrou (la route est inerte en production) :
 *   1. NODE_ENV doit être "development" ;
 *   2. DEV_TEST_LOGIN=1 doit être défini (dans `.env.local`, jamais sur l'hébergeur) ;
 *   3. l'hôte doit être localhost / 127.0.0.1.
 *
 * Fonctionnement : crée (si besoin) l'utilisateur de test, génère un jeton magic-link
 * côté serveur (admin API) puis l'échange contre une session via le client SSR —
 * les cookies de session sont posés comme pour un vrai login. Aucun mot de passe.
 */

const DEFAULT_TEST_EMAIL = "dev-test@ubion.local";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  if (
    process.env.NODE_ENV === "production" ||
    process.env.DEV_TEST_LOGIN !== "1" ||
    !isLocalhost
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const email = process.env.DEV_TEST_LOGIN_EMAIL?.trim() || DEFAULT_TEST_EMAIL;

  // Crée l'utilisateur de test s'il n'existe pas encore (idempotent).
  const { error: createErr } = await supabaseServer.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createErr && !/already|exists/i.test(createErr.message)) {
    return NextResponse.json({ error: createErr.message }, { status: 500 });
  }

  // Jeton magic-link généré côté serveur (jamais envoyé par e-mail).
  const { data: linkData, error: linkErr } = await supabaseServer.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    return NextResponse.json(
      { error: linkErr?.message ?? "generateLink: jeton manquant." },
      { status: 500 }
    );
  }

  // Échange du jeton contre une session : pose les cookies comme un vrai login.
  const supabase = await createClient();
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (otpErr) {
    return NextResponse.json({ error: otpErr.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
