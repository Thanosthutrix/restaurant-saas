import { absoluteUrl } from "@/lib/seo/siteUrl";
import type { Restaurant } from "@/lib/public/types";

export function buildRestaurantJsonLd(restaurant: Restaurant) {
  const image = restaurant.cover_url?.trim() || restaurant.image_url?.trim() || undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    description: restaurant.description || undefined,
    url: absoluteUrl(`/restaurant/${restaurant.id}`),
    image,
    servesCuisine: restaurant.cuisine_type || undefined,
    address: restaurant.address
      ? {
          "@type": "PostalAddress",
          streetAddress: restaurant.address,
          addressCountry: "FR",
        }
      : undefined,
    telephone: restaurant.phone || undefined,
    ...(restaurant.average_rating > 0 && restaurant.review_count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: restaurant.average_rating,
            reviewCount: restaurant.review_count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}
