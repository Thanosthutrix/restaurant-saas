import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RestaurantDetailClient } from "@/components/public/RestaurantDetailClient";
import { RestaurantHero } from "@/components/public/RestaurantHero";
import { getPublicRestaurantWithDetails } from "@/lib/public/data";
import { getCurrentConsumerProfile } from "@/lib/public/consumer/consumerDb";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getPublicRestaurantWithDetails(id);
  if (!data) return { title: "Restaurant introuvable" };

  return {
    title: data.name,
    description: data.description,
  };
}

export default async function RestaurantDetailPage({ params }: Props) {
  const { id } = await params;
  const data = await getPublicRestaurantWithDetails(id);

  if (!data) notFound();

  const { menu_items, reviews, ...restaurant } = data;
  const consumerProfile = await getCurrentConsumerProfile();

  return (
    <>
      <RestaurantHero restaurant={restaurant} />
      <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8">Chargement…</div>}>
        <RestaurantDetailClient
          restaurant={restaurant}
          menuItems={menu_items}
          reviews={reviews}
          consumerProfile={consumerProfile}
        />
      </Suspense>
    </>
  );
}
