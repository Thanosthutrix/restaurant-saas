import Link from "next/link";
import {
  CalendarCheck,
  Info,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { HygieneBadge } from "@/components/public/HygieneBadge";
import { OpeningHoursPanel } from "@/components/public/OpeningHoursPanel";
import { PublicInfoPanel } from "@/components/public/PublicInfoPanel";
import { RestaurantLocationPanel } from "@/components/public/RestaurantLocationPanel";
import { SocialLinks } from "@/components/public/SocialLinks";
import { StarRating } from "@/components/public/StarRating";
import { isOpenAt } from "@/lib/public/formatOpeningHours";
import { buildGoogleMapsSearchUrl } from "@/lib/public/mapLinks";
import type { Restaurant } from "@/lib/public/types";

type Props = {
  restaurant: Restaurant;
};

function HighlightCard({
  icon: Icon,
  label,
  value,
  iconTone = "orange",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  iconTone?: "orange" | "emerald" | "slate" | "amber";
}) {
  const tones = {
    orange: "bg-orange-50 text-orange-600 ring-orange-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[iconTone]}`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <div className="mt-0.5 text-sm font-bold text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  );
}

export function InfoTab({ restaurant }: Props) {
  const schedule = restaurant.opening_hours_schedule;
  const isOpen = schedule ? isOpenAt(schedule) : false;
  const hasSchedule = schedule?.some((day) => !day.isClosed) ?? false;
  const mapsUrl = buildGoogleMapsSearchUrl(restaurant.address);
  const hasContact =
    Boolean(restaurant.phone) ||
    Boolean(restaurant.email) ||
    Boolean(restaurant.social_links?.instagram_url) ||
    Boolean(restaurant.social_links?.facebook_url);

  const openLabel = !hasSchedule
    ? "Horaires non renseignés"
    : isOpen
      ? "Ouvert maintenant"
      : "Fermé actuellement";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {restaurant.phone ? (
          <a
            href={`tel:${restaurant.phone.replace(/\s/g, "")}`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
          >
            <Phone className="h-4 w-4" aria-hidden />
            Appeler
          </a>
        ) : null}
        <Link
          href={`/restaurant/${restaurant.id}?tab=reservation`}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          <CalendarCheck className="h-4 w-4" aria-hidden />
          Réserver
        </Link>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50/50 active:scale-[0.98]"
        >
          <MapPin className="h-4 w-4 text-orange-500" aria-hidden />
          Itinéraire
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HighlightCard
          icon={UtensilsCrossed}
          label="Type d'établissement"
          value={restaurant.cuisine_type}
        />
        <HighlightCard
          icon={Wallet}
          label="Budget"
          value={restaurant.budget_label ?? "Non renseigné"}
          iconTone="amber"
        />
        <HighlightCard
          icon={MapPin}
          label="Statut"
          value={
            <span className={isOpen && hasSchedule ? "text-emerald-700" : "text-slate-700"}>
              {openLabel}
            </span>
          }
          iconTone={isOpen && hasSchedule ? "emerald" : "slate"}
        />
        <HighlightCard
          icon={Star}
          label="Avis clients"
          value={
            restaurant.review_count > 0 ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <StarRating rating={restaurant.average_rating} size="sm" showValue />
                <span className="text-xs font-medium text-slate-500">
                  ({restaurant.review_count})
                </span>
              </span>
            ) : (
              "Pas encore d'avis"
            )
          }
          iconTone="slate"
        />
      </div>

      {restaurant.description?.trim() ? (
        <PublicInfoPanel
          icon={Info}
          title="À propos"
          subtitle="Présentation de l'établissement"
        >
          <div className="px-5 py-5">
            <p className="text-base leading-relaxed text-slate-600">{restaurant.description}</p>
          </div>
        </PublicInfoPanel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {hasContact ? (
          <PublicInfoPanel icon={Phone} title="Contact" subtitle="Joindre l'établissement">
            <div className="space-y-4 px-5 py-5">
              <ul className="space-y-3">
                {restaurant.phone ? (
                  <li>
                    <a
                      href={`tel:${restaurant.phone.replace(/\s/g, "")}`}
                      className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-orange-200 hover:bg-orange-50/60"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-orange-500 shadow-sm ring-1 ring-slate-100">
                        <Phone className="h-4 w-4" aria-hidden />
                      </span>
                      <span>
                        <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                          Téléphone
                        </span>
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-orange-700">
                          {restaurant.phone}
                        </span>
                      </span>
                    </a>
                  </li>
                ) : null}
                {restaurant.email ? (
                  <li>
                    <a
                      href={`mailto:${restaurant.email}`}
                      className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-orange-200 hover:bg-orange-50/60"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-orange-500 shadow-sm ring-1 ring-slate-100">
                        <Mail className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                          E-mail
                        </span>
                        <span className="break-all text-sm font-semibold text-slate-900 group-hover:text-orange-700">
                          {restaurant.email}
                        </span>
                      </span>
                    </a>
                  </li>
                ) : null}
              </ul>
              <SocialLinks restaurant={restaurant} />
            </div>
          </PublicInfoPanel>
        ) : null}

        {restaurant.show_hygiene_score !== false ? (
          <PublicInfoPanel
            icon={ShieldCheck}
            title="Score hygiène"
            subtitle="Suivi ERP en temps réel"
            headerGradient="from-emerald-50 to-white"
            iconClassName="bg-emerald-100 text-emerald-700"
          >
            <div className="space-y-3 px-5 py-5">
              <HygieneBadge
                score={restaurant.hygiene_score}
                liveScore={restaurant.hygiene_score_live}
                hasLiveData={restaurant.hygiene_has_live_data}
                size="lg"
              />
              {restaurant.hygiene_has_live_data && restaurant.hygiene_score_detail ? (
                <p className="text-xs leading-relaxed text-emerald-900/70">
                  {restaurant.hygiene_score_detail} · Calcul live ERP (7 derniers jours)
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-slate-500">
                  Score basé sur le suivi hygiène et les contrôles sanitaires de l&apos;établissement.
                </p>
              )}
            </div>
          </PublicInfoPanel>
        ) : null}
      </div>

      <OpeningHoursPanel restaurant={restaurant} />
      <RestaurantLocationPanel restaurant={restaurant} />
    </div>
  );
}
