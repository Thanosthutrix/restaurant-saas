"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900">Adresse</h3>
            <p className="mt-2 text-sm text-slate-600">{restaurant.address}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {isApple ? (
                <a
                  href={appleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Ouvrir dans Plans
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              ) : null}
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isApple
                    ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : "bg-orange-600 text-white hover:bg-orange-700"
                }`}
              >
                Ouvrir dans Google Maps
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              {!isApple ? (
                <a
                  href={appleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Ouvrir dans Plans
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              ) : null}
            </div>

            {!hasCoords ? (
              <p className="mt-3 text-xs text-slate-500">
                Position approximative — le restaurateur peut affiner l&apos;adresse dans son ERP pour
                une carte plus précise.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {showEmbed ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
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
        <p className="text-center text-xs text-slate-500">
          <Link
            href={`/restaurant/${restaurant.id}?tab=reservation`}
            className="font-semibold text-orange-600 hover:text-orange-700"
          >
            Réserver une table →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
