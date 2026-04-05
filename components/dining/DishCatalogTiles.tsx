"use client";

import { useMemo, type ReactNode } from "react";
import type { Dish } from "@/lib/db";
import { countInSubtree, type CategoryTreeNode } from "@/lib/catalog/restaurantCategories";
import { CategoryTileShell } from "@/components/catalog/CategoryTileShell";

export function fmtDishPriceTtc(dish: Dish): string {
  const raw = dish.selling_price_ttc;
  const ttc = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null;
  if (ttc == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(ttc);
}

type DishCatalogTileButtonProps = {
  dish: Dish;
  disabled?: boolean;
  onClick: () => void;
};

/** Bouton pleine largeur : nom + prix TTC (même style que la vente rapide caisse). */
export function DishCatalogTileButton({ dish, disabled, onClick }: DishCatalogTileButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-left text-sm shadow-sm ring-1 ring-slate-100/80 transition hover:border-indigo-200 hover:bg-indigo-50/40 disabled:opacity-60"
    >
      <span className="min-w-0 font-semibold text-slate-900">{dish.name}</span>
      <span className="shrink-0 tabular-nums text-slate-700">{fmtDishPriceTtc(dish)}</span>
    </button>
  );
}

function CategoryBranch({
  node,
  depth,
  directMap,
  tileKeyPrefix,
  renderDish,
}: {
  node: CategoryTreeNode;
  depth: number;
  directMap: Map<string, Dish[]>;
  tileKeyPrefix: string;
  renderDish: (dish: Dish) => ReactNode;
}) {
  const direct = directMap.get(node.id) ?? [];
  const subtree = countInSubtree(node, directMap);
  const subtitle = `${subtree} ${subtree === 1 ? "plat" : "plats"}`;

  return (
    <CategoryTileShell
      tileKey={`${tileKeyPrefix}-${depth}-${node.id}`}
      title={node.name}
      subtitle={subtitle}
      panelId={`${tileKeyPrefix}-panel-${depth}-${node.id}`}
      depth={depth}
    >
      <div className="space-y-3">
        {node.children.map((ch) => (
          <CategoryBranch
            key={ch.id}
            node={ch}
            depth={depth + 1}
            directMap={directMap}
            tileKeyPrefix={tileKeyPrefix}
            renderDish={renderDish}
          />
        ))}
        {direct.length > 0 ? (
          <ul className="space-y-2">
            {direct.map((dish) => (
              <li key={dish.id}>{renderDish(dish)}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </CategoryTileShell>
  );
}

export type DishCatalogTilesProps = {
  roots: CategoryTreeNode[];
  directByCategoryId: Record<string, Dish[]>;
  uncategorized: Dish[];
  /** Préfixe unique par écran (ex. `caisse`, `commande`) pour les ids d’accessibilité. */
  tileKeyPrefix: string;
  renderDish: (dish: Dish) => ReactNode;
};

export function DishCatalogTiles({
  roots,
  directByCategoryId,
  uncategorized,
  tileKeyPrefix,
  renderDish,
}: DishCatalogTilesProps) {
  const directMap = useMemo(
    () => new Map<string, Dish[]>(Object.entries(directByCategoryId)),
    [directByCategoryId]
  );
  const nUncat = uncategorized.length;
  const uncatSubtitle =
    nUncat === 0 ? "0 plat" : `${nUncat} ${nUncat === 1 ? "plat" : "plats"}`;
  const totalPlats =
    [...directMap.values()].reduce((s, arr) => s + arr.length, 0) + uncategorized.length;

  if (totalPlats === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {roots.map((node) => (
        <CategoryBranch
          key={node.id}
          node={node}
          depth={0}
          directMap={directMap}
          tileKeyPrefix={tileKeyPrefix}
          renderDish={renderDish}
        />
      ))}
      {nUncat > 0 ? (
        <CategoryTileShell
          tileKey={`${tileKeyPrefix}-uncategorized`}
          title="Sans rubrique"
          subtitle={uncatSubtitle}
          panelId={`${tileKeyPrefix}-panel-uncategorized`}
          depth={0}
        >
          <ul className="space-y-2">
            {uncategorized.map((dish) => (
              <li key={dish.id}>{renderDish(dish)}</li>
            ))}
          </ul>
        </CategoryTileShell>
      ) : null}
    </div>
  );
}
