"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { uiBtnPrimaryBlock, uiError, uiFormLabel, uiInputBlock, uiTextLink } from "@/components/ui/premium";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`;

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm leading-relaxed text-slate-700">
          Si un compte existe pour cette adresse, vous recevrez un e-mail avec un lien pour choisir un nouveau mot de
          passe. Pensez à vérifier les courriers indésirables.
        </p>
        <Link href="/login" className={uiTextLink}>
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className={uiError}>{error}</p>}
      <div>
        <label htmlFor="email" className={uiFormLabel}>
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={uiInputBlock}
        />
      </div>
      <button type="submit" disabled={loading} className={uiBtnPrimaryBlock}>
        {loading ? "Envoi…" : "Envoyer le lien"}
      </button>
      <p className="text-center text-sm">
        <Link href="/login" className={uiTextLink}>
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
