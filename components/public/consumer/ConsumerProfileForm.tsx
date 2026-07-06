"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConsumerProfile } from "@/lib/public/consumer/types";
import { saveConsumerProfileAction } from "@/app/compte/actions";

type Props = {
  profile: ConsumerProfile;
};

export function ConsumerProfileForm({ profile }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [marketingOptIn, setMarketingOptIn] = useState(profile.marketing_opt_in);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const result = await saveConsumerProfileAction({
      firstName,
      lastName,
      phone,
      marketingOptIn,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Profil enregistré.
        </p>
      ) : null}

      {profile.email ? (
        <p className="text-sm text-slate-600">
          E-mail : <span className="font-medium text-slate-900">{profile.email}</span>
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

      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          className="mt-1 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
        />
        <span>Recevoir des offres et actualités de mes restaurants favoris.</span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
