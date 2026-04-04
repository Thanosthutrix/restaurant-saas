import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { UpdatePasswordForm } from "./UpdatePasswordForm";
import { uiAuthCard, uiLead, uiLinkSubtle, uiPageTitle } from "@/components/ui/premium";

export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?error=session_requise");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className={uiLinkSubtle}>
            ← Accueil
          </Link>
          <h1 className={`mt-4 ${uiPageTitle}`}>Nouveau mot de passe</h1>
          <p className={`mt-2 ${uiLead}`}>Choisissez un mot de passe sécurisé pour votre compte ({user.email}).</p>
        </div>
        <div className={uiAuthCard}>
          <UpdatePasswordForm />
        </div>
      </div>
    </div>
  );
}
