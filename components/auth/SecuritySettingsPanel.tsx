"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatAuthClientError } from "@/lib/supabase/authErrors";
import type { VerifiedTotpFactor } from "@/lib/auth/mfaGate";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiCard, uiError } from "@/components/ui/premium";
import { MfaEnrollForm } from "./MfaEnrollForm";

type Props = {
  hasVerifiedTotp: boolean;
  verifiedFactors: VerifiedTotpFactor[];
  isAdmin: boolean;
  settingsBackHref: string;
  enrollNextUrl: string;
};

export function SecuritySettingsPanel({
  hasVerifiedTotp,
  verifiedFactors,
  isAdmin,
  settingsBackHref,
  enrollNextUrl,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEnroll, setShowEnroll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function disableMfa(factorId: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollErr) {
        setError(formatAuthClientError(unenrollErr.message));
        return;
      }
      setMessage("Double authentification désactivée.");
      setShowEnroll(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className={`${uiCard} space-y-4`}>
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Mot de passe</h2>
          <p className="mt-1 text-sm text-stone-600">
            Recevez un lien par e-mail pour choisir un nouveau mot de passe.
          </p>
          <Link href="/forgot-password" className="mt-3 inline-flex text-sm font-medium text-orange-700 hover:text-orange-800">
            Réinitialiser mon mot de passe →
          </Link>
        </div>
      </section>

      <section className={`${uiCard} space-y-4`}>
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Double authentification (2FA)</h2>
          <p className="mt-1 text-sm text-stone-600">
            Protégez votre compte avec un code généré par une application d&apos;authentification.
            {isAdmin ? " Obligatoire pour les administrateurs Ubion." : " Recommandé pour les propriétaires."}
          </p>
        </div>

        {error ? <p className={uiError}>{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        {hasVerifiedTotp ? (
          <div className="space-y-3">
            <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              2FA activée
            </p>
            <ul className="space-y-2">
              {verifiedFactors.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 bg-stone-50/80 px-3 py-2 text-sm"
                >
                  <span className="text-stone-800">{f.friendlyName ?? "Application d'authentification"}</span>
                  {!isAdmin ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => disableMfa(f.id)}
                      className={uiBtnOutlineSm}
                    >
                      Désactiver
                    </button>
                  ) : (
                    <span className="text-xs text-stone-500">Obligatoire pour admin</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : showEnroll ? (
          <MfaEnrollForm nextUrl={enrollNextUrl} required={isAdmin} />
        ) : (
          <button type="button" onClick={() => setShowEnroll(true)} className={uiBtnPrimarySm}>
            Activer la double authentification
          </button>
        )}
      </section>

      <p className="text-center text-sm">
        <Link href={settingsBackHref} className="font-medium text-stone-600 hover:text-stone-900">
          ← Retour
        </Link>
      </p>
    </div>
  );
}
