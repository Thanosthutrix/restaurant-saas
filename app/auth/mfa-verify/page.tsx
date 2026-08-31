import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMfaStatus } from "@/lib/auth/mfaGate";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { MfaVerifyForm } from "@/components/auth/MfaVerifyForm";
import { uiAuthCard, uiLead, uiLinkSubtle, uiPageTitle } from "@/components/ui/premium";

type Props = { searchParams: Promise<{ next?: string; required?: string }> };

function safeNext(raw: string | undefined, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export default async function MfaVerifyPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const fallback = await resolvePostLoginPath();
  const nextUrl = safeNext(sp.next, fallback);
  const status = await getMfaStatus();

  if (!status?.needsVerify) {
    redirect(await resolvePostLoginPath(nextUrl));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className={uiLinkSubtle}>
            ← Accueil
          </Link>
          <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Shield size={22} aria-hidden />
          </div>
          <h1 className={`mt-4 ${uiPageTitle}`}>Vérification en deux étapes</h1>
          <p className={`mt-2 ${uiLead}`}>Saisissez le code de votre application d&apos;authentification pour continuer.</p>
        </div>
        <div className={uiAuthCard}>
          <MfaVerifyForm nextUrl={nextUrl} />
        </div>
      </div>
    </div>
  );
}
