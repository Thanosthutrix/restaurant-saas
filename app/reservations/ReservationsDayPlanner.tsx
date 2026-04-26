"use client";

import Link from "next/link";
import type { RestaurantReservationRow, ReservationStatus } from "@/lib/reservations/types";
import { minutesSinceMidnightParis } from "@/lib/reservations/parisTime";
import { assignReservationLanes, clipInterval, type IntervalMin } from "@/lib/reservations/plannerLayout";
import { uiInput } from "@/components/ui/premium";

const FULL_DAY_START = 0;
const FULL_DAY_END = 24 * 60;
const PX_PER_H = 32;
const MIN_LANE_PX = 108;
const LANE_GUTTER_PX = 3;
/** Marge autour de la plage couverte par les résas (avant / après), en minutes. */
const VIEW_PAD_MIN = 45;
const MIN_VIEW_SPAN_MIN = 90;
const QUANT = 15;

const STATUS_BAR: Record<ReservationStatus, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-sky-500",
  seated: "bg-emerald-500",
  completed: "bg-slate-400",
  cancelled: "bg-rose-400",
  no_show: "bg-orange-500",
};

const STATUS_RING: Record<ReservationStatus, string> = {
  pending: "ring-amber-200",
  confirmed: "ring-sky-200",
  seated: "ring-emerald-200",
  completed: "ring-slate-200",
  cancelled: "ring-rose-200",
  no_show: "ring-orange-200",
};

const STATUS_BG: Record<ReservationStatus, string> = {
  pending: "bg-amber-50/95",
  confirmed: "bg-sky-50/95",
  seated: "bg-emerald-50/95",
  completed: "bg-slate-50",
  cancelled: "bg-rose-50/90",
  no_show: "bg-orange-50/90",
};

const STATUS: { v: ReservationStatus; label: string }[] = [
  { v: "pending", label: "En att." },
  { v: "confirmed", label: "Confirm." },
  { v: "seated", label: "Assis" },
  { v: "completed", label: "Termin." },
  { v: "cancelled", label: "Annul." },
  { v: "no_show", label: "No-show" },
];

type Row = RestaurantReservationRow & { customerDisplayName: string | null };

type Props = {
  ymd: string;
  rows: Row[];
  /** Masquer terminées / annulées (allège les gros services). */
  focusActive: boolean;
  onFocusActiveChange: (v: boolean) => void;
  pending: boolean;
  onStatus: (id: string, s: ReservationStatus) => void;
  /** Clic sur la carte : arrivée / ticket (sauf si statut terminal). */
  onArrival?: (r: Row) => void;
};

function who(r: Row) {
  if (r.customer_id && r.customerDisplayName) return r.customerDisplayName;
  return r.contact_name ?? "—";
}

function initials(n: string) {
  const p = n.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0]! + p[p.length - 1]![0]!).toUpperCase();
}

function timeParisShort(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationMin(startIso: string, endIso: string) {
  return Math.max(1, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));
}

function quantDown(m: number) {
  return Math.floor(m / QUANT) * QUANT;
}

function quantUp(m: number) {
  return Math.ceil(m / QUANT) * QUANT;
}

/** Libellé court pour une heure (minutes depuis minuit Paris). */
function labelClock(min: number) {
  const h = Math.floor(min / 60) % 24;
  const mm = min % 60;
  if (mm === 0) return `${h}h`;
  return new Date(2000, 0, 1, h, mm, 0).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function computeViewWindow(
  prepared: { a: number; b: number }[]
): { viewStart: number; viewEnd: number; label: string } {
  if (prepared.length === 0) {
    return {
      viewStart: FULL_DAY_START,
      viewEnd: FULL_DAY_END,
      label: "journée entière (aucune réservation affichable)",
    };
  }
  const minA = Math.min(...prepared.map((p) => p.a));
  const maxB = Math.max(...prepared.map((p) => p.b));
  let vs = Math.max(FULL_DAY_START, quantDown(minA - VIEW_PAD_MIN));
  let ve = Math.min(FULL_DAY_END, quantUp(maxB + VIEW_PAD_MIN));
  if (ve - vs < MIN_VIEW_SPAN_MIN) {
    const mid = (vs + ve) / 2;
    const half = MIN_VIEW_SPAN_MIN / 2;
    vs = Math.max(FULL_DAY_START, quantDown(mid - half));
    ve = Math.min(FULL_DAY_END, quantUp(mid + half));
  }
  if (ve <= vs) {
    vs = FULL_DAY_START;
    ve = FULL_DAY_END;
  }
  const t0 = labelClock(vs);
  const t1 = ve >= FULL_DAY_END ? "24h" : labelClock(ve);
  return { viewStart: vs, viewEnd: ve, label: `${t0} – ${t1} (Europe/Paris)` };
}

function canArrival(r: RestaurantReservationRow) {
  return r.status !== "completed" && r.status !== "cancelled" && r.status !== "no_show";
}

export function ReservationsDayPlanner({
  ymd,
  rows,
  focusActive,
  onFocusActiveChange,
  pending,
  onStatus,
  onArrival,
}: Props) {
  const visible = focusActive
    ? rows.filter((r) => r.status !== "completed" && r.status !== "cancelled")
    : rows;

  const prepared: (Row & { a: number; b: number; startMin: number; endMin: number })[] = [];
  let skippedClip = 0;
  for (const r of visible) {
    const t0 = minutesSinceMidnightParis(r.starts_at);
    const t1 = minutesSinceMidnightParis(r.ends_at);
    const clipped = clipInterval(t0, t1, FULL_DAY_START, FULL_DAY_END);
    if (!clipped) {
      skippedClip += 1;
      continue;
    }
    prepared.push({
      ...r,
      a: clipped.a,
      b: clipped.b,
      startMin: t0,
      endMin: t1,
    });
  }

  const { viewStart, viewEnd, label: windowLabel } = computeViewWindow(prepared);

  const hasBlocks = prepared.length > 0;

  const visualRows = prepared
    .map((p) => {
      const aV = Math.max(p.a, viewStart);
      const bV = Math.min(p.b, viewEnd);
      return { p, aV, bV };
    })
    .filter((x) => x.aV < x.bV);

  const intervals: IntervalMin[] = visualRows.map((x) => ({
    id: x.p.id,
    startMin: x.aV,
    endMin: x.bV,
  }));
  const { laneById, laneCount } = assignReservationLanes(intervals);
  const minCanvasW = Math.max(280, laneCount * MIN_LANE_PX + (laneCount - 1) * LANE_GUTTER_PX);
  const gapTotal = (laneCount - 1) * LANE_GUTTER_PX;
  const colLeft = (lane: number) =>
    `calc(${lane} * ((100% - ${gapTotal}px) / ${laneCount} + ${LANE_GUTTER_PX}px))`;
  const colW = `calc((100% - ${gapTotal}px) / ${laneCount})`;

  const viewSpanMin = viewEnd - viewStart;
  const totalH = hasBlocks
    ? Math.max(120, (viewSpanMin / 60) * PX_PER_H)
    : 140;
  const topY = (minSinceMid: number) => ((minSinceMid - viewStart) / 60) * PX_PER_H;

  /** Lignes de repère : heure entière en général, pas de 9 h « vides » vues — 15 min si plage &lt; 3 h. */
  const gridStep = hasBlocks && viewSpanMin <= 180 ? 15 : 60;
  const gridTickMins: { m: number; showLabel: boolean }[] = [];
  if (hasBlocks) {
    for (let t = Math.ceil(viewStart / gridStep) * gridStep; t < viewEnd; t += gridStep) {
      gridTickMins.push({
        m: t,
        showLabel: gridStep === 60 ? true : t % 60 === 0,
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={focusActive}
            onChange={(e) => onFocusActiveChange(e.target.checked)}
          />
          <span>Mettre en avant les réservations actives (masquer terminées &amp; annulées)</span>
        </label>
        <p className="text-xs text-slate-500">
          {prepared.length} sur {rows.length} affichée{prepared.length > 1 ? "s" : ""}
          {visualRows.length > 0 ? ` · ${windowLabel}` : ""}
          {laneCount > 1 ? ` · ${laneCount} colonnes` : ""}
        </p>
      </div>

      <div
        className="flex overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white shadow-inner"
        style={{ maxHeight: "min(78vh, 900px)" }}
      >
        <div
          className="sticky left-0 z-30 shrink-0 select-none border-r border-slate-200 bg-white/95 backdrop-blur-sm"
          style={{ width: 50, minHeight: totalH, position: "relative" }}
        >
          {gridTickMins.map(({ m, showLabel }) => (
            <div
              key={m}
              className="absolute right-0 pr-0.5 text-right"
              style={{ top: topY(m) - 1, transform: "translateY(-0.25em)" }}
            >
              {showLabel ? (
                <span className="text-[10px] font-semibold leading-none text-slate-600">
                  {m % 60 === 0 ? `${Math.floor(m / 60) % 24}h` : labelClock(m)}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-auto">
          <div
            className="relative"
            style={{ width: `max(100%, ${minCanvasW}px)`, minHeight: totalH, height: totalH }}
          >
            {gridTickMins.map(({ m }) => (
              <div
                key={`g-${m}`}
                className={`pointer-events-none absolute left-0 right-0 ${
                  m % 60 === 0 ? "border-b border-slate-200" : "border-b border-slate-100/60 border-dotted"
                }`}
                style={{ top: topY(m), height: 0 }}
              />
            ))}

            {prepared.length === 0 || visualRows.length === 0 ? (
                <p className="absolute left-1/2 top-1/2 z-20 max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-900">
                  {visible.length === 0
                    ? "Aucune réservation à afficher avec ce filtre. Décochez « actives seulement » ou changez de jour."
                    : "Aucun bloc ne rentre sur la tranche 0h–24h (durée nulle). Utilisez la vue liste."}
                </p>
              ) : null}

              {visualRows.map(({ p: r, aV, bV }) => {
                const dMin = Math.max(5, bV - aV);
                const top = topY(aV);
                const hPx = Math.max(44, (dMin / 60) * PX_PER_H - 1);
                const lane = laneById.get(r.id) ?? 0;
                const stBar = STATUS_BAR[r.status] ?? "bg-slate-400";
                const stBg = STATUS_BG[r.status] ?? "bg-white";
                const stRing = STATUS_RING[r.status] ?? "ring-slate-200";
                const label = who(r);
                const pax = r.party_size;
                const shortH = hPx < 64;

                const openArrival = onArrival && canArrival(r) ? () => onArrival(r) : undefined;

                return (
                  <div
                    key={r.id}
                    role={openArrival ? "button" : undefined}
                    tabIndex={openArrival ? 0 : undefined}
                    onClick={openArrival}
                    onKeyDown={
                      openArrival
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openArrival();
                            }
                          }
                        : undefined
                    }
                    className={`absolute box-border flex overflow-hidden rounded-xl shadow-md ring-1 ${stRing} ${stBg} ${
                      openArrival ? "cursor-pointer transition hover:brightness-[0.99]" : ""
                    }`}
                    style={{
                      top,
                      left: colLeft(lane),
                      width: colW,
                      minHeight: 44,
                      height: hPx,
                      zIndex: 5 + lane,
                    }}
                  >
                    <div className={`w-1 shrink-0 self-stretch ${stBar}`} title={r.status} />
                    <div className="min-w-0 flex-1 px-1.5 py-1">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex min-w-0 items-center gap-1.5" title={label}>
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${stBar}`}
                          >
                            {initials(label)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold leading-tight text-slate-900">
                              <Link
                                href={`/reservations/${r.id}/modifier?date=${encodeURIComponent(ymd)}`}
                                className="text-indigo-800 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {label}
                              </Link>
                            </p>
                            <p className="whitespace-nowrap text-[10px] font-medium text-slate-600">
                              {timeParisShort(r.starts_at)} – {timeParisShort(r.ends_at)} · {pax} pers.
                              {!shortH && r.notes ? " · " : null}
                              {!shortH && r.notes ? (
                                <span className="text-slate-500">
                                  {r.notes.length > 40 ? r.notes.slice(0, 40) + "…" : r.notes}
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </div>
                      {!shortH && (
                        <div className="mt-0.5 flex items-center gap-0.5">
                          <select
                            className={`${uiInput} w-full min-w-0 max-w-full py-0.5 text-[9px] leading-tight`}
                            value={r.status}
                            disabled={pending}
                            onChange={(e) => onStatus(r.id, e.target.value as ReservationStatus)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {STATUS.map((s) => (
                              <option key={s.v} value={s.v}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {shortH && (
                        <p className="mt-0.5 text-[9px] text-slate-500">
                          {durationMin(r.starts_at, r.ends_at)} min ·
                          <select
                            className="ml-0.5 max-w-[6rem] rounded border border-slate-200 bg-white py-0 text-[9px] align-middle"
                            value={r.status}
                            disabled={pending}
                            onChange={(e) => onStatus(r.id, e.target.value as ReservationStatus)}
                          >
                            {STATUS.map((s) => (
                              <option key={s.v} value={s.v}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
      {skippedClip > 0 ? (
        <p className="text-center text-xs text-amber-800">
          {skippedClip} réservation{skippedClip > 1 ? "s" : ""} non dessinée{skippedClip > 1 ? "s" : ""} (hors
          tranche 0h–24h Paris ou durée nulle). Voir la vue liste.
        </p>
      ) : null}
    </div>
  );
}
