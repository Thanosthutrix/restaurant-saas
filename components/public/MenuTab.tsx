"use client";

import { useMemo, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { MenuItemCard } from "@/components/public/MenuItemCard";
import { SetMenuCard } from "@/components/public/SetMenuCard";
import {
  MENU_CATEGORIES,
  type MenuCategory,
} from "@/lib/public/menuCategories";
import type { MenuItem, PublicSetMenu } from "@/lib/public/types";

type Props = {
  items: MenuItem[];
  setMenus?: PublicSetMenu[];
};

type MenuView = MenuCategory | "all" | "formules";

function sortByName(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

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

export function MenuTab({ items, setMenus = [] }: Props) {
  const [view, setView] = useState<MenuView>("all");

  const filters = useMemo(() => {
    const list: { key: MenuView; label: string; count: number }[] = [];
    if (setMenus.length > 0) {
      list.push({ key: "formules", label: "Formules", count: setMenus.length });
    }
    list.push({ key: "all", label: "Tout", count: items.length + setMenus.length });
    for (const meta of MENU_CATEGORIES) {
      const count = items.filter((i) => i.category === meta.value).length;
      if (count > 0) {
        list.push({ key: meta.value, label: meta.sectionLabel, count });
      }
    }
    return list;
  }, [items, setMenus.length]);

  const filteredItems = useMemo(
    () =>
      sortByName(
        view === "all" || view === "formules" ? items : items.filter((i) => i.category === view)
      ),
    [items, view]
  );

  const sections = useMemo(() => {
    if (view !== "all") return null;
    return MENU_CATEGORIES.map((meta) => ({
      meta,
      items: sortByName(items.filter((i) => i.category === meta.value)),
    })).filter((s) => s.items.length > 0);
  }, [items, view]);

  const totalCount = items.length + setMenus.length;
  const isEmpty = totalCount === 0;

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
              {isEmpty
                ? "Aucun article publié pour le moment."
                : `${totalCount} article${totalCount > 1 ? "s" : ""} · Formules et carte au choix`}
            </p>
          </div>
        </div>
      </div>

      {filters.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = view === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setView(f.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {f.label}
                <span className={`ml-1.5 ${active ? "text-white/70" : "text-slate-400"}`}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {view === "formules" ? (
        setMenus.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
            Aucune formule publiée pour le moment.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {setMenus.map((menu) => (
              <SetMenuCard key={menu.id} menu={menu} />
            ))}
          </div>
        )
      ) : isEmpty ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          Aucun article dans cette catégorie pour le moment.
        </p>
      ) : view === "all" ? (
        <div className="space-y-8">
          {setMenus.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-orange-100 pb-2">
                <span className="text-lg" aria-hidden>
                  📋
                </span>
                <h3 className="text-base font-bold text-slate-900">Formules</h3>
                <span className="text-xs font-medium text-slate-400">{setMenus.length}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {setMenus.map((menu) => (
                  <SetMenuCard key={menu.id} menu={menu} />
                ))}
              </div>
            </section>
          ) : null}
          {sections?.map(({ meta, items: sectionItems }) => (
            <MenuSection
              key={meta.value}
              title={meta.sectionLabel}
              emoji={meta.emoji}
              items={sectionItems}
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          Aucun article dans cette catégorie pour le moment.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredItems.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
