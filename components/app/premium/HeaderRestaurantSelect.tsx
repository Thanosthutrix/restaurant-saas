"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown } from "lucide-react";
import { switchRestaurantAction } from "@/app/restaurants/actions";

type Row = { id: string; name: string };

export type EstablishmentPayload = {
  restaurantId: string;
  activityLabel: string;
  serviceLabel: string;
  avgCovers: number | null;
  /** Nom d’expéditeur effectif (personnalisé ou nom de l’établissement). */
  emailSenderLabel: string;
};

export type HeaderRestaurantServerPayload = {
  restaurants: Row[];
  currentRestaurantId: string | null;
  establishment: EstablishmentPayload | null;
};

/**
 * Panneau établissement (survol / focus) — même esthétique que la météo header.
 */
function EstablishmentFlyout({ e }: { e: EstablishmentPayload }) {
  return (
    <div
      className="pointer-events-none invisible absolute left-0 top-full z-50 mt-1.5 min-w-[17rem] max-w-sm origin-top scale-95 rounded-2xl border border-slate-100 bg-white p-3 opacity-0 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100/80 transition-all duration-150 ease-out group-hover:pointer-events-auto group-hover:visible group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:scale-100 group-focus-within:opacity-100"
      role="region"
      aria-label="Fiche établissement"
    >
      <p className="border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Établissement
      </p>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Activité</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{e.activityLabel}</dd>
        </div>
        {e.avgCovers != null ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Couverts / jour</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{e.avgCovers}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Type de service</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{e.serviceLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">E-mails (nom expéditeur)</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{e.emailSenderLabel}</dd>
          <p className="mt-1.5 text-xs leading-snug text-slate-500">
            Pour le modifier, ouvrez <span className="font-medium text-slate-600">Infos établissement</span> ci-dessous
            (le champ est sous le nom de l’établissement).
          </p>
        </div>
      </dl>
      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
        <Link
          href={`/restaurants/${e.restaurantId}/edit#messagerie-expediteur`}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-800 shadow-sm transition hover:border-indigo-200 hover:bg-slate-50"
        >
          Infos établissement
        </Link>
        <Link
          href="/restaurants/new"
          className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          + Nouvel établissement
        </Link>
      </div>
    </div>
  );
}

/**
 * Sélecteur d’établissement (header). Survol du nom (ou du sélecteur) : fiche établissement.
 */
export function HeaderRestaurantSelect({
  server,
}: {
  /** Données issues du layout RSC — évite le fetch `/api/restaurants/me` (cookies / timing). */
  server?: HeaderRestaurantServerPayload | null;
}) {
  const [rows, setRows] = useState<Row[] | null>(() =>
    server && server.restaurants.length > 0 ? server.restaurants : null
  );
  const [currentId, setCurrentId] = useState<string | null>(() =>
    server && server.restaurants.length > 0 ? server.currentRestaurantId : null
  );
  const [establishment, setEstablishment] = useState<EstablishmentPayload | null>(() =>
    server && server.restaurants.length > 0 ? server.establishment : null
  );
  const [done, setDone] = useState(() => Boolean(server && server.restaurants.length > 0));

  useEffect(() => {
    if (server && server.restaurants.length > 0) {
      setRows(server.restaurants);
      setCurrentId(server.currentRestaurantId);
      setEstablishment(server.establishment);
      setDone(true);
      return;
    }

    let cancelled = false;
    fetch("/api/restaurants/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          j: {
            restaurants?: Row[];
            currentRestaurantId?: string | null;
            establishment?: EstablishmentPayload | null;
          } | null
        ) => {
          if (cancelled || !j?.restaurants?.length) return;
          setRows(j.restaurants);
          setCurrentId(j.currentRestaurantId ?? j.restaurants[0]?.id ?? null);
          setEstablishment(j.establishment ?? null);
        }
      )
      .finally(() => {
        if (!cancelled) setDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [server]);

  if (!done) {
    return (
      <div
        className="h-10 w-44 animate-pulse rounded-xl bg-slate-200/80"
        aria-hidden
      />
    );
  }

  if (!rows?.length) return null;

  const current = rows.find((r) => r.id === currentId) ?? rows[0];
  const panel = establishment ? <EstablishmentFlyout e={establishment} /> : null;

  if (rows.length === 1) {
    return (
      <div className="group relative max-w-[min(100vw-8rem,16rem)]">
        <div
          tabIndex={0}
          className="flex max-w-full cursor-default items-center gap-2 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none ring-indigo-500/0 transition hover:border-indigo-200 hover:bg-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Building2 className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
          <span className="truncate font-semibold text-slate-900">{current.name}</span>
        </div>
        {panel}
      </div>
    );
  }

  return (
    <div className="group relative max-w-[min(100vw-10rem,18rem)]">
      <form action={switchRestaurantAction} className="relative w-full min-w-[12rem]">
        <Building2
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-indigo-600"
          aria-hidden
        />
        <select
          name="restaurantId"
          defaultValue={currentId ?? current.id}
          onChange={(e) => {
            e.currentTarget.form?.requestSubmit();
          }}
          className="h-10 w-full min-w-[12rem] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-10 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-indigo-200 hover:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Restaurant actif"
          suppressHydrationWarning
        >
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
      </form>
      {panel}
    </div>
  );
}
