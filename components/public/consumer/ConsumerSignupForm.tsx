"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatAuthClientError } from "@/lib/supabase/authErrors";
import { saveConsumerProfileAction } from "@/app/compte/actions";

export function ConsumerSignupForm({ nextUrl }: { nextUrl: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          account_type: "consumer",
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
        },
      },
    });

    if (signUpErr) {
      setLoading(false);
      setError(formatAuthClientError(signUpErr.message));
      return;
    }

    if (!data.session) {
      setLoading(false);
      setError(
        "Compte créé. Vérifiez votre e-mail pour confirmer votre inscription, puis connectez-vous."
      );
      return;
    }

    const saved = await saveConsumerProfileAction({
      firstName,
      lastName,
      phone,
      marketingOptIn,
    });

    setLoading(false);

    if (!saved.ok) {
      setError(saved.error);
      return;
    }

    router.push(nextUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Prénom</span>
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Nom</span>
          <input
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Téléphone</span>
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">E-mail</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Mot de passe</span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
        />
      </label>

      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          className="mt-1 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
        />
        <span>J&apos;accepte de recevoir des offres et actualités de mes restaurants favoris.</span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-sm font-bold text-white shadow-md shadow-orange-500/25 transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-60"
      >
        {loading ? "Création…" : "Créer mon compte"}
      </button>
    </form>
  );
}
