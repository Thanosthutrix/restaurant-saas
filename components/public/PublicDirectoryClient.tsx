"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  RestaurantPreviewModal,
  type RestaurantPreviewTab,
} from "@/components/public/RestaurantPreviewModal";
import { RestaurantCard } from "@/components/public/RestaurantCard";
import { PublicDirectoryHero } from "@/components/public/PublicDirectoryHero";
import type { GeocodedPlace, Restaurant } from "@/lib/public/types";
import {
  haversineKm,
  PARTNER_SEARCH_RADIUS_KM,
} from "@/lib/public/geoDistance";
import { hasMapCoordinates } from "@/lib/public/mapLinks";
import { geocodePlaceClient } from "@/lib/public/geocodePlaceClient";

const PublicRestaurantsMap = dynamic(
  () =>
    import("@/components/public/PublicRestaurantsMap").then((m) => ({
      default: m.PublicRestaurantsMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full animate-pulse bg-slate-100"
        style={{ height: "min(50vh, 480px)", minHeight: 280 }}
        aria-hidden
      />
    ),
  }
);

type Props = {
  restaurants: Restaurant[];
};

export function PublicDirectoryClient({ restaurants }: Props) {
  const [locationQuery, setLocationQuery] = useState("");
  const [restaurantQuery, setRestaurantQuery] = useState("");
  const [searchTarget, setSearchTarget] = useState<GeocodedPlace | null>(null);
  const [geocodingLocation, setGeocodingLocation] = useState(false);

  const [preview, setPreview] = useState<{
    id: string;
    tab: RestaurantPreviewTab;
  } | null>(null);

  useEffect(() => {
    const q = locationQuery.trim();
    if (!q) {
      setSearchTarget(null);
      setGeocodingLocation(false);
      return;
    }

    setGeocodingLocation(true);
    const timer = window.setTimeout(() => {
      void geocodePlaceClient(q).then((place) => {
        setSearchTarget(place);
        setGeocodingLocation(false);
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [locationQuery]);

  const filtered = useMemo(() => {
    let list = restaurants;

    const rq = restaurantQuery.trim().toLowerCase();
    if (rq) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(rq) ||
          r.cuisine_type.toLowerCase().includes(rq) ||
          r.address.toLowerCase().includes(rq)
      );
    }

    if (searchTarget) {
      list = list.filter((r) => {
        if (!hasMapCoordinates(r.latitude, r.longitude)) return true;
        return (
          haversineKm(searchTarget, {
            lat: r.latitude!,
            lng: r.longitude!,
          }) <= PARTNER_SEARCH_RADIUS_KM
        );
      });
    }

    return list;
  }, [restaurantQuery, restaurants, searchTarget]);

  const openPreview = (id: string, tab: RestaurantPreviewTab = "photos") => {
    setPreview({ id, tab });
  };

  return (
    <>
      <PublicDirectoryHero
        locationQuery={locationQuery}
        onLocationQueryChange={setLocationQuery}
        restaurantQuery={restaurantQuery}
        onRestaurantQueryChange={setRestaurantQuery}
        resultCount={filtered.length}
        locationHint={searchTarget?.label ?? null}
        geocodingLocation={geocodingLocation}
      />

      <section
        aria-label="Carte des restaurants partenaires ubion"
        className="w-full border-b border-slate-200"
      >
        <PublicRestaurantsMap
          restaurants={filtered}
          searchTarget={searchTarget}
          onOpenRestaurant={(id) => openPreview(id, "photos")}
        />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="mb-5 text-lg font-bold text-slate-900">
          Partenaires ubion
          {searchTarget ? ` près de ${searchTarget.label.split(",")[0]}` : ""}
        </h2>
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
            {searchTarget
              ? "Aucun partenaire ubion trouvé dans cette zone. Essayez une ville voisine ou élargissez votre recherche."
              : "Aucun restaurant ne correspond à votre recherche."}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onOpen={openPreview}
              />
            ))}
          </div>
        )}
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
