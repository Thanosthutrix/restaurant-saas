"use client";

import { MapPin, Search, UtensilsCrossed } from "lucide-react";

type Props = {
  locationQuery: string;
  onLocationQueryChange: (value: string) => void;
  restaurantQuery: string;
  onRestaurantQueryChange: (value: string) => void;
  resultCount: number;
  locationHint?: string | null;
  geocodingLocation?: boolean;
};

export function PublicDirectorySearch({
  locationQuery,
  onLocationQueryChange,
  restaurantQuery,
  onRestaurantQueryChange,
  resultCount,
  locationHint,
  geocodingLocation,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="relative block">
          <MapPin
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-orange-500"
            aria-hidden
          />
          <input
            type="search"
            value={locationQuery}
            onChange={(e) => onLocationQueryChange(e.target.value)}
            placeholder="Où allez-vous ? (ville, quartier…)"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-base text-slate-900 shadow-sm shadow-slate-200/50 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
            aria-label="Lieu de votre sortie"
          />
        </label>

        <label className="relative block">
          <UtensilsCrossed
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={restaurantQuery}
            onChange={(e) => onRestaurantQueryChange(e.target.value)}
            placeholder="Restaurant, cuisine… (optionnel)"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-base text-slate-900 shadow-sm shadow-slate-200/50 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
            aria-label="Filtrer les restaurants partenaires"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Search className="h-4 w-4 text-slate-400" aria-hidden />
          {resultCount} partenaire{resultCount > 1 ? "s" : ""} ubion affiché
          {resultCount > 1 ? "s" : ""}
        </span>
        {geocodingLocation ? <span className="text-orange-600">Localisation…</span> : null}
        {!geocodingLocation && locationHint ? (
          <span className="text-slate-600">
            Carte centrée sur <span className="font-medium text-slate-800">{locationHint}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
