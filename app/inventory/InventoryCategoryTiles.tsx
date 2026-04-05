"use client";

import type { InventoryItemWithCalculatedStock } from "@/lib/db";
import {
  countInSubtree,
  type CategoryTreeNode,
} from "@/lib/catalog/restaurantCategories";
import { CategoryTileShell } from "@/components/catalog/CategoryTileShell";
import { InventoryItemRow } from "./InventoryItemList";

function CategoryBranch({
  node,
  depth,
  directMap,
}: {
  node: CategoryTreeNode;
  depth: number;
  directMap: Map<string, InventoryItemWithCalculatedStock[]>;
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
        {direct.length > 0 ? (
          <ul className="space-y-2">
            {direct.map((item) => (
              <InventoryItemRow key={item.id} item={item} />
            ))}
          </ul>
        ) : null}
      </div>
    </CategoryTileShell>
  );
}

export function InventoryCategoryTiles({
  roots,
  directMap,
  uncategorized,
}: {
  roots: CategoryTreeNode[];
  directMap: Map<string, InventoryItemWithCalculatedStock[]>;
  uncategorized: InventoryItemWithCalculatedStock[];
}) {
  const nUncat = uncategorized.length;
  const uncatSubtitle =
    nUncat === 0 ? "0 composant" : `${nUncat} ${nUncat === 1 ? "composant" : "composants"}`;

  return (
    <div className="space-y-3">
      {roots.map((node) => (
        <CategoryBranch key={node.id} node={node} depth={0} directMap={directMap} />
      ))}
      {nUncat > 0 ? (
        <CategoryTileShell
          tileKey="inv-uncategorized"
          title="Sans rubrique"
          subtitle={uncatSubtitle}
          panelId="inv-nested-panel-uncategorized"
          depth={0}
        >
          <ul className="space-y-2">
            {uncategorized.map((item) => (
              <InventoryItemRow key={item.id} item={item} />
            ))}
          </ul>
        </CategoryTileShell>
      ) : null}
    </div>
  );
}
