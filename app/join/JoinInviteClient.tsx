"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { StaffInviteWithContext } from "@/lib/staff/inviteDb";
import { acceptStaffInviteAction } from "@/app/equipe/actions";
import { signOutAndRedirect } from "@/app/login/actions";
import { uiBtnPrimaryBlock, uiBtnSecondary, uiError, uiLead, uiPageTitle, uiTextLink } from "@/components/ui/premium";

type Props = {
  token: string;
  invite: StaffInviteWithContext | null;
  isLoggedIn: boolean;
  /** E-mail du compte actuellement connecté. */
  userEmail?: string | null;
  /** Nom de la fiche déjà liée à ce compte dans le même restaurant, le cas échéant. */
  alreadyLinkedName?: string | null;
};

export function JoinInviteClient({ token, invite, isLoggedIn, userEmail, alreadyLinkedName }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nextJoin = token ? `/join?token=${encodeURIComponent(token)}` : "/join";
  const signupWithToken = token ? `/signup?next=${encodeURIComponent(nextJoin)}` : "/signup";

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
      ) : alreadyLinkedName ? (
        /* Compte déjà lié à une AUTRE fiche dans ce restaurant */
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-amber-900">Ce compte est déjà utilisé par une autre fiche</p>
            {userEmail && (
              <p className="text-xs text-amber-700">
                Compte connecté : <span className="font-semibold">{userEmail}</span>
              </p>
            )}
            <p className="text-sm text-amber-800">
              Ce compte est déjà lié à la fiche{" "}
              <span className="font-semibold">« {alreadyLinkedName} »</span>.
              Chaque collaborateur doit avoir son propre compte.
            </p>
          </div>
          <p className="text-sm text-slate-600 text-center">
            Cette invitation est destinée à un autre collaborateur.
          </p>
          <button
            type="button"
            disabled={pending}
            className={uiBtnPrimaryBlock}
            onClick={() => start(() => signOutAndRedirect(signupWithToken))}
          >
            {pending ? "Déconnexion…" : "Se déconnecter et créer le bon compte"}
          </button>
        </div>
      ) : (
        /* Compte connecté, pas de conflit */
        <div className="space-y-3">
          {userEmail && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">Connecté en tant que</span>
              <span className="text-xs font-semibold text-slate-700 truncate">{userEmail}</span>
            </div>
          )}
          <button type="button" disabled={pending} className={uiBtnPrimaryBlock} onClick={accept}>
            {pending ? "Liaison…" : "Accepter et lier mon compte"}
          </button>
          <p className="text-center text-sm text-slate-500">
            Ce n'est pas vous ?{" "}
            <button
              type="button"
              disabled={pending}
              className={uiTextLink}
              onClick={() => start(() => signOutAndRedirect(signupWithToken))}
            >
              Se déconnecter et créer un autre compte
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
