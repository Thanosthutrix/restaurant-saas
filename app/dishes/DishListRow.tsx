"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Dish } from "@/lib/db";
import { applySuggestedRecipeToDish, deleteDish } from "./[id]/actions";
import { uiBadgeAmber, uiBadgeSlate, uiBtnPrimarySm, uiListRow } from "@/components/ui/premium";

/** Aligné sur les points du stock : préparation = indigo, revente = vert. */
const DISH_MODE_DOT: Record<string, { dotClass: string; label: string }> = {
  prepared: { dotClass: "bg-indigo-500", label: "Préparé" },
  resale: { dotClass: "bg-emerald-500", label: "Revente" },
};

export function DishListRow({
  dish,
  compCount,
  suggestionAvailable,
}: {
  dish: Dish;
  compCount: number;
  suggestionAvailable: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const status = dish.recipe_status ?? (compCount === 0 ? "missing" : "draft");
  const mode = dish.production_mode ?? "";
  const modeDot = DISH_MODE_DOT[mode] ?? {
    dotClass: "bg-slate-400",
    label: "Mode non défini",
  };

  const ttc =
    dish.selling_price_ttc != null && Number.isFinite(Number(dish.selling_price_ttc))
      ? Number(dish.selling_price_ttc)
      : null;

  async function handleDelete() {
    if (!confirm("Supprimer le plat « " + dish.name + " » ?")) return;
    setDeleting(true);
    const result = await deleteDish({ restaurantId: dish.restaurant_id, dishId: dish.id });
    setDeleting(false);
    if (result.ok) router.refresh();
    else alert(result.error);
  }

  const recipeBadge =
    status === "validated" ? null : status === "draft" ? (
      <span className={uiBadgeAmber}>Brouillon</span>
    ) : (
      <span className={uiBadgeSlate}>Sans recette</span>
    );

  async function handleSuggest() {
    const result = await applySuggestedRecipeToDish({ restaurantId: dish.restaurant_id, dishId: dish.id });
    if (result.ok) router.push(`/dishes/${dish.id}`);
    else alert(result.error);
  }

  return (
    <div className={uiListRow}>
      <Link
        href={`/dishes/${dish.id}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 font-semibold text-slate-900 transition hover:text-indigo-600"
      >
        <span
          className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${modeDot.dotClass}`}
          title={modeDot.label}
          aria-label={modeDot.label}
          role="img"
        />
        <span className="truncate">{dish.name}</span>
      </Link>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        {recipeBadge}
        {ttc != null && ttc > 0 && (
          <span className="tabular-nums text-slate-700">
            {ttc.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} TTC
          </span>
        )}
        {suggestionAvailable && (
          <button type="button" onClick={handleSuggest} className={`${uiBtnPrimarySm} !px-2 !py-1 text-xs`}>
            Suggérer une base
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          title="Supprimer le plat"
          aria-label={`Supprimer le plat « ${dish.name} »`}
        >
          {deleting ? (
            <span className="block h-4 w-4 animate-pulse text-center text-xs text-slate-400">…</span>
          ) : (
            <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
