"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthClientError } from "@/lib/supabase/authErrors";
import { uiBtnPrimaryBlock, uiError, uiFormLabel, uiInputBlock } from "@/components/ui/premium";

type Props = {
  nextUrl: string;
};

export function MfaVerifyForm({ nextUrl }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
    if (listErr) {
      setLoading(false);
      setError(formatAuthClientError(listErr.message));
      return;
    }

    const factor = factors.totp.find((f) => f.status === "verified");
    if (!factor) {
      setLoading(false);
      setError("Aucune application d'authentification configurée.");
      return;
    }

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });
    if (challengeErr || !challenge) {
      setLoading(false);
      setError(formatAuthClientError(challengeErr?.message ?? "Impossible de lancer la vérification."));
      return;
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: code.trim(),
    });

    setLoading(false);
    if (verifyErr) {
      setError(formatAuthClientError(verifyErr.message));
      return;
    }

    window.location.assign(`/api/auth/post-login?next=${encodeURIComponent(nextUrl)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <p className={uiError}>{error}</p> : null}
      <div>
        <label htmlFor="mfa-code" className={uiFormLabel}>
          Code à 6 chiffres
        </label>
        <input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          className={`${uiInputBlock} text-center text-lg tracking-[0.3em]`}
          placeholder="000000"
        />
        <p className="mt-1.5 text-xs text-stone-500">Ouvrez votre application d&apos;authentification (Google Authenticator, Authy…).</p>
      </div>
      <button type="submit" disabled={loading || code.length < 6} className={uiBtnPrimaryBlock}>
        {loading ? "Vérification…" : "Valider"}
      </button>
    </form>
  );
}
