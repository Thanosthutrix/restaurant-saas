"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateDishSellingPrice } from "./actions";
import { FRENCH_SELLING_VAT_PRESETS } from "@/lib/tax/frenchSellingVat";
import {
  uiBtnPrimarySm,
  uiCard,
  uiCardMuted,
  uiMuted,
  uiWarn,
  uiInput,
  uiLabel,
  uiSelect,
} from "@/components/ui/premium";

export function DishSellingPriceBlock({
  dishId,
  restaurantId,
  initialSellingPriceTtc,
  initialVatRatePct,
  initialSellingPriceHt,
  foodCostHt,
  costIsComplete,
  foodCostError,
}: {
  dishId: string;
  restaurantId: string;
  initialSellingPriceTtc: number | null;
  initialVatRatePct: number;
  /** HT déjà en base (affichage cohérent même si TTC vide). */
  initialSellingPriceHt: number | null;
  foodCostHt: number | null;
  costIsComplete: boolean;
  foodCostError: string | null;
}) {
  const router = useRouter();
  const [ttcStr, setTtcStr] = useState(
    initialSellingPriceTtc != null && initialSellingPriceTtc > 0
      ? String(initialSellingPriceTtc)
      : ""
  );
  const [vatPctStr, setVatPctStr] = useState(String(initialVatRatePct));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTtcStr(
      initialSellingPriceTtc != null && initialSellingPriceTtc > 0
        ? String(initialSellingPriceTtc)
        : ""
    );
    setVatPctStr(String(initialVatRatePct));
  }, [initialSellingPriceTtc, initialVatRatePct]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = ttcStr.trim();
    const parsedTtc = trimmed === "" ? null : parseFloat(trimmed.replace(",", "."));
    if (parsedTtc !== null && (!Number.isFinite(parsedTtc) || parsedTtc < 0)) {
      setError("Prix TTC invalide (nombre ≥ 0 ou laissez vide).");
      return;
    }
    const vat = parseFloat(vatPctStr.replace(",", "."));
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      setError("Taux de TVA invalide (entre 0 et 100 %).");
      return;
    }
    setLoading(true);
    const result = await updateDishSellingPrice({
      dishId,
      restaurantId,
      sellingPriceTtc: parsedTtc,
      sellingVatRatePct: vat,
    });
    setLoading(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  function formatEur(n: number) {
    return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  }

  const savedHt =
    initialSellingPriceHt != null && initialSellingPriceHt > 0 ? initialSellingPriceHt : null;
  const marginHt =
    savedHt != null && foodCostHt != null && costIsComplete ? savedHt - foodCostHt : null;
  const marginPct =
    marginHt != null && savedHt != null && savedHt > 0 ? (marginHt / savedHt) * 100 : null;

  return (
    <div className={uiCard}>
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Marge (estimation)</h2>
      <p className={`mb-3 ${uiMuted}`}>
        Prix carte saisi en <strong className="font-medium text-slate-700">TTC</strong> (comme affiché client).
        Le <strong className="font-medium text-slate-700">HT</strong> est calculé selon le taux de TVA choisi ; la
        marge compare ce HT au coût matière HT (recette × achats).
      </p>
      {foodCostError && <p className={`mb-2 ${uiWarn}`}>{foodCostError}</p>}
      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
      <div className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className={uiCardMuted}>
          <div className={uiMuted}>Coût matière HT</div>
          <div className="font-semibold text-slate-900">
            {foodCostHt != null && costIsComplete
              ? formatEur(foodCostHt)
              : costIsComplete
                ? "—"
                : "Incomplet"}
          </div>
          {!costIsComplete && !foodCostError && (
            <div className="mt-1 text-xs font-medium text-amber-800">
              Complétez les prix sur les fiches composants ou via les achats.
            </div>
          )}
        </div>
        <div className={uiCardMuted}>
          <div className={uiMuted}>Marge HT / taux</div>
          <div
            className={`font-semibold ${
              marginHt != null && marginHt > 0 ? "text-emerald-700" : "text-slate-900"
            }`}
          >
            {marginHt != null && marginPct != null
              ? `${formatEur(marginHt)} · ${marginPct.toFixed(1)} %`
              : "—"}
          </div>
        </div>
      </div>
      <div className="mb-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
        <div className={uiMuted}>Prix de vente HT (calculé)</div>
        <div className="font-semibold tabular-nums text-slate-900">
          {savedHt != null ? formatEur(savedHt) : "—"}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>Prix de vente TTC (portion)</span>
          <input
            type="text"
            inputMode="decimal"
            value={ttcStr}
            onChange={(e) => setTtcStr(e.target.value)}
            placeholder="ex. 15,95"
            className={`w-32 ${uiInput}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>TVA</span>
          <select
            value={vatPctStr}
            onChange={(e) => setVatPctStr(e.target.value)}
            className={`min-w-[11rem] ${uiSelect}`}
          >
            {FRENCH_SELLING_VAT_PRESETS.map((p) => (
              <option key={p.ratePct} value={String(p.ratePct)}>
                {p.label} — {p.hint}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading} className={uiBtnPrimarySm}>
          {loading ? "…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
