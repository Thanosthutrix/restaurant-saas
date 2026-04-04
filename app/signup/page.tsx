import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignupForm } from "./SignupForm";
import { uiAuthCard, uiLead, uiPageTitle, uiTextLink, uiLinkSubtle } from "@/components/ui/premium";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className={uiLinkSubtle}>
            ← Accueil
          </Link>
          <h1 className={`mt-4 ${uiPageTitle}`}>Créer un compte</h1>
        </div>
        <div className={uiAuthCard}>
          <SignupForm />
        </div>
        <p className={`text-center ${uiLead}`}>
          Déjà un compte ?{" "}
          <Link href="/login" className={uiTextLink}>
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
