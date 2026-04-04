import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { uiAuthCard, uiInfoBanner, uiLead, uiPageTitle, uiTextLink, uiLinkSubtle } from "@/components/ui/premium";

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  lien_invalide: "Ce lien n’est plus valide ou est incomplet. Demandez un nouvel e-mail de réinitialisation.",
  session_echec: "La connexion depuis le lien e-mail a échoué. Réessayez ou demandez un nouveau lien.",
  session_requise: "Ouvrez le lien reçu par e-mail, ou connectez-vous si vous avez déjà un mot de passe.",
};

type Props = { searchParams: Promise<{ next?: string; error?: string; deleted?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { next, error, deleted } = await searchParams;
  const nextUrl = next && next.startsWith("/") ? next : "/dashboard";
  const bannerError =
    error && typeof error === "string" && LOGIN_ERROR_MESSAGES[error] ? LOGIN_ERROR_MESSAGES[error] : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className={uiLinkSubtle}>
            ← Accueil
          </Link>
          <h1 className={`mt-4 ${uiPageTitle}`}>Connexion</h1>
        </div>
        {deleted === "1" ? (
          <p className={uiInfoBanner}>
            <span className="font-semibold text-slate-800">Compte supprimé.</span> Vos données ont été effacées. Vous
            pouvez créer un nouveau compte si besoin.
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
      </div>
    </div>
  );
}
