"use client";

import type { HcrClauseSelection } from "@/lib/hcr-contracts/types";
import type { HcrTrialPeriodLimit } from "@/lib/hcr-contracts/trialPeriod";
import type { HcrEmployeeStatus } from "@/lib/hcr-contracts/types";
import { uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

const CLAUSE_ITEMS = [
  { key: "trialPeriod", label: "Période d'essai" },
  { key: "workingTimeModulation", label: "Modulation du temps de travail" },
  { key: "mealBenefits", label: "Avantages en nature repas" },
  { key: "logement", label: "Logement" },
  { key: "transport", label: "Frais de transport" },
  { key: "materiel", label: "Matériel professionnel" },
  { key: "exclusivite", label: "Exclusivité de service" },
  { key: "image", label: "Droit à l'image" },
  { key: "dedit", label: "Dédit-formation" },
  { key: "nonCompete", label: "Non-concurrence" },
  { key: "delegation", label: "Délégation" },
  { key: "videosurveillance", label: "Vidéosurveillance" },
  { key: "permis", label: "Permis obligatoire" },
  { key: "confidentialiteRenforcee", label: "Confidentialité renforcée" },
  { key: "tenueTravail", label: "Tenue de travail" },
  { key: "heuresComplementaires", label: "Heures complémentaires" },
  { key: "forfaitJours", label: "Forfait jours" },
  { key: "remunerationVariable", label: "Rémunération variable" },
  { key: "responsabiliteCaisse", label: "Responsabilité caisse" },
  { key: "charteInformatique", label: "Charte informatique" },
  { key: "travailleurNuit", label: "Travailleur de nuit" },
] as const;

type Props = {
  clauses: HcrClauseSelection;
  trialLimit: HcrTrialPeriodLimit;
  weeklyHours: number;
  status: HcrEmployeeStatus;
  onChange: (next: HcrClauseSelection) => void;
};

const requiredWarning = "⚠️ Paramètres requis manquants pour valider la légalité de cet article.";

function hasText(value: string | undefined | null): boolean {
  return value != null && value.trim().length > 0;
}

function hasPositiveNumber(value: number | undefined | null): boolean {
  return Number.isFinite(value) && Number(value) > 0;
}

function hasMissingRequiredSubFields(key: (typeof CLAUSE_ITEMS)[number]["key"], clauses: HcrClauseSelection): boolean {
  if (key === "logement" && clauses.logement) {
    return !hasText(clauses.housingAddress);
  }
  if (key === "transport" && clauses.transport) {
    return !hasText(clauses.transportDeadline);
  }
  if (key === "materiel" && clauses.materiel) {
    return !hasText(clauses.providedEquipment);
  }
  if (key === "dedit" && clauses.dedit) {
    return (
      !hasText(clauses.trainingName) ||
      !hasText(clauses.trainingCenter) ||
      !hasPositiveNumber(clauses.trainingCost) ||
      !hasPositiveNumber(clauses.deditDuration)
    );
  }
  if (key === "nonCompete" && clauses.nonCompete) {
    return (
      !hasPositiveNumber(clauses.nonCompeteDuration) ||
      !hasPositiveNumber(clauses.nonCompeteRadius) ||
      !hasPositiveNumber(clauses.nonCompeteCompensation)
    );
  }
  if (key === "delegation" && clauses.delegation) {
    return !hasText(clauses.delegationMissions);
  }
  if (key === "videosurveillance" && clauses.videosurveillance) {
    return !hasText(clauses.cctvLocations);
  }
  if (key === "confidentialiteRenforcee" && clauses.confidentialiteRenforcee) {
    return !hasText(clauses.protectedSavoirFaire);
  }
  if (key === "tenueTravail" && clauses.tenueTravail) {
    return !hasText(clauses.uniformProvidedList);
  }
  if (key === "remunerationVariable" && clauses.remunerationVariable) {
    return !hasPositiveNumber(clauses.variableBonusMax) || !hasText(clauses.variableBonusCriteria);
  }
  if (key === "responsabiliteCaisse" && clauses.responsabiliteCaisse) {
    return !hasText(clauses.posTerminalId);
  }
  return false;
}

export function HcrClauseSidebar({ clauses, trialLimit, weeklyHours, status, onChange }: Props) {
  const trialPeriodExceeded =
    clauses.trialPeriod &&
    (!trialLimit.canCalculate ||
      clauses.trialPeriodUnit !== trialLimit.unit ||
      clauses.trialPeriodValue > trialLimit.maxValue);

  const isPartTime = weeklyHours < 35;
  const complementaryHoursDisabled = weeklyHours >= 35;
  const forfaitJoursDisabled = status !== "executive";

  return (
    <aside className="space-y-3 rounded-2xl border border-stone-100 bg-stone-50/80 p-4">
      <div>
        <h2 className="text-sm font-semibold text-stone-900">Clauses additionnelles</h2>
        <p className="mt-1 text-xs text-stone-500">
          Cochez les clauses à injecter dans le contrat généré.
        </p>
      </div>
      <div className="space-y-2">
        {CLAUSE_ITEMS.map(({ key, label }) => {
          const clauseDisabled =
            (key === "exclusivite" && isPartTime) ||
            (key === "heuresComplementaires" && complementaryHoursDisabled) ||
            (key === "forfaitJours" && forfaitJoursDisabled);
          const missingRequired = hasMissingRequiredSubFields(key, clauses);

          return (
          <div key={key} className="rounded-xl bg-white px-3 py-2 text-sm">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(clauses[key])}
                disabled={clauseDisabled}
                onChange={(e) => onChange({ ...clauses, [key]: e.target.checked })}
              />
              <span className="flex flex-1 flex-wrap items-center gap-2 font-medium text-stone-700">
                {label}
                {key === "exclusivite" && isPartTime ? (
                  <span className="inline-flex rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
                    🔒 Interdit à temps partiel
                  </span>
                ) : null}
                {key === "heuresComplementaires" && complementaryHoursDisabled ? (
                  <span className="inline-flex rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-600">
                    Réservé au temps partiel
                  </span>
                ) : null}
                {key === "forfaitJours" && forfaitJoursDisabled ? (
                  <span className="inline-flex rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-600">
                    Réservé aux cadres
                  </span>
                ) : null}
              </span>
            </label>
            {key === "trialPeriod" && clauses.trialPeriod ? (
              <div className="mt-2 space-y-2">
                <label className={uiLabel} htmlFor="trial-period-value">
                  Durée d&apos;essai saisie
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="trial-period-value"
                    className={`${uiInput} w-24`}
                    type="number"
                    min={0}
                    step={1}
                    value={clauses.trialPeriodValue}
                    onChange={(e) =>
                      onChange({ ...clauses, trialPeriodValue: Number(e.target.value) })
                    }
                  />
                  <span className="text-xs font-medium text-stone-600">{trialLimit.unit}</span>
                </div>
                <p className={`text-xs ${trialPeriodExceeded ? "text-rose-600" : "text-stone-500"}`}>
                  {trialLimit.label}
                </p>
              </div>
            ) : null}
            {key === "logement" && clauses.logement ? (
              <div className="mt-2 space-y-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="housing-address">
                  Adresse précise <span className="text-rose-600">*</span>
                </label>
                <input
                  id="housing-address"
                  className={`${uiInput} w-full`}
                  value={clauses.housingAddress ?? ""}
                  onChange={(e) => onChange({ ...clauses, housingAddress: e.target.value })}
                  placeholder="Adresse précise"
                />
                <label className={uiLabel} htmlFor="housing-value">
                  Évaluation mensuelle en €
                </label>
                <input
                  id="housing-value"
                  className={`${uiInput} w-full`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={clauses.housingValue ?? 0}
                  onChange={(e) => onChange({ ...clauses, housingValue: Number(e.target.value) })}
                />
                <label className={uiLabel} htmlFor="housing-charges-payer">
                  Charges supportées par
                </label>
                <select
                  id="housing-charges-payer"
                  className={`${uiSelect} w-full`}
                  value={clauses.housingChargesPayer ?? "Salarié"}
                  onChange={(e) =>
                    onChange({
                      ...clauses,
                      housingChargesPayer: e.target.value as HcrClauseSelection["housingChargesPayer"],
                    })
                  }
                >
                  <option value="Salarié">Salarié</option>
                  <option value="Employeur">Employeur</option>
                </select>
                <label className={uiLabel} htmlFor="housing-eviction-days">
                  Délai de restitution en jours
                </label>
                <input
                  id="housing-eviction-days"
                  className={`${uiInput} w-full`}
                  type="number"
                  min={1}
                  step={1}
                  value={clauses.housingEvictionDays ?? 7}
                  onChange={(e) => onChange({ ...clauses, housingEvictionDays: Number(e.target.value) })}
                />
              </div>
            ) : null}
            {key === "transport" && clauses.transport ? (
              <div className="mt-2 space-y-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="transport-coverage-percent">
                  Taux de prise en charge employeur (%)
                </label>
                <input
                  id="transport-coverage-percent"
                  className={`${uiInput} w-full`}
                  type="number"
                  min={50}
                  max={100}
                  step={1}
                  value={clauses.transportCoveragePercent ?? 50}
                  onChange={(e) =>
                    onChange({
                      ...clauses,
                      transportCoveragePercent: Math.max(Number(e.target.value), 50),
                    })
                  }
                />
                <p className="text-[11px] font-medium text-amber-700">
                  Minimum légal : 50 %. L&apos;employeur peut choisir un taux supérieur.
                </p>
                <label className={uiLabel} htmlFor="transport-deadline">
                  Date limite de remise des justificatifs <span className="text-rose-600">*</span>
                </label>
                <input
                  id="transport-deadline"
                  className={`${uiInput} w-full`}
                  value={clauses.transportDeadline ?? ""}
                  onChange={(e) => onChange({ ...clauses, transportDeadline: e.target.value })}
                  placeholder="ex: le 25 du mois"
                />
              </div>
            ) : null}
            {key === "materiel" && clauses.materiel ? (
              <div className="mt-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="provided-equipment">
                  Matériel fourni <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="provided-equipment"
                  className={`${uiInput} mt-1 min-h-20 w-full`}
                  value={clauses.providedEquipment ?? ""}
                  onChange={(e) =>
                    onChange({ ...clauses, providedEquipment: e.target.value })
                  }
                  placeholder="ex: iPad de caisse, vestes brodées"
                />
              </div>
            ) : null}
            {key === "dedit" && clauses.dedit ? (
              <div className="mt-2 space-y-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="training-name">
                  Formation financée <span className="text-rose-600">*</span>
                </label>
                <input
                  id="training-name"
                  className={`${uiInput} w-full`}
                  value={clauses.trainingName ?? ""}
                  onChange={(e) => onChange({ ...clauses, trainingName: e.target.value })}
                  placeholder="Ex. Permis d'exploitation"
                />
                <label className={uiLabel} htmlFor="training-center">
                  Organisme de formation <span className="text-rose-600">*</span>
                </label>
                <input
                  id="training-center"
                  className={`${uiInput} w-full`}
                  value={clauses.trainingCenter ?? ""}
                  onChange={(e) => onChange({ ...clauses, trainingCenter: e.target.value })}
                  placeholder="Ex. CCI Formation"
                />
                <label className={uiLabel} htmlFor="training-cost">
                  Coût de la formation en € <span className="text-rose-600">*</span>
                </label>
                <input
                  id="training-cost"
                  className={`${uiInput} w-full`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={clauses.trainingCost ?? 0}
                  onChange={(e) => onChange({ ...clauses, trainingCost: Number(e.target.value) })}
                  placeholder="Coût de la formation"
                />
                <label className={uiLabel} htmlFor="dedit-duration">
                  Durée d&apos;engagement en mois <span className="text-rose-600">*</span>
                </label>
                <input
                  id="dedit-duration"
                  className={`${uiInput} w-full`}
                  type="number"
                  min={0}
                  step={1}
                  value={clauses.deditDuration ?? 0}
                  onChange={(e) => onChange({ ...clauses, deditDuration: Number(e.target.value) })}
                  placeholder="Durée d'engagement en mois"
                />
              </div>
            ) : null}
            {key === "nonCompete" && clauses.nonCompete ? (
              <div className="mt-2 space-y-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="non-compete-duration">
                  Durée en mois <span className="text-rose-600">*</span>
                </label>
                <input
                  id="non-compete-duration"
                  className={`${uiInput} w-full`}
                  type="number"
                  min={1}
                  step={1}
                  value={clauses.nonCompeteDuration ?? 12}
                  onChange={(e) => onChange({ ...clauses, nonCompeteDuration: Number(e.target.value) })}
                />
                <label className={uiLabel} htmlFor="non-compete-radius">
                  Rayon géographique en km <span className="text-rose-600">*</span>
                </label>
                <input
                  id="non-compete-radius"
                  className={`${uiInput} w-full`}
                  type="number"
                  min={0}
                  step={1}
                  value={clauses.nonCompeteRadius ?? 0}
                  onChange={(e) => onChange({ ...clauses, nonCompeteRadius: Number(e.target.value) })}
                />
                <label className={uiLabel} htmlFor="non-compete-zones">
                  Zones territoriales
                </label>
                <input
                  id="non-compete-zones"
                  className={`${uiInput} w-full`}
                  value={clauses.nonCompeteZones ?? ""}
                  onChange={(e) => onChange({ ...clauses, nonCompeteZones: e.target.value })}
                  placeholder="ex: Barneville, Carteret, Cherbourg"
                />
                <label className={uiLabel} htmlFor="non-compete-compensation">
                  Contrepartie financière mensuelle en € <span className="text-rose-600">*</span>
                </label>
                <input
                  id="non-compete-compensation"
                  className={`${uiInput} w-full`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={clauses.nonCompeteCompensation ?? 0}
                  onChange={(e) =>
                    onChange({
                      ...clauses,
                      nonCompeteCompensation: Number(e.target.value),
                      nonCompeteFinancialCompensation: String(Number(e.target.value)),
                    })
                  }
                />
                {!hasPositiveNumber(clauses.nonCompeteCompensation) ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                    ⚠️ Une clause de non-concurrence sans contrepartie financière mensuelle est nulle de plein droit.
                  </p>
                ) : null}
              </div>
            ) : null}
            {key === "delegation" && clauses.delegation ? (
              <div className="mt-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="delegation-missions">
                  Missions déléguées <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="delegation-missions"
                  className={`${uiInput} mt-1 min-h-20 w-full`}
                  value={clauses.delegationMissions ?? ""}
                  onChange={(e) => onChange({ ...clauses, delegationMissions: e.target.value })}
                  placeholder="ex: Respect HACCP et sécurité des équipes"
                />
              </div>
            ) : null}
            {key === "videosurveillance" && clauses.videosurveillance ? (
              <div className="mt-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="cctv-locations">
                  Zones concernées <span className="text-rose-600">*</span>
                </label>
                <input
                  id="cctv-locations"
                  className={`${uiInput} mt-1 w-full`}
                  value={clauses.cctvLocations ?? ""}
                  onChange={(e) => onChange({ ...clauses, cctvLocations: e.target.value })}
                  placeholder="ex: Ligne de caisse, comptoir, réserves"
                />
              </div>
            ) : null}
            {key === "permis" && clauses.permis ? (
              <div className="mt-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="required-driver-license">Permis requis</label>
                <input
                  id="required-driver-license"
                  className={`${uiInput} mt-1 w-full`}
                  value={clauses.requiredDriverLicense ?? ""}
                  onChange={(e) => onChange({ ...clauses, requiredDriverLicense: e.target.value })}
                  placeholder="ex: Permis B, BSR"
                />
              </div>
            ) : null}
            {key === "confidentialiteRenforcee" && clauses.confidentialiteRenforcee ? (
              <div className="mt-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="protected-savoir-faire">
                  Savoir-faire protégé <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="protected-savoir-faire"
                  className={`${uiInput} mt-1 min-h-20 w-full`}
                  value={clauses.protectedSavoirFaire ?? ""}
                  onChange={(e) => onChange({ ...clauses, protectedSavoirFaire: e.target.value })}
                  placeholder="ex: Recettes de la carte, fiches techniques du Chef"
                />
              </div>
            ) : null}
            {key === "tenueTravail" && clauses.tenueTravail ? (
              <div className="mt-2 space-y-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="uniform-list">
                  Tenues fournies ou imposées <span className="text-rose-600">*</span>
                </label>
                <input
                  id="uniform-list"
                  className={`${uiInput} w-full`}
                  value={clauses.uniformProvidedList ?? ""}
                  onChange={(e) => onChange({ ...clauses, uniformProvidedList: e.target.value })}
                  placeholder="Ex. veste, tablier, pantalon noir"
                />
                <label className={uiLabel} htmlFor="laundry-allowance">
                  Indemnité mensuelle d&apos;entretien
                </label>
                <input
                  id="laundry-allowance"
                  className={`${uiInput} w-full`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={clauses.laundryAllowance ?? 0}
                  onChange={(e) => onChange({ ...clauses, laundryAllowance: Number(e.target.value) })}
                  placeholder="Indemnité entretien"
                />
              </div>
            ) : null}
            {key === "heuresComplementaires" && clauses.heuresComplementaires && !complementaryHoursDisabled ? (
              <div className="mt-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="complementary-hours">Plafond heures complémentaires (%)</label>
                <input
                  id="complementary-hours"
                  className={`${uiInput} mt-1 w-full`}
                  type="number"
                  min={0}
                  max={10}
                  value={clauses.maxComplementaryHoursPercent ?? 10}
                  onChange={(e) =>
                    onChange({
                      ...clauses,
                      maxComplementaryHoursPercent: Math.min(Number(e.target.value), 10),
                    })
                  }
                />
              </div>
            ) : null}
            {key === "forfaitJours" && clauses.forfaitJours && !forfaitJoursDisabled ? (
              <div className="mt-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="forfait-days">Forfait jours maximum</label>
                <input
                  id="forfait-days"
                  className={`${uiInput} mt-1 w-full`}
                  type="number"
                  min={0}
                  value={clauses.forfaitJoursMax ?? 218}
                  onChange={(e) => onChange({ ...clauses, forfaitJoursMax: Number(e.target.value) })}
                />
              </div>
            ) : null}
            {key === "remunerationVariable" && clauses.remunerationVariable ? (
              <div className="mt-2 space-y-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="variable-bonus-max">
                  Plafond de prime variable en € <span className="text-rose-600">*</span>
                </label>
                <input
                  id="variable-bonus-max"
                  className={`${uiInput} w-full`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={clauses.variableBonusMax ?? 0}
                  onChange={(e) => onChange({ ...clauses, variableBonusMax: Number(e.target.value) })}
                  placeholder="Plafond prime variable"
                />
                <label className={uiLabel} htmlFor="variable-bonus-criteria">
                  Critères objectifs <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="variable-bonus-criteria"
                  className={`${uiInput} min-h-20 w-full`}
                  value={clauses.variableBonusCriteria ?? ""}
                  onChange={(e) => onChange({ ...clauses, variableBonusCriteria: e.target.value })}
                  placeholder='ex: "Marge brute matières < 28%"'
                />
              </div>
            ) : null}
            {key === "responsabiliteCaisse" && clauses.responsabiliteCaisse ? (
              <div className="mt-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                <label className={uiLabel} htmlFor="pos-terminal">
                  Identifiant caisse / TPE <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pos-terminal"
                  className={`${uiInput} mt-1 w-full`}
                  value={clauses.posTerminalId ?? ""}
                  onChange={(e) => onChange({ ...clauses, posTerminalId: e.target.value })}
                  placeholder="ex: Borne TPE 01"
                />
              </div>
            ) : null}
            {missingRequired ? (
              <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                {requiredWarning}
              </p>
            ) : null}
          </div>
        );
        })}
      </div>
    </aside>
  );
}
