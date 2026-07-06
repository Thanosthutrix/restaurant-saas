"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookingForm } from "@/components/public/BookingForm";
import { InfoTab } from "@/components/public/InfoTab";
import { MenuTab } from "@/components/public/MenuTab";
import { ReviewsTab } from "@/components/public/ReviewsTab";
import type { MenuItem, Restaurant, Review } from "@/lib/public/types";
import type { ConsumerProfile } from "@/lib/public/consumer/types";

type TabKey = "carte" | "reservation" | "infos" | "avis";

const TABS: { key: TabKey; label: string }[] = [
  { key: "carte", label: "Carte" },
  { key: "reservation", label: "Réservation" },
  { key: "infos", label: "Infos" },
  { key: "avis", label: "Avis" },
];

type Props = {
  restaurant: Restaurant;
  menuItems: MenuItem[];
  reviews: Review[];
  consumerProfile?: ConsumerProfile | null;
};

export function RestaurantDetailClient({
  restaurant,
  menuItems,
  reviews,
  consumerProfile,
}: Props) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: TabKey =
    tabParam === "reservation" || tabParam === "infos" || tabParam === "avis" || tabParam === "carte"
      ? tabParam
      : "carte";

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    if (
      tabParam === "reservation" ||
      tabParam === "infos" ||
      tabParam === "avis" ||
      tabParam === "carte"
    ) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <div
        role="tablist"
        aria-label="Sections du restaurant"
        className="sticky top-16 z-40 -mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-2"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-slate-900 text-white shadow-md"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6" role="tabpanel">
        {activeTab === "carte" ? <MenuTab items={menuItems} /> : null}
        {activeTab === "reservation" ? (
          <BookingForm
            restaurantId={restaurant.id}
            restaurantName={restaurant.name}
            initialProfile={consumerProfile}
          />
        ) : null}
        {activeTab === "infos" ? <InfoTab restaurant={restaurant} /> : null}
        {activeTab === "avis" ? <ReviewsTab restaurant={restaurant} reviews={reviews} /> : null}
      </div>
    </div>
  );
}
