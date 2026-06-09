"use client";

import { useCallback, useMemo, useState } from "react";
import type { PlanningDayKey, TimeBand } from "@/lib/staff/planningHoursTypes";
import type { PeakBandWeeklyEntry } from "@/lib/staff/planningPeakBands";
import { resolvePeakBandsForDay } from "@/lib/staff/planningDraftBrief";
import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import { computeBaseNeedByDay } from "./predictiveNeed";
import { collectRetroSaveOps, countModifiedFields, type RetroSaveOp } from "./wizardDiff";
import {
  fieldComputed,
  overrideField,
  setPersist,
  type HydratedField,
} from "./wizardFieldTypes";
import {
  blockingFieldsForStep,
  WIZARD_STEPS,
  type BlockingField,
  type WizardStepId,
} from "./wizardValidation";
import type { StaffingAdjustments, TeamMemberDraft, WizardData } from "./wizardDataTypes";

type TeamFieldKey = {
  [K in keyof TeamMemberDraft]: TeamMemberDraft[K] extends HydratedField<unknown> ? K : never;
}[keyof TeamMemberDraft];

export interface UseWizardForm {
  initialData: WizardData;
  formData: WizardData;
  modifiedCount: number;
  retroSaveOps: RetroSaveOp[];
  blockingByStep: Record<WizardStepId, BlockingField[]>;
  canAdvance: (stepId: WizardStepId) => boolean;
  // mutateurs
  setSecurityFloor: (v: number, persist?: boolean) => void;
  setDayOpeningBands: (ymd: string, bands: TimeBand[]) => void;
  overrideTeamField: <K extends TeamFieldKey>(
    staffMemberId: string,
    key: K,
    value: NonNullable<TeamMemberDraft[K]["value"]>
  ) => void;
  setTeamFieldPersist: (staffMemberId: string, key: TeamFieldKey, persist: boolean) => void;
  setFixedRestDays: (staffMemberId: string, days: PlanningDayKey[], persist?: boolean) => void;
  setWeeklyRestDays: (staffMemberId: string, value: number, persist?: boolean) => void;
  setRequireConsecutive: (staffMemberId: string, value: boolean, persist?: boolean) => void;
  setAdjustment: (key: keyof StaffingAdjustments, value: boolean) => void;
  reset: () => void;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

function resolvedDayFromWizardDay(
  weekMondayYmd: string,
  day: WizardData["establishment"]["days"][number]
): WeekResolvedDay {
  const idx = Math.max(0, ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(day.dayKey));
  const monday = new Date(`${weekMondayYmd}T00:00:00`);
  const date = new Date(monday);
  date.setDate(monday.getDate() + idx);
  return {
    ymd: day.ymd,
    dayKey: day.dayKey,
    date,
    openingBands: day.openingBands.value ?? [],
    staffExtraBands: day.staffExtraBands.value ?? [],
    staffTarget: day.staffTarget.value ?? null,
    exceptionLabel: null,
  };
}

/**
 * Gère l'état du wizard : `initialData` (snapshot figé issu de l'hydratation serveur)
 * vs `formData` (surcharges utilisateur). Recalcule le besoin prédictif à la volée,
 * expose le diff (rétro-enregistrement) et le gating d'étapes.
 */
export function useWizardForm(hydrated: WizardData): UseWizardForm {
  const [initialData] = useState<WizardData>(() => clone(hydrated));
  const [formData, setFormData] = useState<WizardData>(() => clone(hydrated));

  const recomputeNeed = useCallback((d: WizardData): WizardData => {
    const openingByDay: Partial<Record<PlanningDayKey, TimeBand[]>> = {};
    for (const day of d.establishment.days) {
      openingByDay[day.dayKey] = day.openingBands.value ?? [];
    }
    const peaksByDay: Partial<Record<PlanningDayKey, PeakBandWeeklyEntry[]>> = {};
    for (const k of Object.keys(d.staffing.peakBandsByDay) as PlanningDayKey[]) {
      peaksByDay[k] = d.staffing.peakBandsByDay[k]?.value ?? [];
    }
    return {
      ...d,
      staffing: {
        ...d.staffing,
        baseNeedByDay: computeBaseNeedByDay(
          openingByDay,
          d.establishment.securityFloor.value ?? 2,
          peaksByDay,
          d.staffing.adjustments
        ),
      },
    };
  }, []);

  const setSecurityFloor = useCallback((v: number, persist?: boolean) => {
    setFormData((prev) => {
      let field = overrideField(prev.establishment.securityFloor, v);
      if (persist != null) field = setPersist(field, persist);
      const next: WizardData = {
        ...prev,
        establishment: { ...prev.establishment, securityFloor: field },
      };
      return recomputeNeed(next);
    });
  }, [recomputeNeed]);

  const setDayOpeningBands = useCallback(
    (ymd: string, bands: TimeBand[]) => {
      setFormData((prev) => {
        const securityFloor = prev.establishment.securityFloor.value ?? 2;

        const days = prev.establishment.days.map((day) => {
          if (day.ymd !== ymd) return day;
          const openingBands = overrideField(day.openingBands, bands);
          const isClosed = bands.length === 0;
          const nextDay = {
            ...day,
            isClosed,
            openingBands,
            staffTarget:
              !isClosed && day.staffTarget.value == null
                ? overrideField(day.staffTarget, Math.max(2, Math.round(securityFloor)))
                : day.staffTarget,
          };
          return nextDay;
        });

        const staffing = { ...prev.staffing };
        const changedDay = days.find((day) => day.ymd === ymd);
        if (changedDay) {
          const target = changedDay.staffTarget.value ?? securityFloor;
          const peakBands = resolvePeakBandsForDay(
            resolvedDayFromWizardDay(prev.weekMondayYmd, changedDay),
            target,
            changedDay.isClosed
          ).map((p) => ({
            start: p.start,
            end: p.end,
            staffCount: Math.ceil(Number(p.staffCount) || target),
          }));
          staffing.peakBandsByDay = {
            ...prev.staffing.peakBandsByDay,
            [changedDay.dayKey]: fieldComputed<PeakBandWeeklyEntry[]>(peakBands, {
              kind: "restaurant.peakBandsWeekly",
            }),
          };
        }

        return recomputeNeed({
          ...prev,
          establishment: { ...prev.establishment, days },
          staffing,
        });
      });
    },
    [recomputeNeed]
  );

  const overrideTeamField = useCallback(
    <K extends TeamFieldKey>(
      staffMemberId: string,
      key: K,
      value: NonNullable<TeamMemberDraft[K]["value"]>
    ) => {
      setFormData((prev) => ({
        ...prev,
        team: {
          ...prev.team,
          members: prev.team.members.map((m) =>
            m.staffMemberId === staffMemberId
              ? { ...m, [key]: overrideField(m[key] as HydratedField<unknown>, value) }
              : m
          ),
        },
      }));
    },
    []
  );

  const setTeamFieldPersist = useCallback(
    (staffMemberId: string, key: TeamFieldKey, persist: boolean) => {
      setFormData((prev) => ({
        ...prev,
        team: {
          ...prev.team,
          members: prev.team.members.map((m) =>
            m.staffMemberId === staffMemberId
              ? { ...m, [key]: setPersist(m[key] as HydratedField<unknown>, persist) }
              : m
          ),
        },
      }));
    },
    []
  );

  const setFixedRestDays = useCallback(
    (staffMemberId: string, daysList: PlanningDayKey[], persist?: boolean) => {
      setFormData((prev) => {
        const rule = prev.constraints.restRulesByStaffId[staffMemberId];
        if (!rule) return prev;
        let field = overrideField(rule.fixedRestDays, daysList);
        if (persist != null) field = setPersist(field, persist);
        return {
          ...prev,
          constraints: {
            ...prev.constraints,
            restRulesByStaffId: {
              ...prev.constraints.restRulesByStaffId,
              [staffMemberId]: { ...rule, fixedRestDays: field },
            },
          },
        };
      });
    },
    []
  );

  const setRequireConsecutive = useCallback(
    (staffMemberId: string, value: boolean, persist?: boolean) => {
      setFormData((prev) => {
        const rule = prev.constraints.restRulesByStaffId[staffMemberId];
        if (!rule) return prev;
        let field = overrideField(rule.requireConsecutive, value);
        if (persist != null) field = setPersist(field, persist);
        return {
          ...prev,
          constraints: {
            ...prev.constraints,
            restRulesByStaffId: {
              ...prev.constraints.restRulesByStaffId,
              [staffMemberId]: { ...rule, requireConsecutive: field },
            },
          },
        };
      });
    },
    []
  );

  const setWeeklyRestDays = useCallback(
    (staffMemberId: string, value: number, persist?: boolean) => {
      setFormData((prev) => {
        const rule = prev.constraints.restRulesByStaffId[staffMemberId];
        if (!rule) return prev;
        const safeValue = Math.min(7, Math.max(0, Math.round(value)));
        let field = overrideField(rule.weeklyRestDays, safeValue);
        if (persist != null) field = setPersist(field, persist);
        return {
          ...prev,
          constraints: {
            ...prev.constraints,
            restRulesByStaffId: {
              ...prev.constraints.restRulesByStaffId,
              [staffMemberId]: { ...rule, weeklyRestDays: field },
            },
          },
        };
      });
    },
    []
  );

  const setAdjustment = useCallback(
    (key: keyof StaffingAdjustments, value: boolean) => {
      setFormData((prev) =>
        recomputeNeed({
          ...prev,
          staffing: { ...prev.staffing, adjustments: { ...prev.staffing.adjustments, [key]: value } },
        })
      );
    },
    [recomputeNeed]
  );

  const reset = useCallback(() => setFormData(clone(initialData)), [initialData]);

  const blockingByStep = useMemo(() => {
    const out = {} as Record<WizardStepId, BlockingField[]>;
    for (const s of WIZARD_STEPS) out[s.id] = blockingFieldsForStep(s.id, formData);
    return out;
  }, [formData]);

  const canAdvance = useCallback(
    (stepId: WizardStepId) => blockingByStep[stepId].length === 0,
    [blockingByStep]
  );

  return {
    initialData,
    formData,
    modifiedCount: useMemo(() => countModifiedFields(formData), [formData]),
    retroSaveOps: useMemo(() => collectRetroSaveOps(formData), [formData]),
    blockingByStep,
    canAdvance,
    setSecurityFloor,
    setDayOpeningBands,
    overrideTeamField,
    setTeamFieldPersist,
    setFixedRestDays,
    setWeeklyRestDays,
    setRequireConsecutive,
    setAdjustment,
    reset,
  };
}
