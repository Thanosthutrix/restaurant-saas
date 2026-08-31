import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMfaStatus } from "@/lib/auth/mfaGate";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { MfaEnrollForm } from "@/components/auth/MfaEnrollForm";
import { uiAuthCard, uiLead, uiLinkSubtle, uiPageTitle } from "@/components/ui/premium";

type Props = { searchParams: Promise<{ next?: string; required?: string }> };

function safeNext(raw: string | undefined, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export default async function MfaEnrollPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const fallback = await resolvePostLoginPath();
  const nextUrl = safeNext(sp.next, fallback);
  const required = sp.required === "1";
  const status = await getMfaStatus();

  if (status?.hasVerifiedTotp && !status.needsVerify) {
    redirect(await resolvePostLoginPath(nextUrl));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className={uiLinkSubtle}>
            ← Accueil
          </Link>
          <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <ShieldCheck size={22} aria-hidden />
          </div>
          <h1 className={`mt-4 ${uiPageTitle}`}>Activer la double authentification</h1>
          <p className={`mt-2 ${uiLead}`}>
            {required
              ? "Configuration obligatoire pour accéder à l'espace admin."
              : "Renforcez la sécurité de votre compte en quelques minutes."}
          </p>
        </div>
        <div className={uiAuthCard}>
          <MfaEnrollForm nextUrl={nextUrl} required={required} />
        </div>
      </div>
    </div>
  );
}
