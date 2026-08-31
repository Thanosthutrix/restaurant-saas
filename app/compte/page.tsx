import { redirect } from "next/navigation";
import { CalendarDays, Compass, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { extractOAuthNameParts } from "@/lib/auth/oauthProfile";
import {
  getConsumerProfileByUserId,
  listConsumerReservations,
} from "@/lib/public/consumer/consumerDb";
import { getConsumerSearchPreferences } from "@/lib/b2c/experience/consumerPreferencesDb";
import { ConsumerProfileForm } from "@/components/public/consumer/ConsumerProfileForm";
import { ConsumerSearchPreferencesForm } from "@/components/public/consumer/ConsumerSearchPreferencesForm";
import { ConsumerReservationsList } from "@/components/public/consumer/ConsumerReservationsList";
import type { ConsumerProfile } from "@/lib/public/consumer/types";

export default async function ComptePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/compte/connexion?next=/compte");

  const profile: ConsumerProfile =
    (await getConsumerProfileByUserId(user.id, user.email ?? null)) ?? {
      user_id: user.id,
      first_name: "",
      last_name: "",
      phone: null,
      phone_normalized: null,
      marketing_opt_in: false,
      email: user.email ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

  const oauthNames = extractOAuthNameParts(user.user_metadata as Record<string, unknown>);
  const displayProfile: ConsumerProfile = {
    ...profile,
    first_name: profile.first_name || oauthNames.firstName,
    last_name: profile.last_name || oauthNames.lastName,
  };

  const reservations = displayProfile.first_name
    ? await listConsumerReservations(user.id)
    : [];

  const searchPrefs = await getConsumerSearchPreferences(user.id);

  const needsProfile = !displayProfile.first_name || !displayProfile.last_name;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mon compte</h1>
        <p className="mt-2 text-slate-600">
          Gérez vos réservations, retrouvez vos restaurants et recevez vos confirmations.
        </p>
      </div>

      {needsProfile ? (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Complétez votre profil</p>
          <p className="mt-1 text-sm text-amber-800">
            Quelques informations pour finaliser vos réservations et recevoir vos tickets.
          </p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserRound className="h-5 w-5 text-orange-600" aria-hidden />
          <h2 className="text-lg font-bold text-slate-900">Profil</h2>
        </div>
        <ConsumerProfileForm profile={displayProfile} />
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Compass className="h-5 w-5 text-violet-600" aria-hidden />
          <h2 className="text-lg font-bold text-slate-900">Mes envies & exclusions</h2>
        </div>
        <ConsumerSearchPreferencesForm initial={searchPrefs} />
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-emerald-600" aria-hidden />
          <h2 className="text-lg font-bold text-slate-900">Mes réservations</h2>
        </div>

        <ConsumerReservationsList reservations={reservations} />
      </section>
    </div>
  );
}
