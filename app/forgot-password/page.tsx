import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { uiAuthCard, uiLead, uiLinkSubtle, uiPageTitle } from "@/components/ui/premium";

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
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
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
