"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type RestaurantOption = {
  id: string;
  name: string;
  ownerEmail: string | null;
  hasActiveTrial: boolean;
};

export function NewTrialForm({ restaurants }: { restaurants: RestaurantOption[] }) {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState("");
  const [days, setDays] = useState(14);
  const [source, setSource] = useState("demo_by_medhi");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = restaurants.find((r) => r.id === restaurantId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId) {
      setError("Sélectionne un restaurant.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, days, source, notes }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur lors de la création.");
      }

      router.push(`/admin/restaurants/${restaurantId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Sélection restaurant */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Restaurant <span className="text-red-500">*</span>
        </label>
        <select
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent
                     bg-white text-gray-800"
          required
        >
          <option value="">— Choisir un restaurant —</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.ownerEmail ? ` (${r.ownerEmail})` : ""}
              {r.hasActiveTrial ? " ⚠ essai actif" : ""}
            </option>
          ))}
        </select>
        {selected?.hasActiveTrial && (
          <p className="text-xs text-amber-600 mt-1">
            Ce restaurant a déjà un essai actif — un nouvel essai sera ajouté à son historique.
          </p>
        )}
      </div>

      {/* Durée */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Durée (jours)
        </label>
        <div className="flex gap-2">
          {[7, 14, 30, 60].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                days === d
                  ? "bg-amber-500 text-white border-amber-500"
                  : "border-gray-200 text-gray-600 hover:border-amber-300"
              }`}
            >
              {d}j
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Source */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Source</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-gray-800"
        >
          <option value="demo_by_medhi">Démarché par Medhi</option>
          <option value="referral">Referral</option>
          <option value="organic">Organique</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Notes internes <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Contexte, conditions, rappels…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !restaurantId}
        className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50
                   text-white font-medium rounded-lg transition-colors flex items-center
                   justify-center gap-2"
      >
        {loading && <Loader2 size={15} className="animate-spin" />}
        {loading ? "Création…" : `Accorder ${days} jours d'essai`}
      </button>
    </form>
  );
}
