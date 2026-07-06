import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseAuthReachable } from "@/lib/supabase/authErrors";
import { LoginForm } from "./LoginForm";
import { uiAuthCard, uiInfoBanner, uiLead, uiPageTitle, uiTextLink, uiLinkSubtle } from "@/components/ui/premium";

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  lien_invalide: "Ce lien n’est plus valide ou est incomplet. Demandez un nouvel e-mail de réinitialisation.",
  session_echec: "La connexion depuis le lien e-mail a échoué. Réessayez ou demandez un nouveau lien.",
  session_requise: "Ouvrez le lien reçu par e-mail, ou connectez-vous si vous avez déjà un mot de passe.",
  session_expiree:
    "Votre session a expiré ou n’est plus valide. Reconnectez-vous avec votre e-mail et mot de passe.",
};

type Props = { searchParams: Promise<{ next?: string; error?: string; deleted?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { next, error, deleted } = await searchParams;
  const nextUrl = next && next.startsWith("/") ? next : "/dashboard";
  const supabaseReachable = await isSupabaseAuthReachable();
  const bannerError =
    error && typeof error === "string" && LOGIN_ERROR_MESSAGES[error] ? LOGIN_ERROR_MESSAGES[error] : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className={uiLinkSubtle}>
            ← Accueil
          </Link>
          <h1 className={`mt-4 ${uiPageTitle}`}>Connexion</h1>
        </div>
        {deleted === "1" ? (
          <p className={uiInfoBanner}>
            <span className="font-semibold text-stone-800">Compte supprimé.</span> Vos données ont été effacées. Vous
            pouvez créer un nouveau compte si besoin.
          </p>
        ) : null}
        {!supabaseReachable ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <span className="font-semibold">Service d&apos;authentification inaccessible.</span> Le projet Supabase
            configuré ne répond pas. Mettez à jour les variables{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dans{" "}
            <code className="text-xs">.env.local</code> (et sur Vercel en production), puis redémarrez le serveur.
          </p>
        ) : null}
        <div className={uiAuthCard}>
          <LoginForm nextUrl={nextUrl} bannerError={bannerError} />
        </div>
        <p className={`text-center ${uiLead}`}>
          Pas encore de compte ?{" "}
          <Link href="/signup" className={uiTextLink}>
            S&apos;inscrire
          </Link>
        </p>
        <p className="text-center text-sm text-stone-500">
          <Link href="/" className="font-semibold text-orange-600 hover:text-orange-700">
            Découvrir les restaurants →
          </Link>
        </p>
      </div>
    </div>
  );
}
