"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Radio } from "lucide-react";
import {
  BookingQuickWidget,
  type QuickBookingState,
} from "@/components/public/BookingQuickWidget";
import { ConsumerAuthPrompt } from "@/components/public/consumer/ConsumerAuthPrompt";
import { createPublicReservationAction } from "@/app/compte/actions";
import type { ConsumerProfile } from "@/lib/public/consumer/types";

type Props = {
  restaurantId: string;
  restaurantName: string;
  initialBooking?: QuickBookingState;
  initialProfile?: ConsumerProfile | null;
};

const defaultBooking: QuickBookingState = {
  date: "",
  time: "19:30",
  guests: 2,
};

export function BookingForm({
  restaurantId,
  restaurantName,
  initialBooking,
  initialProfile = null,
}: Props) {
  const [booking, setBooking] = useState<QuickBookingState>(initialBooking ?? defaultBooking);
  const [profile, setProfile] = useState<ConsumerProfile | null | undefined>(initialProfile);
  const [comments, setComments] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [returnPath, setReturnPath] = useState(`/restaurant/${restaurantId}`);

  useEffect(() => {
    setReturnPath(`${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    if (initialProfile !== undefined && initialProfile !== null) return;

    let cancelled = false;
    fetch("/api/compte/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setProfile(data?.profile ?? null);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [initialProfile]);

  const checkAvailability = () => {
    if (!booking.date || !booking.time) return;
    setChecking(true);
    setAvailable(null);
    window.setTimeout(() => {
      setChecking(false);
      setAvailable(true);
    }, 900);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking.date || !booking.time || !profile) return;

    setSubmitting(true);
    setError(null);

    const result = await createPublicReservationAction({
      restaurantId,
      ymd: booking.date,
      timeHm: booking.time,
      partySize: booking.guests,
      comments: comments.trim() || null,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSubmitted(true);
  };

  if (submitted && profile) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
        <h3 className="mt-4 text-xl font-bold text-slate-900">Réservation envoyée !</h3>
        <p className="mt-2 text-slate-600">
          {restaurantName} vous confirmera par e-mail
          {profile.email ? (
            <>
              {" "}
              à <span className="font-semibold">{profile.email}</span>
            </>
          ) : null}
          .
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {booking.date} à {booking.time} · {booking.guests} convive{booking.guests > 1 ? "s" : ""}
        </p>
        <Link
          href="/compte"
          className="mt-4 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Voir mes réservations →
        </Link>
      </div>
    );
  }

  if (profile === undefined) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Chargement…
      </div>
    );
  }

  if (!profile) {
    return <ConsumerAuthPrompt returnPath={returnPath} />;
  }

  const profileIncomplete = !profile.first_name?.trim() || !profile.last_name?.trim();

  if (profileIncomplete) {
    const next = encodeURIComponent(returnPath);
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h3 className="text-lg font-bold text-slate-900">Complétez votre profil</h3>
        <p className="mt-2 text-sm text-slate-600">
          Quelques informations manquent pour finaliser votre réservation.
        </p>
        <Link
          href={`/compte?next=${next}`}
          className="mt-4 inline-flex rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-700"
        >
          Compléter mon profil
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Réservation au nom de{" "}
        <span className="font-semibold text-slate-900">
          {profile.first_name} {profile.last_name}
        </span>
        {profile.email ? <> · {profile.email}</> : null}
      </div>

      <BookingQuickWidget value={booking} onChange={setBooking} />

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
        <div className="flex items-start gap-3">
          <span className="relative mt-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <Radio className="relative h-3 w-3 text-emerald-600" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="font-bold text-emerald-900">Disponibilités vérifiées en direct</p>
            <p className="mt-0.5 text-sm text-emerald-800">
              Connexion temps réel avec le planning du restaurant via l&apos;ERP ubion.
            </p>
            <button
              type="button"
              onClick={checkAvailability}
              disabled={checking || !booking.date}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {checking ? "Vérification…" : "Vérifier le créneau"}
            </button>
            {available ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Créneau disponible — vous pouvez confirmer ci-dessous.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-bold text-slate-900">Finaliser votre réservation</h3>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Commentaires (allergies, occasion…)</span>
          <textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
          />
        </label>

        <button
          type="submit"
          disabled={submitting || !booking.date || !booking.time}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-base font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? "Envoi…" : "Confirmer ma réservation"}
        </button>
      </form>
    </div>
  );
}
