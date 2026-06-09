"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus, Sparkles, Trash2, X } from "lucide-react";
import { applyPlanningDraftBriefAndGenerateAction } from "@/app/equipe/actions";
import {
  buildBriefPayload,
  buildInitialDraftDays,
  computeBriefWarnings,
  effectiveStaffTarget,
  intensityLabelFr,
  suggestStaffTargetFromDay,
  initialMaxDailyHoursFields,
  parseMaxDailyHoursFromWizard,
  parseWeeklyHoursBonusFromWizard,
  resolvePeakBandsForDay,
  type DraftDayIntensity,
  type DraftPeakBandRow,
  type PlanningDraftDayRow,
} from "@/lib/staff/planningDraftBrief";
import type { PeakBandsWeeklyMap } from "@/lib/staff/planningPeakBands";
import type { PlanningDayOverrideRow, WeekResolvedDay } from "@/lib/staff/planningResolve";
import type { StaffMember } from "@/lib/staff/types";
import {
  uiBtnOutlineSm,
  uiBtnPrimary,
  uiBtnPrimarySm,
  uiInput,
  uiLabel,
} from "@/components/ui/premium";

const STEPS = [
  { id: "context", title: "Contexte", subtitle: "Semaine et paramètres existants" },
  { id: "needs", title: "Besoins", subtitle: "Effectifs et exceptions par jour" },
  { id: "peaks", title: "Pointe", subtitle: "Plages où renforcer l’effectif" },
  { id: "team", title: "Équipe", subtitle: "Heures sup., absences et options" },
  { id: "review", title: "Validation", subtitle: "Résumé avant génération" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  weekMondayIso: string;
  weekLabel: string;
  staff: StaffMember[];
  resolvedWeekDays: WeekResolvedDay[];
  planningDayOverrides: PlanningDayOverrideRow[];
  planningPeakBandsWeekly: PeakBandsWeeklyMap;
  hasExistingDraft: boolean;
  onGenerated: (result: {
    generatedCount: number;
    summaryFr: string | null;
  }) => void;
};

const INTENSITY_OPTIONS: DraftDayIntensity[] = ["quiet", "normal", "busy", "event"];

export function PlanningDraftWizard({
  open,
  onClose,
  restaurantId,
  weekMondayIso,
  weekLabel,
  staff,
  resolvedWeekDays,
  planningDayOverrides,
  planningPeakBandsWeekly,
  hasExistingDraft,
  onGenerated,
}: Props) {
  const [pending, start] = useTransition();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [days, setDays] = useState<PlanningDraftDayRow[]>(() =>
    buildInitialDraftDays(resolvedWeekDays, planningDayOverrides, planningPeakBandsWeekly)
  );
  const [unavailableStaffIds, setUnavailableStaffIds] = useState<Set<string>>(() => new Set());
  const [updateWeeklyTargets, setUpdateWeeklyTargets] = useState(true);
  const [prioritizeRoleBalance, setPrioritizeRoleBalance] = useState(true);
  const [allowOvertime, setAllowOvertime] = useState(false);
  const [overtimePercent, setOvertimePercent] = useState(20);
  const [overtimeStaffIds, setOvertimeStaffIds] = useState<Set<string>>(
    () => new Set(staff.filter((s) => s.active && s.target_weekly_hours != null).map((s) => s.id))
  );
  const [applyCarryover, setApplyCarryover] = useState(true);
  const [maxDailyHoursByStaff, setMaxDailyHoursByStaff] = useState<Record<string, string>>(() =>
    initialMaxDailyHoursFields(staff)
  );
  const [persistMaxDailyHours, setPersistMaxDailyHours] = useState(false);
  const [weeklyBonusByStaff, setWeeklyBonusByStaff] = useState<Record<string, string>>({});

  const step = STEPS[stepIndex]!;
  const activeStaff = useMemo(() => staff.filter((s) => s.active), [staff]);
  const availableCount = activeStaff.filter((s) => !unavailableStaffIds.has(s.id)).length;

  const warnings = useMemo(
    () => computeBriefWarnings(days, staff, [...unavailableStaffIds]),
    [days, staff, unavailableStaffIds]
  );

  const resolvedByYmd = useMemo(() => new Map(resolvedWeekDays.map((d) => [d.ymd, d])), [resolvedWeekDays]);

  const hasRestaurantPeakModel = useMemo(
    () => Object.values(planningPeakBandsWeekly).some((bands) => (bands?.length ?? 0) > 0),
    [planningPeakBandsWeekly]
  );

  function resolvePeaksForDay(
    wd: WeekResolvedDay,
    staffTarget: number | null,
    isClosed: boolean
  ): DraftPeakBandRow[] {
    return resolvePeakBandsForDay(wd, staffTarget, isClosed, planningPeakBandsWeekly);
  }

  function patchDay(ymd: string, patch: Partial<PlanningDraftDayRow>) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.ymd !== ymd) return d;
        const next = { ...d, ...patch };
        if ("staffTarget" in patch && !next.isClosed) {
          const wd = resolvedByYmd.get(ymd);
          if (wd) {
            const target =
              next.staffTarget.trim() === "" ? null : Number(next.staffTarget.replace(",", "."));
            next.peakBands = resolvePeaksForDay(wd, target, next.isClosed);
          }
        }
        return next;
      })
    );
  }

  function applySuggestions() {
    setDays((prev) =>
      prev.map((d) => {
        const wd = resolvedByYmd.get(d.ymd);
        let next = { ...d };
        if (!d.isClosed && d.staffTarget.trim() === "" && wd) {
          const suggested = suggestStaffTargetFromDay(wd);
          if (suggested != null) next = { ...next, staffTarget: String(suggested) };
        }
        if (!d.isClosed && wd) {
          const target =
            next.staffTarget.trim() === "" ? null : Number(next.staffTarget.replace(",", "."));
          next.peakBands = resolvePeaksForDay(wd, target, d.isClosed);
        }
        return next;
      })
    );
  }

  function refillPeakBands() {
    setDays((prev) =>
      prev.map((d) => {
        if (d.isClosed) return { ...d, peakBands: [] };
        const wd = resolvedByYmd.get(d.ymd);
        if (!wd) return d;
        const target = d.staffTarget.trim() === "" ? null : Number(d.staffTarget.replace(",", "."));
        return { ...d, peakBands: resolvePeaksForDay(wd, target, false) };
      })
    );
  }

  function patchPeak(ymd: string, index: number, patch: Partial<DraftPeakBandRow>) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.ymd !== ymd) return d;
        const peakBands = d.peakBands.map((p, i) => (i === index ? { ...p, ...patch } : p));
        return { ...d, peakBands };
      })
    );
  }

  function addPeak(ymd: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.ymd !== ymd) return d;
        return {
          ...d,
          peakBands: [...d.peakBands, { start: "12:00", end: "14:00", staffCount: d.staffTarget || "2" }],
        };
      })
    );
  }

  function removePeak(ymd: string, index: number) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.ymd !== ymd) return d;
        return { ...d, peakBands: d.peakBands.filter((_, i) => i !== index) };
      })
    );
  }

  function toggleOvertimeStaff(staffId: string) {
    setOvertimeStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  }

  function toggleUnavailable(staffId: string) {
    setUnavailableStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  }

  function goNext() {
    setError(null);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function submit() {
    if (hasExistingDraft && !confirm("Remplacer tous les créneaux du brouillon par une nouvelle ébauche ?")) {
      return;
    }
    setError(null);
    const payload = buildBriefPayload(
      weekMondayIso,
      days,
      updateWeeklyTargets,
      [...unavailableStaffIds],
      prioritizeRoleBalance,
      {
        enabled: allowOvertime,
        maxOvertimePercent: overtimePercent,
        staffIds: [...overtimeStaffIds],
      },
      allowOvertime && applyCarryover,
      parseMaxDailyHoursFromWizard(staff, maxDailyHoursByStaff),
      parseWeeklyHoursBonusFromWizard(weeklyBonusByStaff)
    );
    start(async () => {
      const r = await applyPlanningDraftBriefAndGenerateAction(restaurantId, payload, {
        persistMaxDailyHours,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onGenerated({ generatedCount: r.generatedCount, summaryFr: r.summaryFr });
      onClose();
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Fermer"
        onClick={() => !pending && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="planning-draft-wizard-title"
        className="relative flex max-h-[min(92vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Ébauche de planning</p>
            <h2 id="planning-draft-wizard-title" className="mt-1 text-lg font-semibold text-slate-900">
              {step.title}
            </h2>
            <p className="text-sm text-slate-500">{step.subtitle}</p>
          </div>
          <button
            type="button"
            disabled={pending}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <nav
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 px-4 py-3 sm:px-6"
          aria-label="Étapes du questionnaire"
        >
          {STEPS.map((s, i) => {
            const isCurrent = i === stepIndex;
            const isDone = i < stepIndex;
            return (
              <button
                key={s.id}
                type="button"
                disabled={pending || i > stepIndex}
                title={s.subtitle}
                onClick={() => {
                  if (i <= stepIndex) setStepIndex(i);
                }}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center transition sm:px-2 ${
                  isCurrent
                    ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                    : isDone
                      ? "text-indigo-600 hover:bg-indigo-50/60"
                      : "cursor-default text-slate-400"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? "bg-indigo-600 text-white"
                      : isDone
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="truncate text-[10px] font-semibold leading-tight sm:text-xs">{s.title}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          {step.id === "context" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-sm font-medium text-slate-900">{weekLabel}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Semaine du {weekMondayIso} · {activeStaff.length} collaborateur
                  {activeStaff.length > 1 ? "s" : ""} actif{activeStaff.length > 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-sm text-slate-600">
                Ce questionnaire reprend vos horaires, objectifs et exceptions déjà enregistrés. Vérifiez et ajustez
                les besoins <strong>pour cette semaine</strong>, puis les <strong>plages de pointe</strong> (midi,
                rush du soir…) avant de lancer la génération automatique.
              </p>
              <p className="text-xs text-slate-500">
                Modèle complet :{" "}
                <Link
                  href={`/restaurants/${restaurantId}/edit`}
                  className="font-medium text-indigo-700 underline"
                  target="_blank"
                >
                  Infos établissement → planning
                </Link>
              </p>
              {warnings.length > 0 ? (
                <ul className="space-y-2">
                  {warnings.map((w, i) => (
                    <li
                      key={i}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        w.level === "warn"
                          ? "border border-amber-200 bg-amber-50 text-amber-900"
                          : "border border-slate-100 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {w.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Configuration cohérente — passez à l’étape suivante pour affiner les effectifs.
                </p>
              )}
            </div>
          )}

          {step.id === "needs" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">
                  Indiquez combien de personnes vous souhaitez par jour. L’intensité ajuste l’effectif utilisé pour
                  l’ébauche (+1 fort, +2 événement, −1 calme).
                </p>
                <button type="button" className={uiBtnOutlineSm} onClick={applySuggestions}>
                  <Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                  Suggérer les effectifs
                </button>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2.5 text-sm text-indigo-900">
                <strong>Étape suivante — Pointe :</strong> vous pourrez définir les créneaux où renforcer l’effectif
                (ex. 12h–14h avec 4 personnes, 19h–22h avec 5 personnes). Les plages sont préremplies d’après vos
                horaires d’ouverture.
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-2 py-2">Jour</th>
                      <th className="px-2 py-2">Horaires</th>
                      <th className="px-2 py-2">Pers.</th>
                      <th className="px-2 py-2">Intensité</th>
                      <th className="px-2 py-2">Fermé</th>
                      <th className="px-2 py-2">Note / exception</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {days.map((d) => {
                      const base = d.staffTarget.trim() === "" ? null : Number(d.staffTarget.replace(",", "."));
                      const eff = effectiveStaffTarget(base, d.intensity, d.isClosed);
                      return (
                        <tr key={d.ymd} className={d.isClosed ? "bg-slate-50/80" : undefined}>
                          <td className="px-2 py-2">
                            <span className="font-medium capitalize text-slate-900">{d.dateLabel}</span>
                            {d.exceptionLabel ? (
                              <span className="mt-0.5 block text-[10px] text-indigo-600">{d.exceptionLabel}</span>
                            ) : null}
                            {d.calendarSource === "public_holiday" ? (
                              <span className="mt-0.5 inline-block rounded bg-indigo-100 px-1 text-[10px] text-indigo-800">
                                Férié
                              </span>
                            ) : null}
                            {d.calendarSource === "school_vacation" ? (
                              <span className="mt-0.5 inline-block rounded bg-sky-100 px-1 text-[10px] text-sky-800">
                                Vacances
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 text-xs text-slate-600">{d.openingLabel}</td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              max={200}
                              step={1}
                              disabled={d.isClosed || pending}
                              className={`${uiInput} w-16 text-sm`}
                              value={d.staffTarget}
                              onChange={(e) => patchDay(d.ymd, { staffTarget: e.target.value })}
                              placeholder="—"
                            />
                            {!d.isClosed && eff != null ? (
                              <span className="mt-0.5 block text-[10px] text-slate-500">→ {eff} en ébauche</span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2">
                            <select
                              disabled={d.isClosed || pending}
                              className={`${uiInput} text-xs`}
                              value={d.intensity}
                              onChange={(e) =>
                                patchDay(d.ymd, { intensity: e.target.value as DraftDayIntensity })
                              }
                            >
                              {INTENSITY_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {intensityLabelFr(opt)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              disabled={pending}
                              checked={d.isClosed}
                              onChange={(e) => patchDay(d.ymd, { isClosed: e.target.checked })}
                              aria-label={`Fermé le ${d.dateLabel}`}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              disabled={pending}
                              className={`${uiInput} min-w-[8rem] text-xs`}
                              placeholder="Ex. mariage, inventaire…"
                              value={d.customLabel}
                              onChange={(e) => patchDay(d.ymd, { customLabel: e.target.value })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step.id === "peaks" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900">
                <strong>Plages de pointe</strong> — effectif minimum <strong>simultané</strong> sur le créneau (souvent
                supérieur à l’effectif de base). Chaque shift couvre le <strong>service entier</strong> (ex. 19h→23h),
                pas seulement la fenêtre rush ; les renforts s’ajoutent ensuite.
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">
                  Indiquez les créneaux où il faut <strong>le plus de monde</strong> (service midi, rush du soir…).
                  L’ébauche renforcera ces plages si l’effectif planifié est insuffisant.
                </p>
                <button type="button" className={uiBtnOutlineSm} onClick={refillPeakBands}>
                  {hasRestaurantPeakModel ? "Reprendre le modèle établissement" : "Reprise automatique (services)"}
                </button>
              </div>
              {hasRestaurantPeakModel ? (
                <p className="text-xs text-slate-500">
                  Prérempli depuis les{" "}
                  <Link href={`/restaurants/${restaurantId}/edit`} className="font-medium text-indigo-700 underline">
                    plages de pointe du restaurant
                  </Link>
                  . Vous pouvez les ajuster ici pour cette semaine uniquement.
                </p>
              ) : null}

              {days.filter((d) => !d.isClosed).length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Tous les jours sont marqués fermés — aucune plage de pointe à configurer. Revenez à l’étape Besoins
                  pour rouvrir des jours si besoin.
                </p>
              ) : null}

              <div className="space-y-4">
                {days.filter((d) => !d.isClosed).map((d) => (
                  <div key={d.ymd} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold capitalize text-slate-900">{d.dateLabel}</p>
                      <p className="text-xs text-slate-500">{d.openingLabel}</p>
                    </div>
                    {d.peakBands.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">Aucune plage de pointe.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {d.peakBands.map((p, i) => (
                          <li key={i} className="flex flex-wrap items-center gap-2">
                            <input
                              type="time"
                              disabled={pending}
                              className={`${uiInput} w-[7rem] text-xs`}
                              value={p.start}
                              onChange={(e) => patchPeak(d.ymd, i, { start: e.target.value })}
                            />
                            <span className="text-slate-400">→</span>
                            <input
                              type="time"
                              disabled={pending}
                              className={`${uiInput} w-[7rem] text-xs`}
                              value={p.end}
                              onChange={(e) => patchPeak(d.ymd, i, { end: e.target.value })}
                            />
                            <input
                              type="number"
                              min={1}
                              max={200}
                              disabled={pending}
                              className={`${uiInput} w-16 text-xs`}
                              value={p.staffCount}
                              onChange={(e) => patchPeak(d.ymd, i, { staffCount: e.target.value })}
                              title="Effectif minimum sur cette plage"
                            />
                            <span className="text-xs text-slate-500">pers.</span>
                            <button
                              type="button"
                              disabled={pending}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Supprimer la plage"
                              onClick={() => removePeak(d.ymd, i)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      className={`${uiBtnOutlineSm} mt-2`}
                      onClick={() => addPeak(d.ymd)}
                    >
                      <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                      Plage de pointe
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step.id === "team" && (
            <div className="space-y-5">
              <div className="space-y-3 rounded-xl border-2 border-amber-200 bg-amber-50/60 p-4">
                <p className={uiLabel}>Volume horaire cette semaine</p>
                <p className="text-xs text-slate-600">
                  Augmentez le budget d’heures planifiables par personne pour une semaine chargée. Les heures
                  supplémentaires peuvent être compensées sur des semaines plus calmes via le solde d’heures.
                </p>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={allowOvertime}
                    disabled={pending}
                    onChange={(e) => setAllowOvertime(e.target.checked)}
                  />
                  <span className="text-sm text-slate-800">
                    Autoriser aussi un <strong>dépassement en % du contrat</strong> (en plus des heures saisies
                    ci-dessous)
                  </span>
                </label>
                {allowOvertime ? (
                  <div className="ml-7">
                    <label className={uiLabel} htmlFor="overtime-pct">
                      Dépassement max. (% du contrat)
                    </label>
                    <select
                      id="overtime-pct"
                      disabled={pending}
                      className={`${uiInput} mt-1 max-w-xs text-sm`}
                      value={overtimePercent}
                      onChange={(e) => setOvertimePercent(Number(e.target.value))}
                    >
                      <option value={10}>+10 %</option>
                      <option value={20}>+20 %</option>
                      <option value={30}>+30 %</option>
                      <option value={50}>+50 %</option>
                    </select>
                  </div>
                ) : null}
                <div className="mt-2 overflow-x-auto rounded-lg border border-amber-100 bg-white">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="px-3 py-2">Collaborateur</th>
                        <th className="px-3 py-2">Contrat</th>
                        <th className="px-3 py-2">+ h cette semaine</th>
                        {allowOvertime ? <th className="px-3 py-2">% contrat</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeStaff.map((m) => (
                        <tr key={m.id} className={unavailableStaffIds.has(m.id) ? "opacity-50" : undefined}>
                          <td className="px-3 py-2 font-medium text-slate-900">{m.display_name}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {m.target_weekly_hours != null ? (
                              <>
                                {m.target_weekly_hours} h
                                {m.planning_carryover_minutes !== 0 ? (
                                  <span className="ml-1 text-xs text-slate-400">
                                    (solde {(m.planning_carryover_minutes / 60).toFixed(1)} h)
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-xs text-amber-700">Contrat non renseigné</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={40}
                              step={0.5}
                              disabled={pending || unavailableStaffIds.has(m.id)}
                              className={`${uiInput} w-24 text-sm`}
                              value={weeklyBonusByStaff[m.id] ?? ""}
                              onChange={(e) =>
                                setWeeklyBonusByStaff((prev) => ({ ...prev, [m.id]: e.target.value }))
                              }
                              placeholder="0"
                              aria-label={`Heures supplémentaires pour ${m.display_name}`}
                            />
                          </td>
                          {allowOvertime ? (
                            <td className="px-3 py-2">
                              <label className="flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={overtimeStaffIds.has(m.id)}
                                  disabled={pending || unavailableStaffIds.has(m.id) || m.target_weekly_hours == null}
                                  onChange={() => toggleOvertimeStaff(m.id)}
                                />
                                <span className="text-xs text-slate-600">
                                  {m.target_weekly_hours != null ? `+${overtimePercent} %` : "—"}
                                </span>
                              </label>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {allowOvertime ? (
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={applyCarryover}
                      disabled={pending}
                      onChange={(e) => setApplyCarryover(e.target.checked)}
                    />
                    <span className="text-sm text-slate-700">
                      Mettre à jour les <strong>soldes d’heures</strong> après génération (écart contrat vs prévu).
                    </span>
                  </label>
                ) : null}
              </div>

              <div>
                <p className={uiLabel}>Absences ou indisponibilités cette semaine</p>
                <p className="mt-1 text-xs text-slate-500">
                  Cochez les personnes à exclure de l’ébauche (congés, arrêt, etc.).
                </p>
                <ul className="mt-3 space-y-2">
                  {activeStaff.length === 0 ? (
                    <li className="text-sm text-slate-500">Aucun collaborateur actif.</li>
                  ) : (
                    activeStaff.map((m) => (
                      <li key={m.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={unavailableStaffIds.has(m.id)}
                            disabled={pending}
                            onChange={() => toggleUnavailable(m.id)}
                          />
                          <span className="flex-1 text-sm">
                            <span className="font-medium text-slate-900">{m.display_name}</span>
                            {m.role_label ? (
                              <span className="ml-2 text-xs text-slate-500">{m.role_label}</span>
                            ) : null}
                            {m.target_weekly_hours != null ? (
                              <span className="ml-2 text-xs text-slate-400">{m.target_weekly_hours} h/sem.</span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    ))
                  )}
                </ul>
                <p className="mt-2 text-xs font-medium text-slate-600">
                  {availableCount} personne{availableCount > 1 ? "s" : ""} disponible
                  {availableCount > 1 ? "s" : ""} pour l’ébauche.
                </p>
              </div>

              <div>
                <p className={uiLabel}>Plafond d’heures par jour</p>
                <p className="mt-1 text-xs text-slate-500">
                  Nombre maximum d’heures nettes planifiables par journée pour chaque personne (vide = pas de limite
                  pour l’ébauche).
                </p>
                <ul className="mt-3 space-y-2">
                  {activeStaff.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 px-3 py-2"
                    >
                      <span className="min-w-[8rem] flex-1 text-sm font-medium text-slate-900">
                        {m.display_name}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={16}
                        step={0.5}
                        disabled={pending || unavailableStaffIds.has(m.id)}
                        className={`${uiInput} w-24 text-sm`}
                        value={maxDailyHoursByStaff[m.id] ?? ""}
                        onChange={(e) =>
                          setMaxDailyHoursByStaff((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        placeholder="—"
                        aria-label={`Max heures par jour pour ${m.display_name}`}
                      />
                      <span className="text-xs text-slate-500">h / jour max</span>
                    </li>
                  ))}
                </ul>
                <label className="mt-3 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={persistMaxDailyHours}
                    disabled={pending}
                    onChange={(e) => setPersistMaxDailyHours(e.target.checked)}
                  />
                  <span className="text-sm text-slate-700">
                    Enregistrer ces plafonds sur les fiches collaborateurs (profil planning).
                  </span>
                </label>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={updateWeeklyTargets}
                    disabled={pending}
                    onChange={(e) => setUpdateWeeklyTargets(e.target.checked)}
                  />
                  <span className="text-sm text-slate-700">
                    <strong>Mettre à jour le modèle hebdomadaire</strong> avec les effectifs saisis pour les jours
                    « normaux » (les jours en exception calendrier ou horaires spéciaux ne modifient pas le modèle lun→dim).
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={prioritizeRoleBalance}
                    disabled={pending}
                    onChange={(e) => setPrioritizeRoleBalance(e.target.checked)}
                  />
                  <span className="text-sm text-slate-700">
                    <strong>Équilibrer salle / cuisine / gestion</strong> lors de la génération (priorité aux postes
                    sous-représentés).
                  </span>
                </label>
              </div>
            </div>
          )}

          {step.id === "review" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Vérifiez le récapitulatif. Les exceptions de la semaine seront enregistrées, puis l’ébauche sera
                générée automatiquement.
              </p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {days.map((d) => {
                  const base = d.staffTarget.trim() === "" ? null : Number(d.staffTarget.replace(",", "."));
                  const eff = effectiveStaffTarget(base, d.intensity, d.isClosed);
                  return (
                    <li key={d.ymd} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span className="capitalize text-slate-800">{d.dateLabel}</span>
                      <span className="text-slate-600">
                        {d.isClosed ? (
                          "Fermé"
                        ) : eff != null ? (
                          <>
                            <strong>{eff}</strong> pers.
                            {d.intensity !== "normal" ? ` (${intensityLabelFr(d.intensity)})` : ""}
                          </>
                        ) : (
                          "— effectif"
                        )}
                        {d.customLabel.trim() ? ` · ${d.customLabel.trim()}` : ""}
                        {!d.isClosed && d.peakBands.length > 0 ? (
                          <span className="mt-0.5 block text-xs text-indigo-600">
                            Pointe :{" "}
                            {d.peakBands
                              .map((p) => `${p.start}–${p.end} (${p.staffCount} pers.)`)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {unavailableStaffIds.size > 0 ? (
                <p className="text-xs text-slate-500">
                  Exclus :{" "}
                  {activeStaff
                    .filter((m) => unavailableStaffIds.has(m.id))
                    .map((m) => m.display_name)
                    .join(", ")}
                </p>
              ) : null}
              {allowOvertime ? (
                <p className="text-xs text-amber-800">
                  Dépassement contrat : +{overtimePercent} % pour{" "}
                  {overtimeStaffIds.size} collaborateur{overtimeStaffIds.size > 1 ? "s" : ""}.
                  {applyCarryover ? " Soldes mis à jour après génération." : ""}
                </p>
              ) : null}
              {(() => {
                const bonuses = parseWeeklyHoursBonusFromWizard(weeklyBonusByStaff);
                const withBonus = activeStaff.filter(
                  (m) => (bonuses[m.id] ?? 0) > 0 && !unavailableStaffIds.has(m.id)
                );
                if (withBonus.length === 0) return null;
                return (
                  <p className="text-xs text-amber-800">
                    Heures sup. :{" "}
                    {withBonus.map((m) => `${m.display_name} (+${bonuses[m.id]} h)`).join(" · ")}
                  </p>
                );
              })()}
              {(() => {
                const limits = parseMaxDailyHoursFromWizard(staff, maxDailyHoursByStaff);
                const withLimit = activeStaff.filter(
                  (m) => limits[m.id] != null && !unavailableStaffIds.has(m.id)
                );
                if (withLimit.length === 0) return null;
                return (
                  <p className="text-xs text-slate-600">
                    Plafond journalier :{" "}
                    {withLimit.map((m) => `${m.display_name} (${limits[m.id]} h max)`).join(" · ")}
                    {persistMaxDailyHours ? " · enregistré sur les fiches." : ""}
                  </p>
                );
              })()}
              {warnings.some((w) => w.level === "warn") ? (
                <ul className="space-y-1">
                  {warnings
                    .filter((w) => w.level === "warn")
                    .map((w, i) => (
                      <li key={i} className="text-xs text-amber-800">
                        {w.message}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button type="button" disabled={pending || stepIndex === 0} className={uiBtnOutlineSm} onClick={goBack}>
              <ChevronLeft className="mr-0.5 inline h-4 w-4" aria-hidden />
              Retour
            </button>
            <span className="text-xs text-slate-500">
              {stepIndex + 1}/{STEPS.length}
              {stepIndex < STEPS.length - 1 ? ` · suivant : ${STEPS[stepIndex + 1]!.title}` : ""}
            </span>
          </div>
          <div className="flex gap-2">
            {stepIndex < STEPS.length - 1 ? (
              <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={goNext}>
                Suivant
                <ChevronRight className="ml-0.5 inline h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button type="button" disabled={pending || activeStaff.length === 0} className={uiBtnPrimary} onClick={submit}>
                {pending ? "Génération…" : "Générer l’ébauche"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
