"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthClientError } from "@/lib/supabase/authErrors";
import { uiBtnPrimaryBlock, uiError, uiFormLabel, uiInputBlock } from "@/components/ui/premium";

type Props = {
  nextUrl: string;
  required?: boolean;
};

type EnrollState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | {
      phase: "ready";
      factorId: string;
      qrCode: string;
      secret: string;
    };

export function MfaEnrollForm({ nextUrl, required = false }: Props) {
  const [state, setState] = useState<EnrollState>({ phase: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startEnroll() {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const pending = factors?.all?.find((f) => f.factor_type === "totp" && f.status === "unverified");
      if (pending) {
        await supabase.auth.mfa.unenroll({ factorId: pending.id });
      }

      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Application d'authentification",
      });

      if (cancelled) return;

      if (enrollErr || !data?.totp) {
        setState({
          phase: "error",
          message: formatAuthClientError(enrollErr?.message ?? "Impossible d'activer la double authentification."),
        });
        return;
      }

      setState({
        phase: "ready",
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    }

    void startEnroll();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (state.phase !== "ready") return;

    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
      factorId: state.factorId,
    });
    if (challengeErr || !challenge) {
      setLoading(false);
      setError(formatAuthClientError(challengeErr?.message ?? "Impossible de lancer la vérification."));
      return;
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: state.factorId,
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

  if (state.phase === "loading") {
    return <p className="text-sm text-stone-600">Préparation du QR code…</p>;
  }

  if (state.phase === "error") {
    return <p className={uiError}>{state.message}</p>;
  }

  return (
    <div className="space-y-6">
      {required ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          La double authentification est obligatoire pour les comptes administrateur Ubion.
        </p>
      ) : (
        <p className="text-sm text-stone-600">
          Scannez le QR code avec Google Authenticator, Authy ou une application compatible TOTP.
        </p>
      )}

      <div
        className="mx-auto flex max-w-[220px] justify-center rounded-xl border border-stone-200 bg-white p-3"
        dangerouslySetInnerHTML={{ __html: state.qrCode }}
      />

      <div className="rounded-lg bg-stone-50 px-3 py-2 text-center">
        <p className="text-xs text-stone-500">Clé secrète (saisie manuelle)</p>
        <p className="mt-1 break-all font-mono text-sm text-stone-800">{state.secret}</p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        {error ? <p className={uiError}>{error}</p> : null}
        <div>
          <label htmlFor="enroll-code" className={uiFormLabel}>
            Code de vérification
          </label>
          <input
            id="enroll-code"
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
        </div>
        <button type="submit" disabled={loading || code.length < 6} className={uiBtnPrimaryBlock}>
          {loading ? "Activation…" : "Activer la double authentification"}
        </button>
      </form>
    </div>
  );
}
