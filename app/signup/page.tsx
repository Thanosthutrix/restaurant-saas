import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { getProspectInvitePublic } from "@/lib/admin/prospectInviteDb";
import { SignupForm } from "./SignupForm";
import { uiAuthCard, uiLead, uiPageTitle, uiTextLink, uiLinkSubtle } from "@/components/ui/premium";

type Props = { searchParams: Promise<{ next?: string; invite?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  const { next, invite } = await searchParams;
  const user = await getCurrentUser();

  const inviteToken = typeof invite === "string" && invite.length > 10 ? invite : undefined;
  const inviteInfo = inviteToken ? await getProspectInvitePublic(inviteToken) : null;

  if (user) {
    redirect(await resolvePostLoginPath(inviteToken ? `/onboarding?invite=${inviteToken}` : undefined));
  }

  const nextUrl =
    typeof next === "string" && next.startsWith("/") && !next.includes("//")
      ? next
      : inviteToken
        ? `/onboarding?invite=${inviteToken}`
        : "/onboarding/start";

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className={uiLinkSubtle}>
            ← Accueil
          </Link>
          <h1 className={`mt-4 ${uiPageTitle}`}>
            {inviteInfo ? "Rejoindre Ubion Pro" : "Créer un compte"}
          </h1>
          {inviteInfo && (
            <p className={`mt-2 ${uiLead}`}>
              Invitation pour{" "}
              {inviteInfo.restaurant_name ? (
                <strong>{inviteInfo.restaurant_name}</strong>
              ) : (
                "votre établissement"
              )}
            </p>
          )}
        </div>
        <div className={uiAuthCard}>
          <SignupForm
            nextUrl={nextUrl}
            defaultEmail={inviteInfo?.contact_email}
          />
        </div>
        <p className={`text-center ${uiLead}`}>
          Déjà un compte ?{" "}
          <Link
            href={inviteToken ? `/login?next=/onboarding?invite=${inviteToken}` : "/login"}
            className={uiTextLink}
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
