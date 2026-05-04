"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  applyBenchmarkTariffByProductIdAction,
  applyBenchmarkTariffToInventoryItemAction,
  loadBenchmarkTariffSuggestionsAction,
  type BenchmarkTariffChoice,
} from "../actions";
import {
  uiBtnOutlineSm,
  uiBtnSecondary,
  uiCard,
  uiError,
  uiMuted,
  uiSuccess,
} from "@/components/ui/premium";

function formatEur(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatEurRefUnit(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export function ApplyBenchmarkTariffButton({
  restaurantId,
  itemId,
  itemType,
  referencePurchaseUnitCostHt,
  referencePurchaseIsBenchmark,
}: {
  restaurantId: string;
  itemId: string;
  itemType: string;
  referencePurchaseUnitCostHt?: number | null;
  referencePurchaseIsBenchmark?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [suggestions, setSuggestions] = useState<BenchmarkTariffChoice[] | null>(null);

  if (itemType === "prep") return null;

  const hasRealRefPrice =
    referencePurchaseUnitCostHt != null &&
    Number(referencePurchaseUnitCostHt) > 0 &&
    !referencePurchaseIsBenchmark;

  function confirmOverwrite(): boolean {
    if (!hasRealRefPrice) return true;
    return window.confirm(
      "Un prix d’achat de référence (hors base indicative) est déjà renseigné. Le remplacer par le tarif théorique France ?"
    );
  }

  function runApply() {
    if (!confirmOverwrite()) return;
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const res = await applyBenchmarkTariffToInventoryItemAction({
          itemId,
          restaurantId,
        });
        if (res.ok) {
          setSuggestions(null);
          setMessage({
            kind: "ok",
            text: `Tarif associé : « ${res.data.produitLabel} » — ${formatEur(res.data.price)} HT / unité de stock (indicatif).`,
          });
          router.refresh();
        } else {
          setMessage({ kind: "err", text: res.error });
          if ("suggestions" in res && Array.isArray(res.suggestions) && res.suggestions.length > 0) {
            setSuggestions(res.suggestions);
          } else {
            setSuggestions(null);
          }
        }
      })();
    });
  }

  function runLoadSuggestions() {
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const res = await loadBenchmarkTariffSuggestionsAction({ itemId, restaurantId });
        if (res.ok) {
          setSuggestions(res.data);
          if (res.data.length === 0) {
            setMessage({
              kind: "info",
              text: "Aucune proposition assez proche pour ce nom avec votre unité. Essayez g, kg, ml ou L, ou rapprochez le libellé du catalogue (ex. « ail » → « Ail »).",
            });
          }
        } else {
          setSuggestions(null);
          setMessage({ kind: "err", text: res.error });
        }
      })();
    });
  }

  function runApplyProduct(benchmarkProductId: string) {
    if (!confirmOverwrite()) return;
    setMessage(null);
    setPickingId(benchmarkProductId);
    startTransition(() => {
      void (async () => {
        const res = await applyBenchmarkTariffByProductIdAction({
          itemId,
          restaurantId,
          benchmarkProductId,
        });
        setPickingId(null);
        if (res.ok) {
          setSuggestions(null);
          setMessage({
            kind: "ok",
            text: `Tarif associé : « ${res.data.produitLabel} » — ${formatEur(res.data.price)} HT / unité de stock (indicatif).`,
          });
          router.refresh();
        } else {
          setMessage({ kind: "err", text: res.error });
        }
      })();
    });
  }

  return (
    <div className={uiCard}>
      <h2 className="text-sm font-semibold text-slate-900">Tarif théorique (base France)</h2>
      <p className={`mt-1 ${uiMuted}`}>
        Associe le <strong className="font-medium text-slate-700">prix moyen</strong> du fichier (base indicative, ≈500
        produits), converti en € / <strong className="font-medium text-slate-700">votre unité de stock</strong> (g, kg, ml
        ou L). Les montants « par gramme » ou « par ml » sont volontairement petits : la colonne moyenne affiche le prix
        catalogue (ex. €/kg) attendu.
      </p>
      {message?.kind === "ok" ? <p className={`mt-3 ${uiSuccess}`}>{message.text}</p> : null}
      {message?.kind === "err" ? <p className={`mt-3 ${uiError}`}>{message.text}</p> : null}
      {message?.kind === "info" ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {message.text}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={runApply} disabled={pending} className={uiBtnSecondary}>
          {pending && !pickingId ? "Recherche…" : "Associer le tarif indicatif (auto)"}
        </button>
        <button
          type="button"
          onClick={runLoadSuggestions}
          disabled={pending}
          className={uiBtnOutlineSm}
        >
          Voir les propositions proches
        </button>
      </div>

      {suggestions != null && suggestions.length > 0 ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Propositions proches (cliquez pour associer)
          </p>
          <ul className="mt-2 space-y-2">
            {suggestions.map((s) => (
              <li key={s.benchmarkProductId}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => runApplyProduct(s.benchmarkProductId)}
                  className={`flex w-full flex-col items-start gap-1 rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2 text-left text-sm transition hover:border-violet-200 hover:bg-violet-50 disabled:opacity-50`}
                >
                  <div className="flex w-full flex-wrap items-baseline justify-between gap-2">
                    <span>
                      <span className="font-medium text-slate-900">{s.produitLabel}</span>
                      <span className={`ml-2 ${uiMuted}`}>({s.famille})</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums text-violet-900">
                        {pending && pickingId === s.benchmarkProductId ? "…" : formatEur(s.catalogMeanEuroHt)}{" "}
                        <span className="font-normal text-violet-800">/ {s.catalogNormalizedUnit}</span>
                      </span>
                      <span className={`block text-[11px] font-normal tabular-nums text-violet-800/95`}>
                        stock : {formatEurRefUnit(s.price)} / u.
                      </span>
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
