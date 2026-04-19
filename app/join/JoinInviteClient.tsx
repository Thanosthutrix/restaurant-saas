"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { StaffInviteWithContext } from "@/lib/staff/inviteDb";
import { acceptStaffInviteAction } from "@/app/equipe/actions";
import { uiBtnPrimaryBlock, uiBtnSecondary, uiError, uiLead, uiPageTitle, uiTextLink } from "@/components/ui/premium";

type Props = {
  token: string;
  invite: StaffInviteWithContext | null;
  isLoggedIn: boolean;
};

export function JoinInviteClient({ token, invite, isLoggedIn }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nextJoin = token ? `/join?token=${encodeURIComponent(token)}` : "/join";

  function accept() {
    setError(null);
    start(async () => {
      const r = await acceptStaffInviteAction(token);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  if (!token.trim()) {
    return (
      <p className={`${uiLead} text-center text-slate-600`}>
        Ouvrez le lien d’invitation complet (il doit contenir un paramètre <code className="text-sm">token</code>).
      </p>
    );
  }

  if (!invite) {
    return (
      <div className="space-y-3 text-center">
        <p className={uiLead}>
          Cette invitation n’est plus valide (expirée, déjà utilisée ou collaborateur déjà lié).
        </p>
        <p className="text-sm text-slate-500">Demandez un nouveau lien au responsable de l’établissement.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-5 shadow-sm">
        <p className={`${uiPageTitle} text-lg`}>Rejoindre l’équipe</p>
        <p className={`mt-2 ${uiLead}`}>
          <span className="font-semibold text-slate-900">{invite.restaurant_name}</span>
          {" — "}
          fiche « {invite.staff_display_name} »
        </p>
        <p className="mt-3 text-xs text-slate-500">
          En acceptant, votre compte sera lié à cette fiche pour le planning et les droits applicatifs définis par
          l’établissement.
        </p>
      </div>

      {error ? <p className={uiError}>{error}</p> : null}

      {!isLoggedIn ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-slate-600">Connectez-vous ou créez un compte pour finaliser.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={`/login?next=${encodeURIComponent(nextJoin)}`} className={uiBtnPrimaryBlock}>
              Se connecter
            </Link>
            <Link href={`/signup?next=${encodeURIComponent(nextJoin)}`} className={uiBtnSecondary}>
              Créer un compte
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button type="button" disabled={pending} className={uiBtnPrimaryBlock} onClick={accept}>
            {pending ? "Liaison…" : "Accepter et lier mon compte"}
          </button>
          <p className="text-center text-sm text-slate-500">
            Mauvais compte ?{" "}
            <Link href="/account" className={uiTextLink}>
              Paramètres du compte
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
