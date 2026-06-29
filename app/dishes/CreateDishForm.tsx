"use client";

import { useState, useEffect } from "react";
import { ChefHat, Plus, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { createDishAction } from "./actions";
import { uiBtnPrimary, uiInput, uiLabel } from "@/components/ui/premium";

type Props = { initialName?: string; returnTo?: string };

export function CreateDishForm({ initialName = "", returnTo = "" }: Props) {
  const [name, setName] = useState(initialName);
  const [productionMode, setProductionMode] = useState<"prepared" | "resale">("prepared");

  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  return (
    <form
      action={createDishAction}
      className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex flex-col items-center gap-2 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
          <UtensilsCrossed className="h-5 w-5 text-copper-800" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Nouveau plat</h3>
          <p className="text-xs text-stone-500">Ajoutez un plat à votre carte.</p>
        </div>
      </div>

      <input type="hidden" name="productionMode" value={productionMode} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <div className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-center">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={uiLabel}>Nom du plat</span>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Pizza Reine"
            className={`${uiInput} h-11 w-full`}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className={uiLabel}>Mode</span>
          <div className="flex h-11 items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
            <button
              type="button"
              aria-pressed={productionMode === "prepared"}
              onClick={() => setProductionMode("prepared")}
              className={`flex h-full items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${
                productionMode === "prepared"
                  ? "bg-white text-copper-800 shadow-sm ring-1 ring-stone-200"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <ChefHat className="h-4 w-4" aria-hidden />
              Préparé
            </button>
            <button
              type="button"
              aria-pressed={productionMode === "resale"}
              onClick={() => setProductionMode("resale")}
              className={`flex h-full items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${
                productionMode === "resale"
                  ? "bg-white text-emerald-700 shadow-sm ring-1 ring-stone-200"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              Revente
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={!name.trim()}
          className={`${uiBtnPrimary} inline-flex h-11 items-center justify-center gap-1.5`}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Créer
        </button>
      </div>
    </form>
  );
}
