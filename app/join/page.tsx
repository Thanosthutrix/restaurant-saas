import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getStaffInviteByToken } from "@/lib/staff/inviteDb";
import { JoinInviteClient } from "./JoinInviteClient";
import { uiAuthCard, uiLead, uiLinkSubtle, uiPageTitle } from "@/components/ui/premium";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function JoinPage({ searchParams }: Props) {
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" ? raw.trim() : "";
  const user = await getCurrentUser();

  const invite = token ? await getStaffInviteByToken(token) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className={uiLinkSubtle}>
            ← Accueil
          </Link>
          <h1 className={`mt-4 ${uiPageTitle}`}>Invitation</h1>
        </div>
        <div className={uiAuthCard}>
          <JoinInviteClient token={token} invite={invite} isLoggedIn={Boolean(user)} />
        </div>
        <p className={`text-center ${uiLead}`}>
          <Link href="/login" className="text-sky-700 underline-offset-2 hover:underline">
            Connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
