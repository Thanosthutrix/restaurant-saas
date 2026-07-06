"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { BookingForm } from "@/components/public/BookingForm";
import { MenuTab } from "@/components/public/MenuTab";
import { OpeningHoursPanel } from "@/components/public/OpeningHoursPanel";
import { RestaurantLocationPanel } from "@/components/public/RestaurantLocationPanel";
import { ReviewsTab } from "@/components/public/ReviewsTab";
import { StarRating } from "@/components/public/StarRating";
import type { MenuItem, Restaurant, Review } from "@/lib/public/types";

export type RestaurantPreviewTab =
  | "photos"
  | "horaires"
  | "localisation"
  | "carte"
  | "avis"
  | "reservation";

const TABS: { key: RestaurantPreviewTab; label: string }[] = [
  { key: "photos", label: "Photos" },
  { key: "horaires", label: "Horaires" },
  { key: "localisation", label: "Localisation" },
  { key: "carte", label: "Menu" },
  { key: "avis", label: "Avis" },
  { key: "reservation", label: "Réserver" },
];

type Props = {
  restaurantId: string;
  initialTab?: RestaurantPreviewTab;
  onClose: () => void;
};

type LoadedData = {
  restaurant: Restaurant;
  menu_items: MenuItem[];
  reviews: Review[];
  photos: string[];
};

function PhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">
        Aucune photo disponible pour le moment.
      </div>
    );
  }

  const prev = () => setIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === photos.length - 1 ? 0 : i + 1));

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-slate-100">
        <Image
          src={photos[index]}
          alt={`${name} — photo ${index + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 900px"
          priority
        />
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Photo précédente"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md transition hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Photo suivante"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md transition hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {index + 1} / {photos.length}
            </span>
          </>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setIndex(i)}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === index ? "border-orange-500" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={url} alt="" fill className="object-cover" sizes="96px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RestaurantPreviewModal({ restaurantId, initialTab = "photos", onClose }: Props) {
  const [activeTab, setActiveTab] = useState<RestaurantPreviewTab>(initialTab);
  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/restaurants/${restaurantId}`);
      if (!res.ok) {
        setError("Impossible de charger ce restaurant.");
        setData(null);
        return;
      }
      const payload = (await res.json()) as LoadedData;
      setData(payload);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, restaurantId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const restaurant = data?.restaurant;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={restaurant?.name ?? "Restaurant"}
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {loading ? (
                <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
              ) : restaurant ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">
                    {restaurant.cuisine_type}
                  </p>
                  <h2 className="text-xl font-black text-slate-900">{restaurant.name}</h2>
                  {restaurant.review_count > 0 ? (
                    <div className="mt-2">
                      <StarRating rating={restaurant.average_rating} size="sm" showValue />
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Sections du restaurant"
            className="mt-4 flex gap-1 overflow-x-auto pb-1"
          >
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                  activeTab === tab.key
                    ? tab.key === "reservation"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "bg-slate-900 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" role="tabpanel">
          {loading ? (
            <div className="space-y-3 py-8">
              <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-rose-600">{error}</p>
          ) : data && restaurant ? (
            <>
              {activeTab === "photos" ? (
                <div className="space-y-4">
                  <PhotoGallery photos={data.photos} name={restaurant.name} />
                  {restaurant.description ? (
                    <p className="text-sm leading-relaxed text-slate-600">{restaurant.description}</p>
                  ) : null}
                </div>
              ) : null}
              {activeTab === "horaires" ? <OpeningHoursPanel restaurant={restaurant} /> : null}
              {activeTab === "localisation" ? (
                <RestaurantLocationPanel restaurant={restaurant} showReserveLink={false} />
              ) : null}
              {activeTab === "carte" ? <MenuTab items={data.menu_items} /> : null}
              {activeTab === "avis" ? (
                <ReviewsTab restaurant={restaurant} reviews={data.reviews} />
              ) : null}
              {activeTab === "reservation" ? (
                <BookingForm restaurantId={restaurant.id} restaurantName={restaurant.name} />
              ) : null}
            </>
          ) : null}
        </div>

        {restaurant ? (
          <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
            <a
              href={`/restaurant/${restaurant.id}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              <UtensilsCrossed className="h-4 w-4" aria-hidden />
              Voir la fiche complète
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
