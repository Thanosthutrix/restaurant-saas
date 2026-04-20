"use client";

import { FranceCalendarGuidedPanel } from "@/components/staff/FranceCalendarGuidedPanel";
import { PlanningBandPresetsEditor } from "@/components/staff/PlanningBandPresetsEditor";
import { OpeningHoursEditor } from "@/components/staff/OpeningHoursEditor";
import { PlanningOverridesPanel } from "@/components/staff/PlanningOverridesPanel";
import { StaffTargetsWeeklyEditor } from "@/components/staff/StaffTargetsWeeklyEditor";
import type { PublicHolidayEntry } from "@/lib/franceCalendars/publicHolidays";
import type { SchoolVacationPeriod } from "@/lib/franceCalendars/schoolVacations";
import type { PlanningBandPreset } from "@/lib/staff/planningBandPresets";
import type { PlanningDayOverrideRow } from "@/lib/staff/planningResolve";
import type { OpeningHoursMap, PlanningDayKey } from "@/lib/staff/planningHoursTypes";
import { uiCard } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  openingHours: OpeningHoursMap;
  /** Plages travail sans service client (modèle établissement). */
  staffExtraBands: OpeningHoursMap;
  staffTargetsWeekly: Partial<Record<PlanningDayKey, number>>;
  overrides: PlanningDayOverrideRow[];
  effectiveSchoolZone: "A" | "B" | "C";
  zoneIsAssumed: boolean;
  calendarYears: readonly number[];
  publicHolidaysByYear: Record<number, PublicHolidayEntry[]>;
  schoolPeriodsByYear: Record<number, SchoolVacationPeriod[]>;
  bandPresets: PlanningBandPreset[];
};

export function RestaurantPlanningSection({
  restaurantId,
  openingHours,
  staffExtraBands,
  staffTargetsWeekly,
  overrides,
  effectiveSchoolZone,
  zoneIsAssumed,
  calendarYears,
  publicHolidaysByYear,
  schoolPeriodsByYear,
  bandPresets,
}: Props) {
  return (
    <div className="space-y-6">
      <section className={uiCard}>
        <h2 className="text-base font-semibold text-slate-900">Modèles de plages exceptionnelles</h2>
        <p className="mt-1 text-xs text-slate-500">
          Plages + ETP optionnel : réutilisables dans le calendrier (fériés, vacances, ex. été chargé).
        </p>
        <div className="mt-4">
          <PlanningBandPresetsEditor restaurantId={restaurantId} initial={bandPresets} />
        </div>
      </section>

      <section className={uiCard}>
        <h2 className="text-base font-semibold text-slate-900">Horaires d’ouverture (modèle hebdomadaire)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Sert de base pour la grille planning et les alertes. Les exceptions (fériés, vacances) sont gérées
          ci-dessous.
        </p>
        <div className="mt-4">
          <OpeningHoursEditor restaurantId={restaurantId} initial={openingHours} />
        </div>
      </section>

      <section className={uiCard}>
        <h2 className="text-base font-semibold text-slate-900">Travail effectif hors service client (modèle)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Plages où vous pouvez planifier du personnel alors que le service au public n’est pas ouvert (prépa, livraisons,
          etc.). Complète les horaires ci-dessus et les plages par collaborateur dans la fiche équipe.
        </p>
        <div className="mt-4">
          <OpeningHoursEditor variant="staffExtra" restaurantId={restaurantId} initial={staffExtraBands} />
        </div>
      </section>

      <section className={uiCard}>
        <h2 className="text-base font-semibold text-slate-900">Objectifs d’effectif (modèle)</h2>
        <div className="mt-4">
          <StaffTargetsWeeklyEditor restaurantId={restaurantId} initial={staffTargetsWeekly} />
        </div>
      </section>

      <section className={uiCard}>
        <FranceCalendarGuidedPanel
          restaurantId={restaurantId}
          effectiveZone={effectiveSchoolZone}
          zoneIsAssumed={zoneIsAssumed}
          years={calendarYears}
          publicHolidaysByYear={publicHolidaysByYear}
          schoolPeriodsByYear={schoolPeriodsByYear}
          overrides={overrides}
          bandPresets={bandPresets}
        />
      </section>

      <section className={uiCard}>
        <h2 className="text-base font-semibold text-slate-900">Exceptions ponctuelles (hors calendrier ou ajustements)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Pour une date précise, horaires spéciaux ou libellé personnalisé, ajoutez une ligne ici. Les lignes créées via le
          calendrier ci-dessus restent modifiables ou supprimables.
        </p>
        <div className="mt-4">
          <PlanningOverridesPanel restaurantId={restaurantId} overrides={overrides} />
        </div>
      </section>
    </div>
  );
}
