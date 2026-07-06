import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getConsumerProfileByUserId,
  listConsumerReservations,
} from "@/lib/public/consumer/consumerDb";
import { ConsumerProfileForm } from "@/components/public/consumer/ConsumerProfileForm";
import type { ConsumerProfile } from "@/lib/public/consumer/types";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  seated: "À table",
  completed: "Terminée",
  cancelled: "Annulée",
  no_show: "Absent",
};

function formatParis(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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

  const reservations = profile.first_name
    ? await listConsumerReservations(user.id)
    : [];

  const needsProfile = !profile.first_name || !profile.last_name;

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
        <ConsumerProfileForm profile={profile} />
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-emerald-600" aria-hidden />
          <h2 className="text-lg font-bold text-slate-900">Mes réservations</h2>
        </div>

        {reservations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <p className="text-slate-600">Aucune réservation pour le moment.</p>
            <Link
              href="/"
              className="mt-3 inline-flex text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              Découvrir les restaurants →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reservations.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{r.restaurant_name}</p>
                  <p className="text-sm text-slate-600">
                    {formatParis(r.starts_at)} · {r.party_size} convive{r.party_size > 1 ? "s" : ""}
                  </p>
                  {r.notes ? <p className="mt-1 text-sm text-slate-500">{r.notes}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  <Link
                    href={`/restaurant/${r.restaurant_id}`}
                    className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                  >
                    Voir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
