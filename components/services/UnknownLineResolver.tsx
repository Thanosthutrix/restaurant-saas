"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UnknownLine } from "@/lib/db";
import {
  resolveUnknownLineToExistingDish,
  resolveUnknownLineToNewDish,
  ignoreUnknownLine,
} from "@/app/service/[id]/actions";
import { uiBtnOutlineSm, uiInput } from "@/components/ui/premium";

export type UnknownLineResolverProps = {
  serviceId: string;
  restaurantId: string;
  line: UnknownLine;
  onResolved?: () => void;
};

export function UnknownLineResolver({
  serviceId,
  restaurantId,
  line,
  onResolved,
}: UnknownLineResolverProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [showNewDish, setShowNewDish] = useState(false);
  const [newDishName, setNewDishName] = useState(line.rawLabel.replace(/\s*\(\d+\)\s*$/, "").trim() || line.rawLabel);

  const disableAll = loading;

  const afterResolve = () => {
    onResolved?.();
    router.refresh();
  };

  const handleResolveToDish = async (dishId: string) => {
    if (disableAll) return;
    setLoading(true);
    setHidden(true);
    const result = await resolveUnknownLineToExistingDish({
      serviceId,
      restaurantId,
      rawLabel: line.rawLabel,
      qty: line.qty,
      dishId,
    });
    setLoading(false);
    if (result.ok) afterResolve();
    else {
      setHidden(false);
      alert(result.error);
    }
  };

  const handleIgnore = async () => {
    if (disableAll) return;
    setLoading(true);
    setHidden(true);
    const result = await ignoreUnknownLine({
      serviceId,
      rawLabel: line.rawLabel,
      qty: line.qty,
    });
    setLoading(false);
    if (result.ok) afterResolve();
    else {
      setHidden(false);
      alert(result.error);
    }
  };

  const handleNewDishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newDishName.trim();
    if (!name || disableAll) return;
    setLoading(true);
    setHidden(true);
    const result = await resolveUnknownLineToNewDish({
      serviceId,
      restaurantId,
      rawLabel: line.rawLabel,
      qty: line.qty,
      newDishName: name,
    });
    setLoading(false);
    if (result.ok) {
      setShowNewDish(false);
      afterResolve();
    } else {
      setHidden(false);
      alert(result.error);
    }
  };

  if (hidden) return null;

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3 shadow-sm">
      <p className="font-medium text-amber-800">
        {line.rawLabel} <span className="text-amber-600">× {line.qty}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {line.candidates.slice(0, 5).map((c) => (
          <button
            key={c.dishId}
            type="button"
            disabled={disableAll}
            onClick={() => handleResolveToDish(c.dishId)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-indigo-100 hover:bg-slate-50 disabled:opacity-50"
          >
            {c.dishName}
          </button>
        ))}
        {!showNewDish ? (
          <button
            type="button"
            disabled={disableAll}
            onClick={() => setShowNewDish(true)}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50"
          >
            + Nouveau plat
          </button>
        ) : (
          <form onSubmit={handleNewDishSubmit} className="inline-flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newDishName}
              onChange={(e) => setNewDishName(e.target.value)}
              placeholder="Nom du plat"
              className={`min-w-[10rem] ${uiInput}`}
              autoFocus
            />
            <button
              type="submit"
              disabled={disableAll || !newDishName.trim()}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
            >
              Créer
            </button>
            <button
              type="button"
              onClick={() => setShowNewDish(false)}
              className={uiBtnOutlineSm}
            >
              Annuler
            </button>
          </form>
        )}
        <button
          type="button"
          disabled={disableAll}
          onClick={handleIgnore}
          className={`${uiBtnOutlineSm} text-slate-600`}
        >
          Ignorer
        </button>
      </div>
    </div>
  );
}
