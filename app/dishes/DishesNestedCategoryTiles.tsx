"use client";

import type { Dish } from "@/lib/db";
import { countInSubtree, type CategoryTreeNode } from "@/lib/catalog/restaurantCategories";
import { CategoryTileShell } from "@/components/catalog/CategoryTileShell";
import { DishListRow } from "./DishListRow";

export type DishExtra = {
  compCount: number;
  suggestionAvailable: boolean;
};

function CategoryBranch({
  node,
  depth,
  directMap,
  dishExtras,
}: {
  node: CategoryTreeNode;
  depth: number;
  directMap: Map<string, Dish[]>;
  dishExtras: Map<string, DishExtra>;
}) {
  const direct = directMap.get(node.id) ?? [];
  const subtree = countInSubtree(node, directMap);
  const subtitle = `${subtree} ${subtree === 1 ? "plat" : "plats"}`;

  return (
    <CategoryTileShell
      tileKey={`dish-${depth}-${node.id}`}
      title={node.name}
      subtitle={subtitle}
      panelId={`dish-nested-panel-${depth}-${node.id}`}
      depth={depth}
    >
      <div className="space-y-3">
        {node.children.map((ch) => (
          <CategoryBranch
            key={ch.id}
            node={ch}
            depth={depth + 1}
            directMap={directMap}
            dishExtras={dishExtras}
          />
        ))}
        {direct.length > 0 ? (
          <ul className="space-y-2">
            {direct.map((dish) => {
              const ex = dishExtras.get(dish.id)!;
              return (
                <li key={dish.id}>
                  <DishListRow
                    dish={dish}
                    compCount={ex.compCount}
                    suggestionAvailable={ex.suggestionAvailable}
                    showCategoryInRow={false}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </CategoryTileShell>
  );
}

export function DishesNestedCategoryTiles({
  roots,
  directMap,
  dishExtras,
  uncategorized,
}: {
  roots: CategoryTreeNode[];
  directMap: Map<string, Dish[]>;
  dishExtras: Map<string, DishExtra>;
  uncategorized: Dish[];
}) {
  const nUncat = uncategorized.length;
  const uncatSubtitle =
    nUncat === 0 ? "0 plat" : `${nUncat} ${nUncat === 1 ? "plat" : "plats"}`;

  return (
    <div className="space-y-3">
      {roots.map((node) => (
        <CategoryBranch
          key={node.id}
          node={node}
          depth={0}
          directMap={directMap}
          dishExtras={dishExtras}
        />
      ))}
      {nUncat > 0 ? (
        <CategoryTileShell
          tileKey="dish-uncategorized"
          title="Sans rubrique"
          subtitle={uncatSubtitle}
          panelId="dish-nested-panel-uncategorized"
          depth={0}
        >
          <ul className="space-y-2">
            {uncategorized.map((dish) => {
              const ex = dishExtras.get(dish.id)!;
              return (
                <li key={dish.id}>
                  <DishListRow
                    dish={dish}
                    compCount={ex.compCount}
                    suggestionAvailable={ex.suggestionAvailable}
                    showCategoryInRow={false}
                  />
                </li>
              );
            })}
          </ul>
        </CategoryTileShell>
      ) : null}
    </div>
  );
}
