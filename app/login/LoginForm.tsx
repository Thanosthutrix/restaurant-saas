"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uiBtnPrimaryBlock, uiError, uiFormLabel, uiInputBlock, uiTextLink } from "@/components/ui/premium";

export function LoginForm({ nextUrl, bannerError }: { nextUrl: string; bannerError?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(nextUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {bannerError ? <p className={uiError}>{bannerError}</p> : null}
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
      <div>
        <label htmlFor="password" className={uiFormLabel}>
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={uiInputBlock}
        />
        <p className="mt-1.5 text-right">
          <Link href="/forgot-password" className={`text-sm ${uiTextLink}`}>
            Mot de passe oublié ?
          </Link>
        </p>
      </div>
      <button type="submit" disabled={loading} className={uiBtnPrimaryBlock}>
        {loading ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
