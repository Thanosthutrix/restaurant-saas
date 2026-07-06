"use client";

import { CalendarDays, Clock, Users } from "lucide-react";

export type QuickBookingState = {
  date: string;
  time: string;
  guests: number;
};

type Props = {
  value: QuickBookingState;
  onChange: (value: QuickBookingState) => void;
};

export function BookingQuickWidget({ value, onChange }: Props) {
  return (
    <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-4 shadow-lg shadow-orange-500/10 sm:p-5">
      <p className="text-sm font-bold uppercase tracking-wide text-orange-700">
        Réservation rapide
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Date
          </span>
          <input
            type="date"
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Heure
          </span>
          <input
            type="time"
            value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Convives
          </span>
          <select
            value={value.guests}
            onChange={(e) => onChange({ ...value, guests: Number(e.target.value) })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} personne{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
