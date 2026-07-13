"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { PublicInfoPanel } from "@/components/public/PublicInfoPanel";
import type { Restaurant } from "@/lib/public/types";
import {
  buildAppleMapsUrl,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsSearchUrl,
  hasMapCoordinates,
  isApplePlatform,
} from "@/lib/public/mapLinks";

type Props = {
  restaurant: Pick<Restaurant, "id" | "name" | "address" | "latitude" | "longitude">;
  /** Afficher la carte intégrée (iframe Google Maps). */
  showEmbed?: boolean;
  /** Lien vers la réservation sous la carte. */
  showReserveLink?: boolean;
};

export function RestaurantLocationPanel({
  restaurant,
  showEmbed = true,
  showReserveLink = true,
}: Props) {
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    setIsApple(isApplePlatform());
  }, []);

  const mapInput = useMemo(
    () => ({
      address: restaurant.address,
      name: restaurant.name,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    }),
    [restaurant.address, restaurant.name, restaurant.latitude, restaurant.longitude]
  );

  const googleUrl = buildGoogleMapsSearchUrl(restaurant.address);
  const appleUrl = buildAppleMapsUrl(mapInput);
  const embedUrl = buildGoogleMapsEmbedUrl(mapInput);
  const hasCoords = hasMapCoordinates(restaurant.latitude, restaurant.longitude);

  return (
    <div className="space-y-4">
      <PublicInfoPanel
        icon={MapPin}
        title="Localisation"
        subtitle={hasCoords ? "Adresse géolocalisée" : "Adresse de l'établissement"}
      >
        <div className="space-y-4 px-5 py-5">
          <p className="text-base font-medium leading-relaxed text-slate-800">{restaurant.address}</p>

          <div className="flex flex-wrap gap-2">
            {isApple ? (
              <a
                href={appleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
              >
                <Navigation className="h-4 w-4" aria-hidden />
                Ouvrir dans Plans
                <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </a>
            ) : null}
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition active:scale-[0.98] ${
                isApple
                  ? "border border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/50"
                  : "bg-orange-600 text-white hover:bg-orange-700"
              }`}
            >
              <Navigation className="h-4 w-4" aria-hidden />
              Google Maps
              <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </a>
            {!isApple ? (
              <a
                href={appleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50/50 active:scale-[0.98]"
              >
                Plans
                <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </a>
            ) : null}
          </div>

          {!hasCoords ? (
            <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-xs leading-relaxed text-amber-900/80">
              Position approximative — le restaurateur peut affiner l&apos;adresse dans son ERP pour
              une carte plus précise.
            </p>
          ) : null}
        </div>
      </PublicInfoPanel>

      {showEmbed ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm ring-1 ring-slate-100">
          <iframe
            title={`Carte — ${restaurant.name}`}
            src={embedUrl}
            className="aspect-[16/9] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      ) : null}

      {showReserveLink ? (
        <p className="text-center">
          <Link
            href={`/restaurant/${restaurant.id}?tab=reservation`}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
          >
            Réserver une table →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
