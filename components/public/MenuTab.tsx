"use client";

import { useMemo, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { MenuItemCard } from "@/components/public/MenuItemCard";
import {
  MENU_CATEGORIES,
  type MenuCategory,
} from "@/lib/public/menuCategories";
import type { MenuItem } from "@/lib/public/types";

type Props = {
  items: MenuItem[];
};

function sortByName(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

const FILTERS: { key: MenuCategory | "all"; label: string }[] = [
  { key: "all", label: "Tout" },
  ...MENU_CATEGORIES.map((c) => ({ key: c.value, label: c.sectionLabel })),
];

function MenuSection({ title, emoji, items }: { title: string; emoji: string; items: MenuItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <span className="text-lg" aria-hidden>
          {emoji}
        </span>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <span className="text-xs font-medium text-slate-400">{items.length}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function MenuTab({ items }: Props) {
  const [category, setCategory] = useState<MenuCategory | "all">("all");

  const filtered = useMemo(
    () =>
      sortByName(category === "all" ? items : items.filter((i) => i.category === category)),
    [category, items]
  );

  const sections = useMemo(() => {
    if (category !== "all") return null;
    return MENU_CATEGORIES.map((meta) => ({
      meta,
      items: sortByName(items.filter((i) => i.category === meta.value)),
    })).filter((s) => s.items.length > 0);
  }, [category, items]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-orange-50 to-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <UtensilsCrossed className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">La carte</h2>
            <p className="text-sm text-slate-500">
              {items.length === 0
                ? "Aucun article publié pour le moment."
                : `${items.length} article${items.length > 1 ? "s" : ""} · Plats, vins, boissons et plus`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = category === f.key;
          const count =
            f.key === "all" ? items.length : items.filter((i) => i.category === f.key).length;
          if (f.key !== "all" && count === 0) return null;

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
              {count > 0 ? (
                <span className={`ml-1.5 ${active ? "text-white/70" : "text-slate-400"}`}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          Aucun article dans cette catégorie pour le moment.
        </p>
      ) : category === "all" && sections ? (
        <div className="space-y-8">
          {sections.map(({ meta, items: sectionItems }) => (
            <MenuSection
              key={meta.value}
              title={meta.sectionLabel}
              emoji={meta.emoji}
              items={sectionItems}
            />
          ))}
        </div>
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
