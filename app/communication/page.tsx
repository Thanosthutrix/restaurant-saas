import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { getRestaurantSocialState } from "@/lib/meta/metaDb";
import { loadCommunicationFeed } from "@/lib/meta/publishService";
import { listSocialPosts } from "@/lib/meta/socialPostsDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { CommunicationClient } from "./CommunicationClient";

export const metadata = { title: "Communication & réseaux sociaux" };

type Props = {
  searchParams: Promise<{ meta?: string; meta_msg?: string }>;
};

export default async function CommunicationPage({ searchParams }: Props) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { meta: metaFlash, meta_msg: metaMessage } = await searchParams;

  const [socialState, feedResult, publishedPosts] = await Promise.all([
    getRestaurantSocialState(restaurant.id),
    loadCommunicationFeed(restaurant.id),
    listSocialPosts(restaurant.id),
  ]);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Megaphone}
        accentTone="bg-pink-50 text-pink-700"
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Communication" },
        ]}
        title="Communication"
        subtitle="Liez Instagram & Facebook, consultez vos contenus et publiez sans quitter l'ERP."
      />

      <CommunicationClient
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        initialSocialState={socialState}
        initialFeed={feedResult.feed}
        initialFeedError={feedResult.feedError}
        initialPublishedPosts={publishedPosts}
        metaFlash={metaFlash === "connected" || metaFlash === "error" ? metaFlash : null}
        metaMessage={metaMessage ?? null}
      />
    </PageContainer>
  );
}
