"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function NewProspectForm() {
  const router = useRouter();
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("outbound");
  const [notes, setNotes] = useState("");
  const [trialDays, setTrialDays] = useState(14);
  const [sendInviteEmail, setSendInviteEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactEmail.trim()) {
      setError("Email requis.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName,
          contactEmail,
          restaurantName,
          phone,
          source,
          notes,
          trialDays,
          sendInvite: true,
          sendInviteEmail,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de la création.");

      router.push(`/admin/prospects/${data.prospectId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 [color-scheme:light] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/25";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nom du contact</label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Jean Dupont"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
            placeholder="jean@restaurant.fr"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Restaurant prévu</label>
          <input
            type="text"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            placeholder="Le Bistrot"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Téléphone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="06 12 34 56 78"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
            <option value="outbound">Démarchage</option>
            <option value="inbound">Entrant</option>
            <option value="referral">Referral</option>
            <option value="event">Événement</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Essai auto (jours)</label>
          <div className="flex gap-2">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setTrialDays(d)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  trialDays === d
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-gray-200 text-gray-600 hover:border-amber-300"
                }`}
              >
                {d}j
              </button>
            ))}
            <input
              type="number"
              min={0}
              max={90}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 [color-scheme:light]"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes internes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Contexte, prochaine action, démo…"
          className={`${inputClass} resize-none`}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={sendInviteEmail}
          onChange={(e) => setSendInviteEmail(e.target.checked)}
          className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
        />
        Envoyer l&apos;email d&apos;invitation au prospect
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-3 font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
      >
        {loading && <Loader2 size={15} className="animate-spin" />}
        {loading ? "Création…" : "Créer le prospect et générer l'invitation"}
      </button>
    </form>
  );
}
