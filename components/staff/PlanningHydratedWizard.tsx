"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Pencil,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { applyPlanningDraftBriefAndGenerateAction } from "@/app/equipe/actions";
import { applyRetroSaveAction } from "@/app/equipe/wizardActions";
import { buildBriefFromWizard } from "@/lib/staff/wizard/buildBriefFromWizard";
import { useWizardForm } from "@/lib/staff/wizard/useWizardForm";
import { WIZARD_STEPS } from "@/lib/staff/wizard/wizardValidation";
import {
  isFieldMissing,
  isFieldModified,
  isFieldSynced,
  type HydratedField,
} from "@/lib/staff/wizard/wizardFieldTypes";
import type { WizardData } from "@/lib/staff/wizard/wizardDataTypes";
import { PLANNING_DAY_KEYS, PLANNING_DAY_LABELS_FR, type PlanningDayKey, type TimeBand } from "@/lib/staff/planningHoursTypes";
import { getEstablishmentTypeLabelFr } from "@/lib/staff/wizard/establishmentTypeLabel";
import { uiBtnOutlineSm, uiBtnPrimary, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  weekLabel: string;
  wizardData: WizardData;
  onGenerated: (result: { generatedCount: number; summaryFr: string | null }) => void;
};

function SyncedBadge() {
  return (
    <span
      title="Donnée synchronisée depuis la base"
      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600"
    >
      <Database className="h-3 w-3" /> sync
    </span>
  );
}

function OverriddenBadge() {
  return (
    <span
      title="Valeur surchargée pour cette semaine"
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
    >
      <Pencil className="h-3 w-3" /> modifié
    </span>
  );
}

function FieldStatus<T>({ field }: { field: HydratedField<T> }) {
  if (isFieldModified(field)) return <OverriddenBadge />;
  if (isFieldSynced(field)) return <SyncedBadge />;
  return null;
}

/** Case "rétro-enregistrer" affichée seulement si le champ est surchargé et rétro-enregistrable. */
function PersistToggle<T>({
  field,
  onToggle,
}: {
  field: HydratedField<T>;
  onToggle: (v: boolean) => void;
}) {
  if (!field.writeTarget || !isFieldModified(field)) return null;
  return (
    <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500">
      <input
        type="checkbox"
        checked={field.persistToDb}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-3 w-3"
      />
      Mettre à jour définitivement (fiche / établissement)
    </label>
  );
}

export function PlanningHydratedWizard({
  open,
  onClose,
  restaurantId,
  weekLabel,
  wizardData,
  onGenerated,
}: Props) {
  const form = useWizardForm(wizardData);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const step = WIZARD_STEPS[stepIndex];
  const blocking = form.blockingByStep[step.id];
  const canNext = blocking.length === 0;

  const calendarByDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of form.formData.establishment.detectedCalendar) {
      const list = m.get(c.dayKey) ?? [];
      list.push(c.label);
      m.set(c.dayKey, list);
    }
    return m;
  }, [form.formData.establishment.detectedCalendar]);

  if (!open) return null;

  function handleGenerate() {
    setError(null);
    start(async () => {
      const ops = form.retroSaveOps;
      if (ops.length > 0) {
        const r = await applyRetroSaveAction(restaurantId, ops);
        if (!r.ok) {
          setError(`Rétro-enregistrement échoué : ${r.error}`);
          return;
        }
      }
      const brief = buildBriefFromWizard(form.formData);
      const gen = await applyPlanningDraftBriefAndGenerateAction(restaurantId, brief);
      if (!gen.ok) {
        setError(gen.error);
        return;
      }
      onGenerated({ generatedCount: gen.generatedCount, summaryFr: gen.summaryFr });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="my-8 w-full max-w-3xl rounded-xl bg-white shadow-xl">
        {/* En-tête + stepper */}
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-indigo-600" /> Ébauche de planning
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{weekLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1.5 border-b border-slate-200 px-5 py-3">
          {WIZARD_STEPS.map((s, i) => {
            const hasBlock = form.blockingByStep[s.id].length > 0;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIndex(i)}
                className={`flex-1 rounded-md px-2 py-1.5 text-left text-xs transition ${
                  i === stepIndex ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-1 font-medium">
                  {i + 1}. {s.title}
                  {hasBlock && i !== stepIndex ? (
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {step.id === "establishment" ? (
            <EstablishmentStep form={form} calendarByDay={calendarByDay} />
          ) : step.id === "team" ? (
            <TeamStep form={form} />
          ) : step.id === "constraints" ? (
            <ConstraintsStep form={form} />
          ) : (
            <StaffingStep form={form} />
          )}
        </div>

        {/* Pied : blocage + navigation */}
        <div className="border-t border-slate-200 px-5 py-3">
          {blocking.length > 0 ? (
            <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-medium">Données manquantes — complétez avant de continuer :</p>
              <ul className="mt-1 list-inside list-disc">
                {blocking.slice(0, 5).map((b, i) => (
                  <li key={i}>
                    {b.label} — {b.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {error ? (
            <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          ) : null}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
              className={`${uiBtnOutlineSm} disabled:opacity-40`}
            >
              <ChevronLeft className="h-4 w-4" /> Précédent
            </button>

            <span className="text-xs text-slate-400">
              {form.modifiedCount > 0 ? `${form.modifiedCount} surcharge(s)` : "Aucune surcharge"}
            </span>

            {stepIndex < WIZARD_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => canNext && setStepIndex((i) => i + 1)}
                disabled={!canNext}
                className={`${uiBtnPrimary} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Suivant <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={pending || !canNext}
                className={`${uiBtnPrimary} disabled:opacity-50`}
              >
                {pending ? "Génération…" : "Générer l'ébauche"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Étape 1 : Établissement ───────────────────────────────────────────────────

function EstablishmentStep({
  form,
  calendarByDay,
}: {
  form: ReturnType<typeof useWizardForm>;
  calendarByDay: Map<string, string[]>;
}) {
  const est = form.formData.establishment;
  const updateOpeningBand = (ymd: string, index: number, patch: Partial<TimeBand>) => {
    const day = est.days.find((d) => d.ymd === ymd);
    if (!day) return;
    const bands = [...(day.openingBands.value ?? [])];
    bands[index] = { ...bands[index], ...patch };
    form.setDayOpeningBands(ymd, bands);
  };
  const addOpeningBand = (ymd: string) => {
    const day = est.days.find((d) => d.ymd === ymd);
    const bands = day?.openingBands.value ?? [];
    const previousEnd = bands.at(-1)?.end;
    const start = previousEnd && previousEnd < "21:00" ? previousEnd : "09:00";
    const end = start < "17:00" ? "17:00" : "22:00";
    form.setDayOpeningBands(ymd, [
      ...bands,
      { start, end },
    ]);
  };
  const removeOpeningBand = (ymd: string, index: number) => {
    const day = est.days.find((d) => d.ymd === ymd);
    if (!day) return;
    form.setDayOpeningBands(
      ymd,
      (day.openingBands.value ?? []).filter((_, i) => i !== index)
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-slate-800">
            {getEstablishmentTypeLabelFr(est.establishmentType.value)}
          </span>
          <FieldStatus field={est.establishmentType} />
        </div>
      </div>

      <div>
        <label className={uiLabel}>
          Talon de sécurité (effectif minimum simultané) <FieldStatus field={est.securityFloor} />
        </label>
        <input
          type="number"
          min={2}
          value={est.securityFloor.value ?? ""}
          onChange={(e) => form.setSecurityFloor(Number(e.target.value))}
          className={`${uiInput} ${isFieldMissing(est.securityFloor) ? "border-amber-400" : ""}`}
        />
        {isFieldMissing(est.securityFloor) ? (
          <p className="mt-1 text-xs text-amber-600">Donnée manquante.</p>
        ) : null}
        <PersistToggle field={est.securityFloor} onToggle={(v) => form.setSecurityFloor(est.securityFloor.value ?? 2, v)} />
      </div>

      <div>
        <p className={uiLabel}>Horaires de la semaine</p>
        <p className="mt-1 text-xs text-slate-500">
          Ajustez les horaires préremplis si cette semaine diffère du modèle habituel. Ces modifications servent à
          générer l’ébauche.
        </p>
        <div className="mt-2 space-y-2">
          {est.days.map((day) => {
            const bands = day.openingBands.value ?? [];
            const cal = calendarByDay.get(day.dayKey) ?? [];
            return (
              <div
                key={day.ymd}
                className="rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    {PLANNING_DAY_LABELS_FR[day.dayKey]} {Number(day.ymd.slice(8, 10))}
                    <FieldStatus field={day.openingBands} />
                  </span>
                  <span className="flex items-center gap-1.5">
                    {cal.map((label, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600"
                        title={label}
                      >
                        {label.includes("Zone") ? "Vacances" : "Férié"}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {bands.length === 0 ? (
                    <p className="text-xs text-slate-400">Fermé</p>
                  ) : (
                    bands.map((b, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          className={`${uiInput} w-[7rem] text-xs`}
                          value={b.start}
                          onChange={(e) => updateOpeningBand(day.ymd, i, { start: e.target.value })}
                          aria-label={`Début ${PLANNING_DAY_LABELS_FR[day.dayKey]} ${i + 1}`}
                        />
                        <span className="text-slate-400">→</span>
                        <input
                          type="time"
                          className={`${uiInput} w-[7rem] text-xs`}
                          value={b.end}
                          onChange={(e) => updateOpeningBand(day.ymd, i, { end: e.target.value })}
                          aria-label={`Fin ${PLANNING_DAY_LABELS_FR[day.dayKey]} ${i + 1}`}
                        />
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Supprimer ce créneau"
                          onClick={() => removeOpeningBand(day.ymd, i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                  <button type="button" className={uiBtnOutlineSm} onClick={() => addOpeningBand(day.ymd)}>
                    <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                    {bands.length === 0 ? "Ouvrir ce jour" : "Ajouter un créneau"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Étape 2 : Équipe ──────────────────────────────────────────────────────────

function TeamStep({ form }: { form: ReturnType<typeof useWizardForm> }) {
  const members = form.formData.team.members.filter((m) => m.active);
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm text-slate-600">
        <Users className="h-4 w-4" /> {members.length} collaborateur(s) actif(s)
      </p>
      {members.map((m) => (
        <div key={m.staffMemberId} className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-800">{m.displayName}</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                Poste <FieldStatus field={m.role} />
              </label>
              <input
                value={m.role.value ?? ""}
                onChange={(e) => form.overrideTeamField(m.staffMemberId, "role", e.target.value)}
                className={`${uiInput} ${isFieldMissing(m.role) ? "border-amber-400" : ""}`}
                placeholder="Ex. Glace, Vélo…"
              />
              {isFieldMissing(m.role) ? (
                <p className="text-[11px] text-amber-600">Donnée manquante.</p>
              ) : null}
              <PersistToggle
                field={m.role}
                onToggle={(v) => form.setTeamFieldPersist(m.staffMemberId, "role", v)}
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                Heures / semaine <FieldStatus field={m.contractWeeklyHours} />
              </label>
              <input
                type="number"
                min={0}
                value={m.contractWeeklyHours.value ?? ""}
                onChange={(e) =>
                  form.overrideTeamField(m.staffMemberId, "contractWeeklyHours", Number(e.target.value))
                }
                className={`${uiInput} ${isFieldMissing(m.contractWeeklyHours) ? "border-amber-400" : ""}`}
              />
              {isFieldMissing(m.contractWeeklyHours) ? (
                <p className="text-[11px] text-amber-600">Donnée manquante (obligatoire).</p>
              ) : null}
              <PersistToggle
                field={m.contractWeeklyHours}
                onToggle={(v) => form.setTeamFieldPersist(m.staffMemberId, "contractWeeklyHours", v)}
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                Shift par défaut <FieldStatus field={m.defaultShiftPattern} />
              </label>
              <select
                value={m.defaultShiftPattern.value ?? ""}
                onChange={(e) =>
                  form.overrideTeamField(
                    m.staffMemberId,
                    "defaultShiftPattern",
                    e.target.value as "continuous" | "split" | "flexible"
                  )
                }
                className={`${uiInput} ${isFieldMissing(m.defaultShiftPattern) ? "border-amber-400" : ""}`}
              >
                <option value="">—</option>
                <option value="continuous">Continu</option>
                <option value="split">Coupure</option>
                <option value="flexible">Flexible</option>
              </select>
              <PersistToggle
                field={m.defaultShiftPattern}
                onToggle={(v) => form.setTeamFieldPersist(m.staffMemberId, "defaultShiftPattern", v)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Étape 3 : Contraintes ─────────────────────────────────────────────────────

function ConstraintsStep({ form }: { form: ReturnType<typeof useWizardForm> }) {
  const members = form.formData.team.members.filter((m) => m.active);
  const leaves = form.formData.constraints.leavesByStaffId;
  const rules = form.formData.constraints.restRulesByStaffId;
  return (
    <div className="space-y-3">
      {members.map((m) => {
        const memberLeaves = leaves[m.staffMemberId] ?? [];
        const rule = rules[m.staffMemberId];
        return (
          <div key={m.staffMemberId} className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-800">{m.displayName}</p>

            {memberLeaves.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {memberLeaves.map((lv, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700"
                  >
                    {lv.kind === "leave" ? "Congé" : "Indispo"} {Number(lv.ymd.slice(8, 10))} · {lv.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400">Aucune absence ingérée cette semaine.</p>
            )}

            {rule ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    Jours de repos / semaine <FieldStatus field={rule.weeklyRestDays} />
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    step={1}
                    value={rule.weeklyRestDays.value ?? 2}
                    onChange={(e) => form.setWeeklyRestDays(m.staffMemberId, Number(e.target.value))}
                    className={`${uiInput} w-20 text-xs`}
                    aria-label={`Jours de repos par semaine pour ${m.displayName}`}
                  />
                  <span className="text-[11px] text-slate-400">
                    max {Math.max(0, 7 - (rule.weeklyRestDays.value ?? 2))} jour(s) travaillé(s)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500">Jours de repos fixes :</span>
                  {PLANNING_DAY_KEYS.map((dk) => {
                    const active = (rule.fixedRestDays.value ?? []).includes(dk);
                    return (
                      <button
                        key={dk}
                        type="button"
                        onClick={() => {
                          const cur = rule.fixedRestDays.value ?? [];
                          const next = active ? cur.filter((x) => x !== dk) : [...cur, dk];
                          form.setFixedRestDays(m.staffMemberId, next as PlanningDayKey[]);
                        }}
                        className={`rounded-md px-2 py-0.5 text-[11px] ${
                          active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {PLANNING_DAY_LABELS_FR[dk]}
                      </button>
                    );
                  })}
                  <FieldStatus field={rule.fixedRestDays} />
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={rule.requireConsecutive.value ?? false}
                    onChange={(e) => form.setRequireConsecutive(m.staffMemberId, e.target.checked)}
                  />
                  Préférer 2 jours de repos consécutifs
                </label>
                <PersistToggle
                  field={rule.fixedRestDays}
                  onToggle={(v) => {
                    form.setFixedRestDays(m.staffMemberId, (rule.fixedRestDays.value ?? []) as PlanningDayKey[], v);
                    form.setWeeklyRestDays(m.staffMemberId, rule.weeklyRestDays.value ?? 2, v);
                    form.setRequireConsecutive(m.staffMemberId, rule.requireConsecutive.value ?? true, v);
                  }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ── Étape 4 : Besoin prédictif ────────────────────────────────────────────────

function StaffingStep({ form }: { form: ReturnType<typeof useWizardForm> }) {
  const adj = form.formData.staffing.adjustments;
  const need = form.formData.staffing.baseNeedByDay;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => form.setAdjustment("heatwave", !adj.heatwave)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            adj.heatwave ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Alerte canicule {adj.heatwave ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => form.setAdjustment("highTraffic", !adj.highTraffic)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            adj.highTraffic ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Forte affluence {adj.highTraffic ? "✓" : ""}
        </button>
      </div>

      <div className="space-y-1.5">
        {form.formData.establishment.days.map((day) => {
          if (day.isClosed) {
            return (
              <div
                key={day.ymd}
                className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm text-slate-400"
              >
                <span>{PLANNING_DAY_LABELS_FR[day.dayKey]} {Number(day.ymd.slice(8, 10))}</span>
                <span>Fermé</span>
              </div>
            );
          }
          const slots = need[day.dayKey] ?? [];
          const peak = slots.length > 0 ? Math.max(...slots.map((s) => s.need)) : day.staffTarget.value ?? 2;
          const bands = day.openingBands.value ?? [];
          return (
            <div
              key={day.ymd}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-1.5 text-sm"
            >
              <span className="font-medium text-slate-700">
                {PLANNING_DAY_LABELS_FR[day.dayKey]} {Number(day.ymd.slice(8, 10))}
              </span>
              <span className="text-slate-500">
                {bands.map((b) => `${b.start}–${b.end}`).join(", ") || "—"} · cible{" "}
                <strong className="text-slate-800">{day.staffTarget.value ?? peak}</strong> pers.
              </span>
            </div>
          );
        })}
      </div>

      <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        <Check className="h-3.5 w-3.5" /> Le besoin est recalculé en direct selon les ajustements.
      </p>
    </div>
  );
}
