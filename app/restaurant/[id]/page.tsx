import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RestaurantDetailClient } from "@/components/public/RestaurantDetailClient";
import { RestaurantHero } from "@/components/public/RestaurantHero";
import { SocialStoriesStrip } from "@/components/public/SocialStoriesStrip";
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
  // Détails restaurant (public) et profil consommateur sont indépendants → en parallèle.
  const [data, consumerProfile] = await Promise.all([
    getPublicRestaurantWithDetails(id),
    getCurrentConsumerProfile(),
  ]);

  if (!data) notFound();

  const { menu_items, set_menus, reviews, social_stories, ...restaurant } = data;

  return (
    <>
      <RestaurantHero restaurant={restaurant} />
      <SocialStoriesStrip restaurant={restaurant} stories={social_stories ?? []} />
      <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8">Chargement…</div>}>
        <RestaurantDetailClient
          restaurant={restaurant}
          menuItems={menu_items}
          setMenus={set_menus}
          reviews={reviews}
          consumerProfile={consumerProfile}
        />
      </Suspense>
    </>
  );
}
