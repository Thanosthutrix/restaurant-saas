"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uiBtnPrimaryBlock, uiError, uiFormLabel, uiInputBlock } from "@/components/ui/premium";

const MIN_LEN = 8;

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LEN) {
      setError(`Le mot de passe doit contenir au moins ${MIN_LEN} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className={uiError}>{error}</p>}
      <div>
        <label htmlFor="password" className={uiFormLabel}>
          Nouveau mot de passe
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={MIN_LEN}
          autoComplete="new-password"
          className={uiInputBlock}
        />
      </div>
      <div>
        <label htmlFor="confirm" className={uiFormLabel}>
          Confirmer le mot de passe
        </label>
        <input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={MIN_LEN}
          autoComplete="new-password"
          className={uiInputBlock}
        />
      </div>
      <button type="submit" disabled={loading} className={uiBtnPrimaryBlock}>
        {loading ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>
    </form>
  );
}
