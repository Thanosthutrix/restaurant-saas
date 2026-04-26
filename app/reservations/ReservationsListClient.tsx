"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { setReservationStatusAction } from "./actions";
import { ReservationArrivalModal } from "./ReservationArrivalModal";
import { ReservationsDayPlanner } from "./ReservationsDayPlanner";
import type { CustomerLookupRow } from "@/lib/customers/customersDb";
import type { DiningTableRow } from "@/lib/dining/diningDb";
import type { RestaurantReservationRow, ReservationStatus } from "@/lib/reservations/types";
import { uiCard, uiError, uiInput, uiSectionTitleSm, uiSuccess } from "@/components/ui/premium";

const STATUS: { v: ReservationStatus; label: string }[] = [
  { v: "pending", label: "En attente" },
  { v: "confirmed", label: "Confirmée" },
  { v: "seated", label: "Assis" },
  { v: "completed", label: "Terminée" },
  { v: "cancelled", label: "Annulée" },
  { v: "no_show", label: "No-show" },
];

type Row = RestaurantReservationRow & { customerDisplayName: string | null };

type Props = {
  restaurantId: string;
  ymd: string;
  rows: Row[];
  recentCustomerPool: CustomerLookupRow[];
  diningTables: DiningTableRow[];
};

function timeParis(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatYmdFr(ymd: string) {
  const [a, b, c] = ymd.split("-");
  if (!a) return ymd;
  return `${c}/${b}/${a}`;
}

function dayStats(rows: Row[]) {
  const total = rows.length;
  const covers = rows.reduce((sum, r) => sum + r.party_size, 0);
  const byStatus = (s: ReservationStatus) => rows.filter((r) => r.status === s).length;
  return {
    total,
    covers,
    pending: byStatus("pending"),
    confirmed: byStatus("confirmed"),
    seated: byStatus("seated"),
    completed: byStatus("completed"),
    cancelled: byStatus("cancelled"),
    no_show: byStatus("no_show"),
  };
}

function displayGuest(r: Row) {
  if (r.customer_id && r.customerDisplayName) {
    return (
      <span>
        <Link href={`/clients/${r.customer_id}`} className="font-medium text-indigo-600 hover:underline">
          {r.customerDisplayName}
        </Link>
        {r.contact_name && r.contact_name !== r.customerDisplayName ? (
          <span className="text-slate-500"> — {r.contact_name}</span>
        ) : null}
      </span>
    );
  }
  return <span className="font-medium text-slate-900">{r.contact_name ?? "—"}</span>;
}

function canArrivalStatus(s: Row["status"]) {
  return s !== "completed" && s !== "cancelled" && s !== "no_show";
}

export function ReservationsListClient({ restaurantId, ymd, rows, recentCustomerPool, diningTables }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [view, setView] = useState<"plan" | "list">("plan");
  const [plannerFocusActive, setPlannerFocusActive] = useState(false);
  const [arrivalReservation, setArrivalReservation] = useState<Row | null>(null);

  const setDate = useCallback(
    (next: string) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("date", next);
      router.push(`${pathname}?${p.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const shiftDay = (delta: number) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const t = new Date(y, m - 1, d);
    t.setDate(t.getDate() + delta);
    const y2 = t.getFullYear();
    const m2 = String(t.getMonth() + 1).padStart(2, "0");
    const d2 = String(t.getDate()).padStart(2, "0");
    setDate(`${y2}-${m2}-${d2}`);
  };

  const stats = dayStats(rows);

  function onStatus(id: string, status: ReservationStatus) {
    setErr(null);
    setOk(null);
    start(async () => {
      const r = await setReservationStatusAction({ restaurantId, reservationId: id, status });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setOk("Statut enregistré.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {err ? <p className={uiError}>{err}</p> : null}
      {ok ? <p className={uiSuccess}>{ok}</p> : null}

      <div className={`${uiCard} overflow-hidden`}>
        <div className="border-b border-slate-100 pb-4">
          <h2 className={`${uiSectionTitleSm} mb-3`}>Journée</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                onClick={() => shiftDay(-1)}
                disabled={pending}
              >
                ← Veille
              </button>
              <input
                type="date"
                className={uiInput + " py-1.5 text-sm"}
                value={ymd}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                disabled={pending}
              />
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                onClick={() => shiftDay(1)}
                disabled={pending}
              >
                Lendemain →
              </button>
            </div>
            <p className="text-sm text-slate-600">
              {formatYmdFr(ymd)} <span className="text-slate-400">(Europe/Paris)</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Fiches récentes : {recentCustomerPool.length} proposées sur «{" "}
            <Link href="/reservations/nouvelle" className="text-indigo-600 underline">
              Nouvelle réservation
            </Link>
            ».
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-3">
          <span className="text-xs font-medium text-slate-500">Affichage :</span>
          <button
            type="button"
            onClick={() => setView("plan")}
            className={`rounded-lg px-2.5 py-1 text-sm font-medium ${
              view === "plan" ? "bg-indigo-100 text-indigo-900" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Planning
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-lg px-2.5 py-1 text-sm font-medium ${
              view === "list" ? "bg-indigo-100 text-indigo-900" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Liste
          </button>
          <p className="w-full text-[11px] text-slate-500 sm:ml-2 sm:w-auto">
            Planning : tranche horaire seulement là où il y a des réservations (Paris), colonnes si chevauchement.
          </p>
        </div>

        <div className="pt-4">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aucune réservation ce jour.{" "}
              <Link href="/reservations/nouvelle" className="font-medium text-indigo-600 underline">
                Créer une réservation
              </Link>
            </p>
          ) : view === "plan" ? (
            <ReservationsDayPlanner
              ymd={ymd}
              rows={rows}
              focusActive={plannerFocusActive}
              onFocusActiveChange={setPlannerFocusActive}
              pending={pending}
              onStatus={onStatus}
              onArrival={(r) => setArrivalReservation(r)}
            />
          ) : null}

          {rows.length > 0 && view === "list" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2">Heure</th>
                    <th className="py-2 pr-2">Couverts</th>
                    <th className="py-2 pr-2">Client</th>
                    <th className="py-2 pr-2">Contact</th>
                <th className="py-2 pr-2">Statut</th>
                <th className="py-2 pr-2">Note</th>
                <th className="py-2 pr-2">Salle</th>
                <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap py-2 pr-2 font-medium tabular-nums text-slate-900">
                        {timeParis(r.starts_at)} – {timeParis(r.ends_at)}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{r.party_size}</td>
                      <td className="py-2 pr-2">{displayGuest(r)}</td>
                      <td className="max-w-[180px] py-2 pr-2 text-slate-600">
                        <span className="line-clamp-2 break-words text-xs">
                          {[r.contact_phone, r.contact_email].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          className={`${uiInput} max-w-full py-1.5 text-xs`}
                          value={r.status}
                          disabled={pending}
                          onChange={(e) => onStatus(r.id, e.target.value as ReservationStatus)}
                          title="Statut de la réservation"
                        >
                          {STATUS.map((s) => (
                            <option key={s.v} value={s.v}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                  <td className="max-w-[200px] py-2 text-xs text-slate-500">
                    {r.notes ? <span className="line-clamp-2 whitespace-pre-wrap">{r.notes}</span> : "—"}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2">
                    {canArrivalStatus(r.status) ? (
                      <button
                        type="button"
                        className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100"
                        disabled={pending}
                        onClick={() => setArrivalReservation(r)}
                      >
                        Arrivée
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 text-right">
                    <Link
                      href={`/reservations/${r.id}/modifier?date=${encodeURIComponent(ymd)}`}
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      Modifier
                    </Link>
                  </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="mt-4 border-t border-slate-100 bg-slate-50/80 px-1 py-3 sm:px-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Récap du jour</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <p className="text-sm text-slate-800">
              <span className="text-2xl font-bold tabular-nums text-slate-900">{stats.total}</span>{" "}
              réservation{stats.total > 1 ? "s" : ""}
              <span className="mx-2 text-slate-300">·</span>
              <span className="text-2xl font-bold tabular-nums text-indigo-800">{stats.covers}</span> couverts
            </p>
            {stats.total > 0 ? (
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                {stats.pending > 0 ? <li>Att. {stats.pending}</li> : null}
                {stats.confirmed > 0 ? <li>Conf. {stats.confirmed}</li> : null}
                {stats.seated > 0 ? <li>Assis {stats.seated}</li> : null}
                {stats.completed > 0 ? <li>Term. {stats.completed}</li> : null}
                {stats.cancelled > 0 ? <li>Annul. {stats.cancelled}</li> : null}
                {stats.no_show > 0 ? <li>No-show {stats.no_show}</li> : null}
              </ul>
            ) : null}
          </div>
          {rows.length > 0 ? (
            <p className="mt-2 text-center text-xs text-slate-500">
              <Link href="/reservations/nouvelle" className="text-indigo-600 underline">
                Nouvelle réservation
              </Link>
              {view === "plan" ? " · basculer en « Liste » pour le tableau." : " · basculer en « Planning » pour la grille."}
            </p>
          ) : null}
        </div>
      </div>

      {arrivalReservation ? (
        <ReservationArrivalModal
          key={arrivalReservation.id}
          restaurantId={restaurantId}
          ymd={ymd}
          reservation={arrivalReservation}
          tables={diningTables}
          onClose={() => setArrivalReservation(null)}
        />
      ) : null}
    </div>
  );
}
