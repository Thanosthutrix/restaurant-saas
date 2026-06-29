"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Dish } from "@/lib/db";
import { CategoryPictogram } from "@/components/catalog/CategoryPictogram";
import { leafSegmentFromCategoryPath } from "@/lib/catalog/restaurantCategories";
import { applySuggestedRecipeToDish, deleteDish } from "./[id]/actions";
import { uiBadgeAmber, uiBadgeEmerald, uiBadgeSlate, uiBtnPrimarySm } from "@/components/ui/premium";

/** préparation = cuivre, revente = vert. */
const DISH_MODE_DOT: Record<string, { dotClass: string; label: string }> = {
  prepared: { dotClass: "bg-copper-600", label: "Préparé" },
  resale: { dotClass: "bg-emerald-500", label: "Revente" },
};

export function DishListRow({
  dish,
  compCount,
  suggestionAvailable,
  categoryPath,
  showCategoryInRow = true,
  canWrite = true,
}: {
  dish: Dish;
  compCount: number;
  suggestionAvailable: boolean;
  categoryPath?: string | null;
  /** Si la liste est déjà groupée par rubrique, masquer le chemin sur la ligne. */
  showCategoryInRow?: boolean;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const status = dish.recipe_status ?? (compCount === 0 ? "missing" : "draft");
  const mode = dish.production_mode ?? "";
  const modeDot = DISH_MODE_DOT[mode] ?? {
    dotClass: "bg-stone-400",
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
    status === "validated" ? (
      <span className={uiBadgeEmerald}>Recette OK</span>
    ) : status === "draft" ? (
      <span className={uiBadgeAmber}>Brouillon</span>
    ) : (
      <span className={uiBadgeSlate}>Sans recette</span>
    );

  const leafLabel = categoryPath ? leafSegmentFromCategoryPath(categoryPath) ?? categoryPath : null;
  const subtitle = [showCategoryInRow ? leafLabel : null, modeDot.label].filter(Boolean).join(" · ");

  async function handleSuggest() {
    const result = await applySuggestedRecipeToDish({ restaurantId: dish.restaurant_id, dishId: dish.id });
    if (result.ok) router.push(`/dishes/${dish.id}`);
    else alert(result.error);
  }

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white px-3.5 py-3 shadow-sm transition hover:border-copper-200 hover:shadow-md">
      <Link href={`/dishes/${dish.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
          <CategoryPictogram title={leafLabel ?? dish.name} depth={1} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${modeDot.dotClass}`}
            title={modeDot.label}
            aria-label={modeDot.label}
            role="img"
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-stone-900 transition group-hover:text-copper-700">
            {dish.name}
          </span>
          {subtitle ? <span className="mt-0.5 block truncate text-xs text-stone-500">{subtitle}</span> : null}
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-2.5">
        {recipeBadge}
        {ttc != null && ttc > 0 && (
          <span className="text-[15px] font-semibold tabular-nums text-stone-900">
            {ttc.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
          </span>
        )}
        {canWrite && suggestionAvailable && (
          <button type="button" onClick={handleSuggest} className={`${uiBtnPrimarySm} !px-2 !py-1 text-xs`}>
            Suggérer une base
          </button>
        )}
        {canWrite && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg p-1.5 text-stone-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
            title="Supprimer le plat"
            aria-label={`Supprimer le plat « ${dish.name} »`}
          >
            {deleting ? (
              <span className="block h-4 w-4 animate-pulse text-center text-xs text-stone-400">…</span>
            ) : (
              <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
