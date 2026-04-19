"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uiBtnPrimaryBlock, uiError, uiFormLabel, uiInputBlock } from "@/components/ui/premium";

export function SignupForm({ nextUrl }: { nextUrl?: string }) {
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
    const { error: err } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(nextUrl ?? "/onboarding");
    router.refresh();
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
          minLength={6}
          autoComplete="new-password"
          className={uiInputBlock}
        />
      </div>
      <button type="submit" disabled={loading} className={uiBtnPrimaryBlock}>
        {loading ? "Création…" : "Créer mon compte"}
      </button>
    </form>
  );
}
