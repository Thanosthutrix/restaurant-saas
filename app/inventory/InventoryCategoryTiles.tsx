"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { InventoryItemWithCalculatedStock } from "@/lib/db";
import { countInSubtree, type CategoryTreeNode } from "@/lib/catalog/restaurantCategories";
import { CategoryTileShell } from "@/components/catalog/CategoryTileShell";
import { CategoryPictogram } from "@/components/catalog/CategoryPictogram";
import { InventoryItemRow } from "./InventoryItemList";

type Item = InventoryItemWithCalculatedStock;

function ItemList({ items }: { items: Item[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <InventoryItemRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

/** Sous-rubrique (niveau ≥ 1) : reste un accordéon. */
function CategoryBranch({
  node,
  depth,
  directMap,
}: {
  node: CategoryTreeNode;
  depth: number;
  directMap: Map<string, Item[]>;
}) {
  const direct = directMap.get(node.id) ?? [];
  const subtree = countInSubtree(node, directMap);
  const subtitle = `${subtree} ${subtree === 1 ? "composant" : "composants"}`;

  return (
    <CategoryTileShell
      tileKey={`inv-${depth}-${node.id}`}
      title={node.name}
      subtitle={subtitle}
      panelId={`inv-nested-panel-${depth}-${node.id}`}
      depth={depth}
    >
      <div className="space-y-3">
        {node.children.map((ch) => (
          <CategoryBranch key={ch.id} node={ch} depth={depth + 1} directMap={directMap} />
        ))}
        {direct.length > 0 ? <ItemList items={direct} /> : null}
      </div>
    </CategoryTileShell>
  );
}

function RootContent({ node, directMap }: { node: CategoryTreeNode; directMap: Map<string, Item[]> }) {
  const direct = directMap.get(node.id) ?? [];
  return (
    <div className="space-y-3">
      {node.children.map((ch) => (
        <CategoryBranch key={ch.id} node={ch} depth={1} directMap={directMap} />
      ))}
      {direct.length > 0 ? <ItemList items={direct} /> : null}
    </div>
  );
}

type CardItem = { id: string; name: string; count: number; node: CategoryTreeNode | null };

export function InventoryCategoryTiles({
  roots,
  directMap,
  uncategorized,
}: {
  roots: CategoryTreeNode[];
  directMap: Map<string, Item[]>;
  uncategorized: Item[];
}) {
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

  const [openId, setOpenId] = useState<string | null>(null);
  const openCard = cards.find((c) => c.id === openId) ?? null;

  useEffect(() => {
    if (!openCard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openCard]);

  return (
    <div className="space-y-4">
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
              <span className="line-clamp-2 text-sm font-semibold leading-tight text-stone-900">
                {card.name}
              </span>
              <span className="text-xs text-stone-500">
                {card.count} {card.count === 1 ? "composant" : "composants"}
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
                  {openCard.count} {openCard.count === 1 ? "composant" : "composants"}
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
            <div className="max-h-[70vh] overflow-y-auto px-3 py-3 sm:px-4">
              {openCard.node ? (
                <RootContent node={openCard.node} directMap={directMap} />
              ) : (
                <ItemList items={uncategorized} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
