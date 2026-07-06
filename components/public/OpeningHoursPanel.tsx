"use client";

import { Clock } from "lucide-react";
import {
  formatOpeningHoursBandLabel,
  getTodayPlanningDayKey,
  isOpenAt,
} from "@/lib/public/formatOpeningHours";
import type { Restaurant } from "@/lib/public/types";

type Props = {
  restaurant: Restaurant;
};

export function OpeningHoursPanel({ restaurant }: Props) {
  const schedule = restaurant.opening_hours_schedule;
  const todayKey = getTodayPlanningDayKey();
  const isOpen = schedule ? isOpenAt(schedule) : false;
  const hasSchedule = schedule?.some((day) => !day.isClosed) ?? false;

  if (!hasSchedule) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Clock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-bold text-slate-900">Horaires d&apos;ouverture</h3>
              <p className="text-xs text-slate-500">Synchronisés depuis le planning ERP</p>
            </div>
          </div>
        </div>
        <p className="px-5 py-6 text-sm text-slate-500">
          {restaurant.opening_hours ?? "Horaires non renseignés"}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Clock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-bold text-slate-900">Horaires d&apos;ouverture</h3>
              <p className="text-xs text-slate-500">Synchronisés depuis le planning ERP</p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
              isOpen
                ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {isOpen ? "Ouvert" : "Fermé"}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {schedule!.map((day) => {
          const isToday = day.key === todayKey;
          return (
            <li
              key={day.key}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 transition ${
                isToday ? "bg-orange-50/80" : "hover:bg-slate-50/60"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    isToday
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {day.label}
                </span>
                <span
                  className={`text-sm font-medium ${isToday ? "text-slate-900" : "text-slate-700"}`}
                >
                  {day.fullLabel}
                  {isToday ? (
                    <span className="ml-2 text-xs font-semibold text-orange-600">Aujourd&apos;hui</span>
                  ) : null}
                </span>
              </div>
              <div className="text-right">
                {day.isClosed ? (
                  <span className="text-sm font-medium text-slate-400">Fermé</span>
                ) : (
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2">
                    {day.bands.map((band, i) => (
                      <span
                        key={`${day.key}-${i}`}
                        className={`inline-block rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${
                          isToday
                            ? "bg-white text-slate-800 ring-1 ring-orange-200"
                            : "text-slate-600"
                        }`}
                      >
                        {formatOpeningHoursBandLabel(band)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
