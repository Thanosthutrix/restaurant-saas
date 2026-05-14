import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getStaffInviteByToken } from "@/lib/staff/inviteDb";
import { supabaseServer } from "@/lib/supabaseServer";
import { JoinInviteClient } from "./JoinInviteClient";
import { uiAuthCard, uiLead, uiLinkSubtle, uiPageTitle } from "@/components/ui/premium";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function JoinPage({ searchParams }: Props) {
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" ? raw.trim() : "";
  const user = await getCurrentUser();

  const invite = token ? await getStaffInviteByToken(token) : null;

  // Si l'utilisateur est connecté et que l'invitation est valide, on vérifie s'il est
  // déjà lié à une AUTRE fiche dans ce même restaurant.
  let alreadyLinkedName: string | null = null;
  if (user && invite) {
    const { data: existing } = await supabaseServer
      .from("staff_members")
      .select("id, display_name")
      .eq("restaurant_id", invite.restaurant_id)
      .eq("user_id", user.id)
      .neq("id", invite.staff_member_id)
      .maybeSingle();
    if (existing) {
      alreadyLinkedName = (existing as { display_name: string }).display_name ?? "une autre fiche";
    }
  }

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
          <JoinInviteClient
            token={token}
            invite={invite}
            isLoggedIn={Boolean(user)}
            userEmail={user?.email ?? null}
            alreadyLinkedName={alreadyLinkedName}
          />
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
