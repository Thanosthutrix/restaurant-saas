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
  /** Nom d’expéditeur effectif (personnalisé ou nom de l’établissement). */
  emailSenderLabel: string;
  /** Adresse postale renseignée sur la fiche établissement. */
  addressLabel: string | null;
};

export type HeaderRestaurantServerPayload = {
  restaurants: Row[];
  currentRestaurantId: string | null;
  establishment: EstablishmentPayload | null;
};

function restaurantEditHref(restaurantId: string) {
  return `/restaurants/${restaurantId}/edit`;
}

/**
 * Sélecteur d’établissement (header). Clic sur le nom → fiche établissement.
 */
export function HeaderRestaurantSelect({
  server,
  clientFetchEnabled = true,
}: {
  /** Données issues du layout RSC — évite le fetch `/api/restaurants/me` (cookies / timing). */
  server?: HeaderRestaurantServerPayload | null;
  clientFetchEnabled?: boolean;
}) {
  const [rows, setRows] = useState<Row[] | null>(() =>
    server && server.restaurants.length > 0 ? server.restaurants : null
  );
  const [currentId, setCurrentId] = useState<string | null>(() =>
    server && server.restaurants.length > 0 ? server.currentRestaurantId : null
  );
  const [done, setDone] = useState(() => Boolean(server && server.restaurants.length > 0));

  useEffect(() => {
    if (server && server.restaurants.length > 0) {
      return;
    }

    if (!clientFetchEnabled) {
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
          } | null
        ) => {
          if (cancelled || !j?.restaurants?.length) return;
          setRows(j.restaurants);
          setCurrentId(j.currentRestaurantId ?? j.restaurants[0]?.id ?? null);
        }
      )
      .finally(() => {
        if (!cancelled) setDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientFetchEnabled, server]);

  const effectiveRows = server && server.restaurants.length > 0 ? server.restaurants : rows;
  const effectiveCurrentId = server && server.restaurants.length > 0 ? server.currentRestaurantId : currentId;
  const effectiveDone = Boolean(server && server.restaurants.length > 0) || done;

  if (!effectiveDone) {
    return (
      <div
        className="h-10 w-44 animate-pulse rounded-xl bg-stone-200/80"
        aria-hidden
      />
    );
  }

  if (!effectiveRows?.length) return null;

  const current = effectiveRows.find((r) => r.id === effectiveCurrentId) ?? effectiveRows[0];
  const editHref = restaurantEditHref(current.id);

  if (effectiveRows.length === 1) {
    return (
      <Link
        href={editHref}
        className="flex max-w-[min(100vw-8rem,16rem)] items-center gap-2 truncate rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none ring-copper-600/0 transition hover:border-copper-200 hover:bg-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-copper-600"
        aria-label={`Infos établissement — ${current.name}`}
      >
        <Building2 className="h-4 w-4 shrink-0 text-copper-700" aria-hidden />
        <span className="truncate font-semibold text-stone-900">{current.name}</span>
      </Link>
    );
  }

  return (
    <div className="flex max-w-[min(100vw-10rem,20rem)] min-w-0 items-stretch overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-sm transition hover:border-copper-200 hover:bg-white">
      <Link
        href={editHref}
        className="flex min-w-0 flex-1 items-center gap-2 truncate px-3 py-2 text-sm outline-none ring-copper-600/0 transition hover:bg-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-copper-600"
        aria-label={`Infos établissement — ${current.name}`}
      >
        <Building2 className="h-4 w-4 shrink-0 text-copper-700" aria-hidden />
        <span className="truncate font-semibold text-stone-900">{current.name}</span>
      </Link>
      <form
        action={switchRestaurantAction}
        className="relative shrink-0 border-l border-stone-200"
      >
        <select
          name="restaurantId"
          defaultValue={effectiveCurrentId ?? current.id}
          onChange={(e) => {
            e.currentTarget.form?.requestSubmit();
          }}
          className="h-full min-h-[2.5rem] w-9 cursor-pointer appearance-none bg-transparent py-2 pl-1 pr-7 text-sm font-semibold text-stone-900 focus:border-copper-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-copper-600"
          aria-label="Changer d'établissement"
          suppressHydrationWarning
        >
          {effectiveRows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
          aria-hidden
        />
      </form>
    </div>
  );
}
