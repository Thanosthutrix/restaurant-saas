"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addServiceLine } from "./actions";

export function ServiceAddLineForm({
  serviceId,
  restaurantId,
}: {
  serviceId: string;
  restaurantId: string;
}) {
  const router = useRouter();
  const [rawLabel, setRawLabel] = useState("");
  const [qty, setQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(qty.replace(",", "."));
    if (!rawLabel.trim()) {
      setError("Libellé requis.");
      return;
    }
    if (!Number.isFinite(num) || num <= 0) {
      setError("Quantité invalide.");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await addServiceLine(serviceId, restaurantId, { raw_label: rawLabel.trim(), qty: num });
    setLoading(false);
    if (result.ok) {
      setRawLabel("");
      setQty("");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
      <input
        type="text"
        value={rawLabel}
        onChange={(e) => setRawLabel(e.target.value)}
        placeholder="Libellé de la ligne"
        className="min-w-[180px] rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <input
        type="text"
        inputMode="decimal"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="Qté"
        className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "…" : "Ajouter la ligne"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
