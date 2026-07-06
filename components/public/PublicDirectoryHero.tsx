"use client";

import { BrandLogo } from "@/components/app/BrandLogo";
import { PublicDirectorySearch } from "@/components/public/PublicDirectorySearch";

type Props = {
  locationQuery: string;
  onLocationQueryChange: (value: string) => void;
  restaurantQuery: string;
  onRestaurantQueryChange: (value: string) => void;
  resultCount: number;
  locationHint?: string | null;
  geocodingLocation?: boolean;
};

export function PublicDirectoryHero({
  locationQuery,
  onLocationQueryChange,
  restaurantQuery,
  onRestaurantQueryChange,
  resultCount,
  locationHint,
  geocodingLocation,
}: Props) {
  return (
    <section className="border-b border-slate-200 bg-gradient-to-b from-orange-50/90 via-white to-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
          <div className="flex shrink-0 justify-center lg:justify-start">
            <BrandLogo className="h-16 w-auto sm:h-20" aria-hidden />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-center text-3xl font-black tracking-tight text-slate-900 sm:text-left sm:text-4xl">
              Trouvez votre prochaine table
            </h1>
            <p className="mt-2 text-center text-sm text-slate-600 sm:text-left sm:text-base">
              Partenaires ubion uniquement — planifiez votre sortie et réservez en ligne.
            </p>
            <div className="mt-5">
              <PublicDirectorySearch
                locationQuery={locationQuery}
                onLocationQueryChange={onLocationQueryChange}
                restaurantQuery={restaurantQuery}
                onRestaurantQueryChange={onRestaurantQueryChange}
                resultCount={resultCount}
                locationHint={locationHint}
                geocodingLocation={geocodingLocation}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
