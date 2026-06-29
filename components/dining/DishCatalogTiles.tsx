"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Dish } from "@/lib/db";
import { countInSubtree, type CategoryTreeNode } from "@/lib/catalog/restaurantCategories";
import { CategoryTileShell } from "@/components/catalog/CategoryTileShell";
import { CategoryPictogram } from "@/components/catalog/CategoryPictogram";

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
  /** Élément optionnel affiché en ligne, juste avant le prix (ex. pastille « ×N »). */
  badge?: ReactNode;
};

/** Bouton pleine largeur : nom + (pastille) + prix TTC (même style que la vente rapide caisse). */
export function DishCatalogTileButton({ dish, disabled, onClick, badge }: DishCatalogTileButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border border-stone-200/80 bg-white px-4 py-3 text-left text-base shadow-sm ring-1 ring-stone-100/80 transition hover:border-copper-200 hover:bg-copper-50/40 active:scale-[0.99] disabled:opacity-60"
    >
      <span className="min-w-0 font-semibold text-stone-900">{dish.name}</span>
      <span className="flex shrink-0 items-center gap-2">
        {badge}
        <span className="tabular-nums text-stone-700">{fmtDishPriceTtc(dish)}</span>
      </span>
    </button>
  );
}

function DishList({ dishes, renderDish }: { dishes: Dish[]; renderDish: (dish: Dish) => ReactNode }) {
  return (
    <ul className="space-y-2">
      {dishes.map((dish) => (
        <li key={dish.id}>{renderDish(dish)}</li>
      ))}
    </ul>
  );
}

/** Sous-rubrique (niveau ≥ 1) : reste un accordéon dans la modale. */
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
        {direct.length > 0 ? <DishList dishes={direct} renderDish={renderDish} /> : null}
      </div>
    </CategoryTileShell>
  );
}

function RootContent({
  node,
  directMap,
  tileKeyPrefix,
  renderDish,
}: {
  node: CategoryTreeNode;
  directMap: Map<string, Dish[]>;
  tileKeyPrefix: string;
  renderDish: (dish: Dish) => ReactNode;
}) {
  const direct = directMap.get(node.id) ?? [];
  return (
    <div className="space-y-3">
      {node.children.map((ch) => (
        <CategoryBranch
          key={ch.id}
          node={ch}
          depth={1}
          directMap={directMap}
          tileKeyPrefix={tileKeyPrefix}
          renderDish={renderDish}
        />
      ))}
      {direct.length > 0 ? <DishList dishes={direct} renderDish={renderDish} /> : null}
    </div>
  );
}

export type DishCatalogTilesProps = {
  roots: CategoryTreeNode[];
  directByCategoryId: Record<string, Dish[]>;
  uncategorized: Dish[];
  /** Préfixe unique par écran (ex. `caisse`, `commande`) pour les ids d’accessibilité. */
  tileKeyPrefix: string;
  renderDish: (dish: Dish) => ReactNode;
  /** Pied de modale optionnel (ex. récap du ticket en cours). `close` ferme la modale. */
  renderModalFooter?: (close: () => void) => ReactNode;
};

type CardItem = { id: string; name: string; count: number; node: CategoryTreeNode | null };

export function DishCatalogTiles({
  roots,
  directByCategoryId,
  uncategorized,
  tileKeyPrefix,
  renderDish,
  renderModalFooter,
}: DishCatalogTilesProps) {
  const directMap = useMemo(
    () => new Map<string, Dish[]>(Object.entries(directByCategoryId)),
    [directByCategoryId]
  );

  const cards: CardItem[] = [
    ...roots.map((node) => ({
      id: node.id,
      name: node.name,
      count: countInSubtree(node, directMap),
      node,
    })),
    ...(uncategorized.length > 0
      ? [{ id: "__uncat__", name: "Sans rubrique", count: uncategorized.length, node: null }]
      : []),
  ];

  const totalPlats =
    [...directMap.values()].reduce((s, arr) => s + arr.length, 0) + uncategorized.length;

  const [openId, setOpenId] = useState<string | null>(null);
  const openCard = cards.find((c) => c.id === openId) ?? null;

  useEffect(() => {
    if (!openCard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openCard]);

  if (totalPlats === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => {
          const active = card.id === openId;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setOpenId(active ? null : card.id)}
              aria-expanded={active}
              className={`group flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border p-4 text-center transition ${
                active
                  ? "border-copper-300 bg-copper-50/50 shadow-md ring-1 ring-copper-200"
                  : "border-stone-200/70 bg-white shadow-sm hover:-translate-y-0.5 hover:border-copper-200 hover:shadow-md"
              }`}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-copper-50 ring-1 ring-copper-100/90">
                <CategoryPictogram title={card.name} depth={0} className="!h-7 !w-7" />
              </span>
              <span className="line-clamp-2 text-sm font-semibold leading-tight text-stone-900">{card.name}</span>
              <span className="text-xs text-stone-500">
                {card.count} {card.count === 1 ? "plat" : "plats"}
              </span>
            </button>
          );
        })}
      </div>

      {openCard ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Rubrique ${openCard.name}`}
          onClick={() => setOpenId(null)}
        >
          <div
            className="my-6 w-full max-w-2xl overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center gap-3 border-b border-stone-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
                <CategoryPictogram title={openCard.name} depth={1} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-900">{openCard.name}</p>
                <p className="text-xs text-stone-500">
                  {openCard.count} {openCard.count === 1 ? "plat" : "plats"} · touchez pour ajouter au ticket
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-3 py-3 sm:px-4">
              {openCard.node ? (
                <RootContent
                  node={openCard.node}
                  directMap={directMap}
                  tileKeyPrefix={tileKeyPrefix}
                  renderDish={renderDish}
                />
              ) : (
                <DishList dishes={uncategorized} renderDish={renderDish} />
              )}
            </div>
            {renderModalFooter ? (
              <div className="border-t border-stone-100 bg-white px-3 py-3 sm:px-4">
                {renderModalFooter(() => setOpenId(null))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
