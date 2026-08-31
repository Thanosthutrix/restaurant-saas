import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { uiAuthCard, uiLead, uiLinkSubtle, uiPageTitle } from "@/components/ui/premium";

type Props = { searchParams: Promise<{ from?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user) redirect(await resolvePostLoginPath());

  const sp = await searchParams;
  const fromConsumer = sp.from === "consumer";
  const returnToLogin = fromConsumer ? "/compte/connexion" : "/login";
  const returnLabel = fromConsumer ? "Retour à la connexion consommateur" : "Retour à la connexion";

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className={uiLinkSubtle}>
            ← Accueil
          </Link>
          <h1 className={`mt-4 ${uiPageTitle}`}>Mot de passe oublié</h1>
          <p className={`mt-2 ${uiLead}`}>
            Saisissez l’e-mail de votre compte : nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </p>
        </div>
        <div className={uiAuthCard}>
          <ForgotPasswordForm returnToLogin={returnToLogin} returnLabel={returnLabel} />
        </div>
      </div>
    </div>
  );
}
