"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  requestId: string;
  defaultDays?: number;
};

export function AdminTrialRequestActions({ requestId, defaultDays = 14 }: Props) {
  const [days, setDays] = useState(defaultDays);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleAction(action: "approve" | "reject") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch("/api/admin/trial-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action,
          trialDays: days,
          adminNotes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur.");
      setDone(action === "approve" ? "Essai approuvé — e-mail envoyé au demandeur." : "Demande refusée.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
      setLoading(null);
    }
  }

  if (done) {
    return <p className="text-sm text-green-700">{done}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Durée (jours)</label>
          <input
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900"
          />
        </div>
        <button
          type="button"
          disabled={loading != null}
          onClick={() => handleAction("approve")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {loading === "approve" && <Loader2 className="h-4 w-4 animate-spin" />}
          Approuver
        </button>
        <button
          type="button"
          disabled={loading != null}
          onClick={() => handleAction("reject")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading === "reject" && <Loader2 className="h-4 w-4 animate-spin" />}
          Refuser
        </button>
      </div>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note interne (optionnel)"
        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
