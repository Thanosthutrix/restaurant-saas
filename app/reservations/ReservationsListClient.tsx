"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, DoorOpen, Pencil, Plus, Users, X } from "lucide-react";
import { setReservationStatusAction } from "./actions";
import { ReservationArrivalModal } from "./ReservationArrivalModal";
import { ReservationsDayPlanner } from "./ReservationsDayPlanner";
import { NewReservationForm } from "./nouvelle/NewReservationForm";
import type { CustomerLookupRow } from "@/lib/customers/customersDb";
import type { DiningTableRow } from "@/lib/dining/diningDb";
import type { RestaurantReservationRow, ReservationStatus } from "@/lib/reservations/types";
import { uiBtnPrimary, uiError, uiInput, uiSuccess } from "@/components/ui/premium";
import { EmptyState } from "@/components/ui/EmptyState";

const STATUS: { v: ReservationStatus; label: string }[] = [
  { v: "pending", label: "En attente" },
  { v: "confirmed", label: "Confirmée" },
  { v: "seated", label: "Assis" },
  { v: "completed", label: "Terminée" },
  { v: "cancelled", label: "Annulée" },
  { v: "no_show", label: "No-show" },
];

const STATUS_STYLE: Record<ReservationStatus, { dot: string; chip: string; label: string }> = {
  pending: { dot: "bg-amber-400", chip: "bg-amber-50 text-amber-800", label: "En attente" },
  confirmed: { dot: "bg-sky-500", chip: "bg-sky-50 text-sky-800", label: "Confirmée" },
  seated: { dot: "bg-copper-600", chip: "bg-copper-50 text-copper-800", label: "Assis" },
  completed: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800", label: "Terminée" },
  cancelled: { dot: "bg-stone-400", chip: "bg-stone-100 text-stone-600", label: "Annulée" },
  no_show: { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700", label: "No-show" },
};

const TODAY_YMD = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

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
        <Link href={`/clients/${r.customer_id}`} className="font-medium text-copper-700 hover:underline">
          {r.customerDisplayName}
        </Link>
        {r.contact_name && r.contact_name !== r.customerDisplayName ? (
          <span className="text-stone-500"> — {r.contact_name}</span>
        ) : null}
      </span>
    );
  }
  return <span className="font-medium text-stone-900">{r.contact_name ?? "—"}</span>;
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
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!showNew) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNew(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [showNew]);

  const setDate = useCallback(
    (next: string) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("date", next);
      router.push(`${pathname}?${p.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const handleCreated = useCallback(
    ({ ymd: createdYmd, newCustomerId }: { ymd: string; newCustomerId?: string }) => {
      setShowNew(false);
      setOk(newCustomerId ? "Réservation enregistrée · fiche client créée." : "Réservation enregistrée.");
      if (createdYmd !== ymd) setDate(createdYmd);
      else router.refresh();
    },
    [ymd, setDate, router]
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

  const statusChips: { s: ReservationStatus; n: number }[] = (
    ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"] as ReservationStatus[]
  )
    .map((s) => ({ s, n: stats[s] }))
    .filter((x) => x.n > 0);

  return (
    <div className="space-y-3">
      {err ? <p className={uiError}>{err}</p> : null}
      {ok ? <p className={uiSuccess}>{ok}</p> : null}

      {/* Récap du jour — en tête */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-medium text-stone-500">Réservations</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-stone-900">{stats.total}</p>
        </div>
        <div className="border-l border-stone-100 pl-5">
          <p className="text-xs font-medium text-stone-500">Couverts</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-copper-800">{stats.covers}</p>
        </div>
        {statusChips.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {statusChips.map(({ s, n }) => (
              <span
                key={s}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[s].chip}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLE[s].dot}`} aria-hidden />
                {STATUS_STYLE[s].label} {n}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Barre d'outils : navigation date + bascule vue */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/70 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
            onClick={() => shiftDay(-1)}
            disabled={pending}
            aria-label="Jour précédent"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
            <input
              type="date"
              className={`${uiInput} h-10 pl-9`}
              value={ymd}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              disabled={pending}
            />
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
            onClick={() => shiftDay(1)}
            disabled={pending}
            aria-label="Jour suivant"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          {ymd !== TODAY_YMD ? (
            <button
              type="button"
              className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
              onClick={() => setDate(TODAY_YMD)}
              disabled={pending}
            >
              Aujourd’hui
            </button>
          ) : (
            <span className="hidden text-sm text-stone-500 sm:inline">{formatYmdFr(ymd)}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
            <button
              type="button"
              onClick={() => setView("plan")}
              className={`h-full rounded-lg px-3 text-sm font-semibold transition ${
                view === "plan" ? "bg-white text-copper-800 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Planning
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`h-full rounded-lg px-3 text-sm font-semibold transition ${
                view === "list" ? "bg-white text-copper-800 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Liste
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className={`${uiBtnPrimary} inline-flex h-10 items-center gap-1.5`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nouvelle
          </button>
        </div>
      </div>

      {/* Contenu */}
      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Aucune réservation ce jour"
          description="Aucune table réservée pour cette date. Créez une réservation depuis le téléphone, le comptoir ou le site."
          action={
            <button type="button" onClick={() => setShowNew(true)} className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}>
              <Plus className="h-4 w-4" aria-hidden />
              Nouvelle réservation
            </button>
          }
        />
      ) : view === "plan" ? (
        <div className="rounded-2xl border border-stone-200/70 bg-white p-3 shadow-sm sm:p-4">
          <ReservationsDayPlanner
            ymd={ymd}
            rows={rows}
            focusActive={plannerFocusActive}
            onFocusActiveChange={setPlannerFocusActive}
            pending={pending}
            onStatus={onStatus}
            onArrival={(r) => setArrivalReservation(r)}
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const contact = [r.contact_phone, r.contact_email].filter(Boolean).join(" · ");
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-stone-200/70 bg-white px-3.5 py-3 shadow-sm"
              >
                <div className="flex h-12 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
                  <span className="text-sm font-bold tabular-nums leading-none text-copper-800">
                    {timeParis(r.starts_at)}
                  </span>
                  <span className="mt-0.5 text-[10px] text-copper-700/80">{timeParis(r.ends_at)}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{displayGuest(r)}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1 font-medium text-stone-700">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {r.party_size} couvert{r.party_size > 1 ? "s" : ""}
                    </span>
                    {contact ? <span className="truncate">· {contact}</span> : null}
                  </div>
                  {r.notes ? (
                    <p className="mt-0.5 line-clamp-1 text-xs italic text-stone-400">{r.notes}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute left-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${STATUS_STYLE[r.status].dot}`}
                      aria-hidden
                    />
                    <select
                      className={`${uiInput} h-9 py-0 pl-6 text-xs`}
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
                  </div>

                  {canArrivalStatus(r.status) ? (
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-copper-200 bg-copper-50 px-3 text-xs font-semibold text-copper-800 transition hover:bg-copper-100 disabled:opacity-50"
                      disabled={pending}
                      onClick={() => setArrivalReservation(r)}
                    >
                      <DoorOpen className="h-4 w-4" aria-hidden />
                      Arrivée
                    </button>
                  ) : null}

                  <Link
                    href={`/reservations/${r.id}/modifier?date=${encodeURIComponent(ymd)}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                    aria-label="Modifier la réservation"
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

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

      {showNew ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Nouvelle réservation"
          onClick={() => setShowNew(false)}
        >
          <div
            className="my-6 w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center gap-3 border-b border-stone-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
                <CalendarCheck className="h-5 w-5 text-copper-700" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-stone-900">Nouvelle réservation</p>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto px-4 py-4">
              <NewReservationForm
                restaurantId={restaurantId}
                recentCustomerPool={recentCustomerPool}
                defaultYmd={ymd}
                onCreated={handleCreated}
                onCancel={() => setShowNew(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
