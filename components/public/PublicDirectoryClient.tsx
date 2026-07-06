"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  RestaurantPreviewModal,
  type RestaurantPreviewTab,
} from "@/components/public/RestaurantPreviewModal";
import { RestaurantCard } from "@/components/public/RestaurantCard";
import { RestaurantSearchBar } from "@/components/public/RestaurantSearchBar";
import type { Restaurant } from "@/lib/public/types";

const PublicRestaurantsMap = dynamic(
  () =>
    import("@/components/public/PublicRestaurantsMap").then((m) => ({
      default: m.PublicRestaurantsMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-square animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
    ),
  }
);

type Props = {
  restaurants: Restaurant[];
};

export function PublicDirectoryClient({ restaurants }: Props) {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<{
    id: string;
    tab: RestaurantPreviewTab;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine_type.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q)
    );
  }, [query, restaurants]);

  const openPreview = (id: string, tab: RestaurantPreviewTab = "photos") => {
    setPreview({ id, tab });
  };

  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-orange-50/80 to-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Trouvez votre prochaine table
            </h1>
            <p className="mt-3 text-base text-slate-600 sm:text-lg">
              Carte en direct, avis certifiés par ticket de caisse et score d&apos;hygiène officiel.
            </p>
          </div>
          <div className="mt-8 max-w-xl">
            <RestaurantSearchBar
              value={query}
              onChange={setQuery}
              resultCount={filtered.length}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="mb-5 text-lg font-bold text-slate-900">
              Restaurants à proximité
            </h2>
            {filtered.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                Aucun restaurant ne correspond à votre recherche.
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {filtered.map((restaurant) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    onOpen={openPreview}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-3">
              <PublicRestaurantsMap
                restaurants={filtered}
                onSelect={(id) => openPreview(id, "localisation")}
              />
              <p className="text-center text-xs text-slate-500">
                Cliquez sur un marqueur pour voir la fiche et réserver.
              </p>
            </div>
          </aside>
        </div>

        <div className="mt-10 lg:hidden">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Carte</h2>
          <PublicRestaurantsMap
            restaurants={filtered}
            onSelect={(id) => openPreview(id, "localisation")}
          />
        </div>
      </section>

      {preview ? (
        <RestaurantPreviewModal
          restaurantId={preview.id}
          initialTab={preview.tab}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
