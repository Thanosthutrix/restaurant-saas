"use client";

import { useMemo, useState } from "react";
import { MenuItemCard } from "@/components/public/MenuItemCard";
import type { MenuCategory, MenuItem } from "@/lib/public/types";

type Props = {
  items: MenuItem[];
};

const FILTERS: { key: MenuCategory | "all"; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "entrée", label: "Entrées" },
  { key: "plat", label: "Plats" },
  { key: "dessert", label: "Desserts" },
];

export function MenuTab({ items }: Props) {
  const [category, setCategory] = useState<MenuCategory | "all">("all");

  const filtered = useMemo(
    () => (category === "all" ? items : items.filter((i) => i.category === category)),
    [category, items]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = category === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setCategory(f.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          Aucun plat dans cette catégorie pour le moment.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
