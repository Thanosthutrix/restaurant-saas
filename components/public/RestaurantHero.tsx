import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import { HygieneBadge } from "@/components/public/HygieneBadge";
import { SocialLinks } from "@/components/public/SocialLinks";
import { StarRating } from "@/components/public/StarRating";
import type { Restaurant } from "@/lib/public/types";

type Props = {
  restaurant: Restaurant;
};

export function RestaurantHero({ restaurant }: Props) {
  const cover = restaurant.cover_url ?? restaurant.image_url;

  return (
    <section className="relative">
      <div className="relative h-56 overflow-hidden bg-slate-900 sm:h-72 lg:h-80">
        <Image
          src={cover}
          alt=""
          fill
          priority
          className="object-cover opacity-90"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="absolute -top-44 inline-flex items-center gap-1 rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm backdrop-blur transition hover:bg-white sm:-top-52"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour
        </Link>

        <div className="-mt-16 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:-mt-20 sm:p-6 lg:-mt-24">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
                {restaurant.cuisine_type}
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
                {restaurant.name}
              </h1>
              <p className="mt-2 flex items-start gap-2 text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                {restaurant.address}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                {restaurant.phone ? (
                  <a
                    href={`tel:${restaurant.phone.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-1.5 hover:text-orange-600"
                  >
                    <Phone className="h-4 w-4" aria-hidden />
                    {restaurant.phone}
                  </a>
                ) : null}
                {restaurant.email ? (
                  <a
                    href={`mailto:${restaurant.email}`}
                    className="inline-flex items-center gap-1.5 hover:text-orange-600"
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                    {restaurant.email}
                  </a>
                ) : null}
              </div>
              <SocialLinks restaurant={restaurant} className="mt-3" />
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <HygieneBadge
                score={restaurant.hygiene_score}
                liveScore={restaurant.hygiene_score_live}
                hasLiveData={restaurant.hygiene_has_live_data}
              />
              <div className="flex items-center gap-2">
                <StarRating rating={restaurant.average_rating} showValue />
                <span className="text-sm text-slate-500">({restaurant.review_count} avis)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
