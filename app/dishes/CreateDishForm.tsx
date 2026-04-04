"use client";

import { useState, useEffect } from "react";
import { createDishAction } from "./actions";
import { uiBtnPrimarySm, uiCard, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

type Props = { initialName?: string; returnTo?: string };

export function CreateDishForm({ initialName = "", returnTo = "" }: Props) {
  const [name, setName] = useState(initialName);
  const [productionMode, setProductionMode] = useState<"prepared" | "resale">("prepared");

  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  return (
    <form action={createDishAction} className={`${uiCard} mb-0`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Nouveau plat</h3>
      <div className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="productionMode" value={productionMode} />
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>Nom</span>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Pizza Reine"
            className={uiInput}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>Mode</span>
          <select
            value={productionMode}
            onChange={(e) => setProductionMode(e.target.value as "prepared" | "resale")}
            className={uiSelect}
          >
            <option value="prepared">Préparé</option>
            <option value="resale">Revente</option>
          </select>
        </label>
        <button type="submit" disabled={!name.trim()} className={uiBtnPrimarySm}>
          Créer
        </button>
      </div>
    </form>
  );
}
