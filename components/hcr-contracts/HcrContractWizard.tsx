"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  HCR_CDD_REASONS,
  HCR_JOB_PRESETS,
  minimumHourlyWageFor,
  monthlyGrossFromHourly,
} from "@/lib/hcr-contracts/hcrLegislation";
import {
  CONVENTION_REGISTRY,
  DEFAULT_CONVENTION_IDCC,
  getConventionConfig,
  type ConventionIdcc,
} from "@/lib/hcr-contracts/conventionRegistry";
import { buildContractDocument } from "@/lib/hcr-contracts/buildContractDocument";
import { calculateTrialPeriodLimit } from "@/lib/hcr-contracts/trialPeriod";
import type {
  HcrCddReason,
  HcrContractDraft,
  HcrContractKind,
  HcrEchelon,
  HcrEmployeeStatus,
  HcrJobCode,
  HcrLevel,
} from "@/lib/hcr-contracts/types";
import type { Restaurant } from "@/lib/auth";
import type { StaffMember } from "@/lib/staff/types";
import type { EmployerProfile } from "@/lib/rh/employerProfile";
import { employerProfileToHcrIdentity } from "@/lib/rh/employerProfile";
import {
  uiBtnPrimary,
  uiBtnSecondary,
  uiCard,
  uiError,
  uiInput,
  uiLabel,
  uiSelect,
  uiWarn,
} from "@/components/ui/premium";
import { HcrClauseSidebar } from "./HcrClauseSidebar";
import { saveHcrContractAction } from "@/app/pilotage/rh/contrats/actions";

type Props = {
  restaurant: Restaurant;
  staff: StaffMember[];
  initialDraft?: HcrContractDraft;
  contractId?: string;
  employerProfile?: EmployerProfile | null;
};

const LEVELS: HcrLevel[] = ["1", "2", "3", "4", "5"];
const ECHELONS: HcrEchelon[] = ["1", "2", "3", "4", "elite"];
const STATUSES: { value: HcrEmployeeStatus; label: string }[] = [
  { value: "employee", label: "Ouvrier / Employé" },
  { value: "supervisor", label: "Agent de maîtrise" },
  { value: "executive", label: "Cadre" },
];

const PART_TIME_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function splitDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) ?? "" };
}

function inferCityFromAddress(address: string | null): string {
  const value = address?.trim();
  if (!value) return "";
  const postalMatch = /\b\d{5}\s+([^,\n]+)/.exec(value);
  if (postalMatch?.[1]) return postalMatch[1].trim();
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? "";
}

function buildInitialDraft(
  restaurant: Restaurant,
  staff: StaffMember[],
  employerProfile?: EmployerProfile | null
): HcrContractDraft {
  const firstStaff = staff[0];
  const split = splitDisplayName(firstStaff?.display_name ?? "");
  const preset = HCR_JOB_PRESETS[0];
  const hourly = minimumHourlyWageFor(preset.defaultLevel, preset.defaultEchelon) ?? 11.88;
  const weeklyHours = firstStaff?.target_weekly_hours ?? 35;
  const signatureCity = inferCityFromAddress(restaurant.address_text);
  const employer = employerProfile
    ? employerProfileToHcrIdentity(employerProfile)
    : {
        restaurantId: restaurant.id,
        companyName: restaurant.name,
        legalName: restaurant.name,
        legalForm: "",
        siret: "",
        urssafOffice: "",
        address: restaurant.address_text ?? "",
        representativeName: "",
        representativeRole: "Gérant",
        collectiveAgreementIdcc: DEFAULT_CONVENTION_IDCC,
        retirementFund: "",
        healthProvider: "",
      };
  return {
    contractKind: firstStaff?.contract_type === "cdd" ? "cdd" : "cdi",
    employer,
    employee: {
      staffMemberId: firstStaff?.id,
      firstName: split.firstName,
      lastName: split.lastName,
      address: "",
      socialSecurityNumber: "",
      nationality: "Française",
    },
    jobAndPay: {
      jobCode: preset.code,
      jobTitle: firstStaff?.role_label ?? preset.label,
      missions: "",
      status: preset.defaultStatus,
      level: preset.defaultLevel,
      echelon: preset.defaultEchelon,
      hourlyRateGross: hourly,
      weeklyHours,
      monthlyGross: monthlyGrossFromHourly(hourly, weeklyHours, false, DEFAULT_CONVENTION_IDCC),
    },
    termDetails: {
      reason: null,
      startDate: todayYmd(),
      hasUncertainTerm: false,
      renewalClause: false,
      extraDates: "",
      extraMission: "",
      banquetDate: "",
    },
    clauses: {
      trialPeriod: true,
      workingTimeModulation: false,
      mealBenefits: true,
      overtimePay: weeklyHours > 35,
      workClothes: false,
      nonCompete: false,
      logement: false,
      transport: false,
      materiel: false,
      exclusivite: false,
      image: false,
      dedit: false,
      delegation: false,
      videosurveillance: false,
      permis: false,
      confidentialiteRenforcee: false,
      tenueTravail: false,
      heuresComplementaires: false,
      forfaitJours: false,
      remunerationVariable: false,
      responsabiliteCaisse: false,
      charteInformatique: false,
      travailleurNuit: false,
      isPolyvalenceActive: true,
      mobilityZoneType: "departement",
      isTrialRenewable: true,
      planningNoticeDays: 3,
      mutuelleEmployerShare: 50,
      congesCalculMode: "ouvrables",
      absenceJustificationHours: 48,
      preavisMode: "auto",
      trialPeriodValue: 2,
      trialPeriodUnit: "mois",
      mealBasketAmount: 0,
      housingAddress: "",
      housingValue: 0,
      housingChargesPayer: "Salarié",
      housingEvictionDays: 7,
      transportDeadline: "",
      transportCoveragePercent: 50,
      providedEquipment: "",
      trainingName: "",
      trainingCenter: "",
      trainingCost: 0,
      deditDuration: 0,
      nonCompeteDuration: 12,
      nonCompeteRadius: 10,
      nonCompeteZones: "",
      nonCompeteCompensation: 0,
      mobilityRadius: 10,
      planningScheduleGrid: {},
      customPreavisText: "",
      delegationMissions: "",
      cctvLocations: "",
      requiredDriverLicense: "",
      protectedSavoirFaire: "",
      uniformProvidedList: "",
      laundryAllowance: 0,
      maxComplementaryHoursPercent: 10,
      forfaitJoursMax: 218,
      variableBonusMax: 0,
      variableBonusCriteria: "",
      posTerminalId: "",
      workClothesDescription: "",
      nonCompeteFinancialCompensation: "",
    },
    signatureCity,
    signatureDate: todayYmd(),
  };
}

function printableHtml(documentHtml: string, title: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
body{font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;margin:32px}
h1{font-size:24px;text-align:center;margin:0 0 24px}
h2{font-size:17px;margin:22px 0 8px;break-after:avoid}
h3{font-size:14px;margin:16px 0 6px;break-after:avoid}
p{font-size:12px;margin:0 0 10px}
.signatures{break-inside:avoid;margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:48px}
@page{margin:18mm}
</style></head><body>${documentHtml}<script>window.print()</script></body></html>`;
}

export function HcrContractWizard({
  restaurant,
  staff,
  initialDraft,
  contractId: initialContractId,
  employerProfile,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [contractId, setContractId] = useState(initialContractId);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<HcrContractDraft>(
    () => initialDraft ?? buildInitialDraft(restaurant, staff, employerProfile)
  );
  const document = useMemo(() => buildContractDocument(draft), [draft]);
  const trialLimit = useMemo(() => calculateTrialPeriodLimit(draft), [draft]);
  const selectedIdcc = draft.employer.collectiveAgreementIdcc;
  const currentCCN = getConventionConfig(selectedIdcc);
  const selectedConvention = currentCCN;
  const blockingIssues = document.validationIssues.filter((i) => i.severity === "blocking");
  const warnings = document.validationIssues.filter((i) => i.severity === "warning");

  useEffect(() => {
    queueMicrotask(() => {
      setDraft((prev) => {
        const nextCCN = getConventionConfig(prev.employer.collectiveAgreementIdcc);
        const nextClauses = {
          ...prev.clauses,
          isTrialRenewable: nextCCN.features.allowTrialRenewal ? prev.clauses.isTrialRenewable : false,
          planningNoticeDays: nextCCN.features.defaultPlanningNoticeDays,
          absenceJustificationHours: nextCCN.features.defaultAbsenceJustificationHours,
          mutuelleEmployerShare: Math.max(prev.clauses.mutuelleEmployerShare, nextCCN.features.minMutuelleEmployerShare),
          preavisMode: nextCCN.features.preavisCalculMode === "auto" ? "auto" : prev.clauses.preavisMode,
        };

        if (
          nextClauses.isTrialRenewable === prev.clauses.isTrialRenewable &&
          nextClauses.planningNoticeDays === prev.clauses.planningNoticeDays &&
          nextClauses.absenceJustificationHours === prev.clauses.absenceJustificationHours &&
          nextClauses.mutuelleEmployerShare === prev.clauses.mutuelleEmployerShare &&
          nextClauses.preavisMode === prev.clauses.preavisMode
        ) {
          return prev;
        }

        return { ...prev, clauses: nextClauses };
      });
    });
  }, [selectedIdcc]);

  useEffect(() => {
    queueMicrotask(() => {
      setDraft((prev) => {
        const isPartTime = prev.jobAndPay.weeklyHours < 35;
        const isFullTimeOrMore = prev.jobAndPay.weeklyHours >= 35;
        const isExecutive = prev.jobAndPay.status === "executive";
        const nextClauses = {
          ...prev.clauses,
          exclusivite: isPartTime ? false : prev.clauses.exclusivite,
          heuresComplementaires: isFullTimeOrMore ? false : prev.clauses.heuresComplementaires,
          forfaitJours: isExecutive ? prev.clauses.forfaitJours : false,
        };

        if (
          nextClauses.exclusivite === prev.clauses.exclusivite &&
          nextClauses.heuresComplementaires === prev.clauses.heuresComplementaires &&
          nextClauses.forfaitJours === prev.clauses.forfaitJours
        ) {
          return prev;
        }

        return { ...prev, clauses: nextClauses };
      });
    });
  }, [draft.jobAndPay.weeklyHours, draft.jobAndPay.status]);

  function withTrialDefault(next: HcrContractDraft): HcrContractDraft {
    const limit = calculateTrialPeriodLimit(next);
    return {
      ...next,
      clauses: {
        ...next.clauses,
        trialPeriodValue: limit.defaultValue,
        trialPeriodUnit: limit.unit,
      },
    };
  }

  function patch(next: Partial<HcrContractDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function patchJob(next: Partial<HcrContractDraft["jobAndPay"]>) {
    setDraft((prev) => {
      const jobAndPay = { ...prev.jobAndPay, ...next };
      const draftNext = {
        ...prev,
        jobAndPay: {
          ...jobAndPay,
          monthlyGross: monthlyGrossFromHourly(
            jobAndPay.hourlyRateGross,
            jobAndPay.weeklyHours,
            prev.clauses.workingTimeModulation,
            prev.employer.collectiveAgreementIdcc
          ),
        },
      };
      return next.status ? withTrialDefault(draftNext) : draftNext;
    });
  }

  function selectStaff(staffId: string) {
    const selected = staff.find((m) => m.id === staffId);
    if (!selected) return;
    const split = splitDisplayName(selected.display_name);
    setDraft((prev) =>
      withTrialDefault({
        ...prev,
        employee: { ...prev.employee, staffMemberId: selected.id, firstName: split.firstName, lastName: split.lastName },
        contractKind: selected.contract_type === "cdd" ? "cdd" : prev.contractKind,
        jobAndPay: {
          ...prev.jobAndPay,
          jobTitle: selected.role_label ?? prev.jobAndPay.jobTitle,
          weeklyHours: selected.target_weekly_hours ?? prev.jobAndPay.weeklyHours,
          monthlyGross: monthlyGrossFromHourly(
            prev.jobAndPay.hourlyRateGross,
            selected.target_weekly_hours ?? prev.jobAndPay.weeklyHours,
            prev.clauses.workingTimeModulation,
            prev.employer.collectiveAgreementIdcc
          ),
        },
      })
    );
  }

  function selectConvention(idcc: ConventionIdcc) {
    setDraft((prev) => {
      const convention = getConventionConfig(idcc);
      const next = withTrialDefault({
        ...prev,
        employer: {
          ...prev.employer,
          collectiveAgreementIdcc: idcc,
        },
        clauses: {
          ...prev.clauses,
          isTrialRenewable: convention.features.allowTrialRenewal,
          planningNoticeDays: convention.features.defaultPlanningNoticeDays,
          mutuelleEmployerShare: convention.features.minMutuelleEmployerShare,
          absenceJustificationHours: convention.features.defaultAbsenceJustificationHours,
          preavisMode: convention.features.preavisCalculMode === "auto" ? "auto" : prev.clauses.preavisMode,
        },
      });

      return {
        ...next,
        jobAndPay: {
          ...next.jobAndPay,
          monthlyGross: monthlyGrossFromHourly(
            next.jobAndPay.hourlyRateGross,
            next.jobAndPay.weeklyHours,
            next.clauses.workingTimeModulation,
            idcc
          ),
        },
      };
    });
  }

  function patchClauses(clauses: HcrContractDraft["clauses"]) {
    setDraft((prev) => ({
      ...prev,
      clauses: {
        ...clauses,
        exclusivite: prev.jobAndPay.weeklyHours < 35 ? false : clauses.exclusivite,
        heuresComplementaires: prev.jobAndPay.weeklyHours >= 35 ? false : clauses.heuresComplementaires,
        forfaitJours: prev.jobAndPay.status === "executive" ? clauses.forfaitJours : false,
        maxComplementaryHoursPercent: Math.min(clauses.maxComplementaryHoursPercent ?? 10, 10),
      },
      jobAndPay: {
        ...prev.jobAndPay,
        monthlyGross: monthlyGrossFromHourly(
          prev.jobAndPay.hourlyRateGross,
          prev.jobAndPay.weeklyHours,
        clauses.workingTimeModulation,
          prev.employer.collectiveAgreementIdcc
        ),
      },
    }));
  }

  function selectJob(code: HcrJobCode) {
    const preset = HCR_JOB_PRESETS.find((p) => p.code === code);
    if (!preset) return;
    const minimum = minimumHourlyWageFor(preset.defaultLevel, preset.defaultEchelon) ?? draft.jobAndPay.hourlyRateGross;
    patchJob({
      jobCode: preset.code,
      jobTitle: preset.label,
      status: preset.defaultStatus,
      level: preset.defaultLevel,
      echelon: preset.defaultEchelon,
      hourlyRateGross: Math.max(draft.jobAndPay.hourlyRateGross, minimum),
    });
  }

  function exportPdf() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(printableHtml(document.html, document.title));
    win.document.close();
  }

  function saveContract(status: "draft" | "exported") {
    setSaveError(null);
    setSaveMessage(null);
    startTransition(async () => {
      const res = await saveHcrContractAction({
        restaurantId: restaurant.id,
        draft,
        contractId,
        status,
      });
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      const id = res.data!.id;
      setContractId(id);
      setSaveMessage(status === "exported" ? "Contrat enregistré et marqué comme exporté." : "Brouillon enregistré.");
      if (!initialContractId) {
        router.replace(`/pilotage/rh/contrats/${id}`);
      } else {
        router.refresh();
      }
    });
  }

  function exportPdfAndSave() {
    exportPdf();
    saveContract("exported");
  }

  const showTerm = draft.contractKind === "cdd" || draft.contractKind === "saisonnier";
  const showExtra = draft.contractKind === "extra";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        {blockingIssues.length > 0 ? (
          <div className={uiError}>
            <p className="font-semibold">Informations obligatoires manquantes</p>
            <ul className="mt-1 list-inside list-disc text-xs">
              {blockingIssues.slice(0, 8).map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {warnings.map((issue) => (
          <p key={issue.path} className={uiWarn}>{issue.message}</p>
        ))}

        <section className={uiCard}>
          <h2 className="text-base font-semibold text-stone-900">1. Lien employeur — salarié</h2>
          <p className="mt-1 text-sm text-stone-500">
            Ces informations alimentent l&apos;en-tête du contrat (« Entre les soussignés ») et les clauses suivantes.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className={uiLabel}>Convention collective applicable</span>
              <select
                className={`${uiSelect} w-full`}
                value={selectedConvention.idcc}
                onChange={(e) => selectConvention(e.target.value as ConventionIdcc)}
              >
                {Object.values(CONVENTION_REGISTRY).map((convention) => (
                  <option key={convention.idcc} value={convention.idcc}>
                    {convention.shortLabel} - IDCC {convention.idcc}
                  </option>
                ))}
              </select>
            </label>
            {selectedConvention.idcc === "1501" ? (
              <label className="space-y-1 sm:col-span-2">
                <span className={uiLabel}>Montant du panier repas</span>
                <input
                  className={`${uiInput} w-full`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.clauses.mealBasketAmount}
                  onChange={(e) =>
                    patchClauses({ ...draft.clauses, mealBasketAmount: Number(e.target.value) })
                  }
                />
              </label>
            ) : null}
            <label className="space-y-1">
              <span className={uiLabel}>Collaborateur ERP</span>
              <select className={`${uiSelect} w-full`} value={draft.employee.staffMemberId ?? ""} onChange={(e) => selectStaff(e.target.value)}>
                <option value="">Nouveau salarié</option>
                {staff.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className={uiLabel}>Type de contrat</span>
              <select
                className={`${uiSelect} w-full`}
                value={draft.contractKind}
                onChange={(e) =>
                  setDraft((prev) => withTrialDefault({ ...prev, contractKind: e.target.value as HcrContractKind }))
                }
              >
                <option value="cdi">CDI</option>
                <option value="cdd">CDD</option>
                <option value="saisonnier">Saisonnier</option>
                <option value="extra">Extra</option>
              </select>
            </label>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-stone-200/70 bg-stone-50/50 p-4">
              <h3 className="text-sm font-semibold text-stone-900">L&apos;employeur</h3>
              <input className={`${uiInput} w-full`} placeholder="Raison sociale" value={draft.employer.legalName} onChange={(e) => patch({ employer: { ...draft.employer, legalName: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="Forme juridique (SARL, SAS…)" value={draft.employer.legalForm} onChange={(e) => patch({ employer: { ...draft.employer, legalForm: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="SIRET" value={draft.employer.siret} onChange={(e) => patch({ employer: { ...draft.employer, siret: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="URSSAF de rattachement" value={draft.employer.urssafOffice} onChange={(e) => patch({ employer: { ...draft.employer, urssafOffice: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="Adresse de l'établissement" value={draft.employer.address} onChange={(e) => patch({ employer: { ...draft.employer, address: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="Représentant légal" value={draft.employer.representativeName} onChange={(e) => patch({ employer: { ...draft.employer, representativeName: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="Qualité (Gérant, Président…)" value={draft.employer.representativeRole} onChange={(e) => patch({ employer: { ...draft.employer, representativeRole: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="Caisse de retraite" value={draft.employer.retirementFund} onChange={(e) => patch({ employer: { ...draft.employer, retirementFund: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="Mutuelle / prévoyance" value={draft.employer.healthProvider} onChange={(e) => patch({ employer: { ...draft.employer, healthProvider: e.target.value } })} />
            </div>

            <div className="space-y-3 rounded-2xl border border-stone-200/70 bg-stone-50/50 p-4">
              <h3 className="text-sm font-semibold text-stone-900">Le salarié</h3>
              <input className={`${uiInput} w-full`} placeholder="Prénom" value={draft.employee.firstName} onChange={(e) => patch({ employee: { ...draft.employee, firstName: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="Nom" value={draft.employee.lastName} onChange={(e) => patch({ employee: { ...draft.employee, lastName: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="Adresse" value={draft.employee.address} onChange={(e) => patch({ employee: { ...draft.employee, address: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="N° sécurité sociale" value={draft.employee.socialSecurityNumber} onChange={(e) => patch({ employee: { ...draft.employee, socialSecurityNumber: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="Nationalité" value={draft.employee.nationality} onChange={(e) => patch({ employee: { ...draft.employee, nationality: e.target.value } })} />
              <input className={`${uiInput} w-full`} type="date" placeholder="Date de naissance" value={draft.employee.birthDate ?? ""} onChange={(e) => patch({ employee: { ...draft.employee, birthDate: e.target.value } })} />
              <input className={`${uiInput} w-full`} placeholder="Lieu de naissance" value={draft.employee.birthPlace ?? ""} onChange={(e) => patch({ employee: { ...draft.employee, birthPlace: e.target.value } })} />
            </div>
          </div>
        </section>

        <section className={uiCard}>
          <h2 className="text-base font-semibold text-stone-900">2. Poste, convention & rémunération</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select className={uiSelect} value={draft.jobAndPay.jobCode} onChange={(e) => selectJob(e.target.value as HcrJobCode)}>
              {HCR_JOB_PRESETS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
            <select className={uiSelect} value={draft.jobAndPay.status} onChange={(e) => patchJob({ status: e.target.value as HcrEmployeeStatus })}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select className={uiSelect} value={draft.jobAndPay.level} onChange={(e) => patchJob({ level: e.target.value as HcrLevel })}>
              {LEVELS.map((level) => <option key={level} value={level}>Niveau {level}</option>)}
            </select>
            <select className={uiSelect} value={draft.jobAndPay.echelon} onChange={(e) => patchJob({ echelon: e.target.value as HcrEchelon })}>
              {ECHELONS.map((echelon) => <option key={echelon} value={echelon}>Échelon {echelon}</option>)}
            </select>
            <input className={uiInput} type="number" step="0.01" min={0} value={draft.jobAndPay.hourlyRateGross} onChange={(e) => patchJob({ hourlyRateGross: Number(e.target.value) })} />
            <input className={uiInput} type="number" step="0.5" min={1} value={draft.jobAndPay.weeklyHours} onChange={(e) => patchJob({ weeklyHours: Number(e.target.value) })} />
          </div>
          <label className="mt-3 block space-y-1">
            <span className={uiLabel}>Missions exactes attendues</span>
            <textarea
              className={`${uiInput} min-h-28 w-full`}
              placeholder="Ex. Accueil des clients, prise de commandes, service en salle, encaissement, entretien du poste..."
              value={draft.jobAndPay.missions}
              onChange={(e) => patchJob({ missions: e.target.value })}
            />
          </label>
          <p className="mt-3 text-sm text-stone-600">
            Brut mensuel calculé : <strong>{draft.jobAndPay.monthlyGross.toFixed(2)} €</strong>
          </p>
          <div className="mt-4 grid gap-3 rounded-2xl border border-stone-100 bg-stone-50/70 p-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={draft.clauses.isPolyvalenceActive}
                onChange={(e) => patchClauses({ ...draft.clauses, isPolyvalenceActive: e.target.checked })}
              />
              Clause de polyvalence active
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={draft.clauses.isTrialRenewable}
                disabled={!selectedConvention.features.allowTrialRenewal}
                onChange={(e) => patchClauses({ ...draft.clauses, isTrialRenewable: e.target.checked })}
              />
              Renouvellement période d&apos;essai
              {!selectedConvention.features.allowTrialRenewal ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                  🔒 Fixé par la CCN {currentCCN.shortLabel}
                </span>
              ) : null}
            </label>
            <label className="space-y-1">
              <span className={uiLabel}>Zone de mobilité</span>
              <select
                className={`${uiSelect} w-full`}
                value={draft.clauses.mobilityZoneType}
                onChange={(e) =>
                  patchClauses({ ...draft.clauses, mobilityZoneType: e.target.value as HcrContractDraft["clauses"]["mobilityZoneType"] })
                }
              >
                <option value="ville">Ville</option>
                <option value="departement">Département</option>
                <option value="radius">Rayon kilométrique</option>
              </select>
            </label>
            {draft.clauses.mobilityZoneType === "radius" ? (
              <label className="space-y-1">
                <span className={uiLabel}>Rayon de mobilité (km)</span>
                <input
                  className={`${uiInput} w-full`}
                  type="number"
                  min={0}
                  value={draft.clauses.mobilityRadius ?? 10}
                  onChange={(e) => patchClauses({ ...draft.clauses, mobilityRadius: Number(e.target.value) })}
                />
              </label>
            ) : null}
            <label className="space-y-1">
              <span className={uiLabel}>Délai prévenance planning</span>
              <input
                className={`${uiInput} w-full`}
                type="number"
                min={selectedConvention.features.defaultPlanningNoticeDays}
                value={draft.clauses.planningNoticeDays}
                onChange={(e) =>
                  patchClauses({
                    ...draft.clauses,
                    planningNoticeDays: Math.max(Number(e.target.value), currentCCN.features.defaultPlanningNoticeDays),
                  })
                }
              />
              <span className="text-[11px] text-amber-600">Minimum CCN : {currentCCN.features.defaultPlanningNoticeDays} jour(s)</span>
            </label>
            <label className="space-y-1">
              <span className={uiLabel}>Part employeur mutuelle (%)</span>
              <input
                className={`${uiInput} w-full ${
                  draft.clauses.mutuelleEmployerShare < currentCCN.features.minMutuelleEmployerShare
                    ? "border-red-500 ring-1 ring-red-200"
                    : ""
                }`}
                type="number"
                min={currentCCN.features.minMutuelleEmployerShare}
                value={draft.clauses.mutuelleEmployerShare}
                onChange={(e) => patchClauses({ ...draft.clauses, mutuelleEmployerShare: Number(e.target.value) })}
              />
              {draft.clauses.mutuelleEmployerShare < currentCCN.features.minMutuelleEmployerShare ? (
                <span className="text-[11px] font-medium text-red-600">
                  Minimum légal : {currentCCN.features.minMutuelleEmployerShare} %
                </span>
              ) : (
                <span className="text-[11px] text-amber-600">Minimum CCN : {currentCCN.features.minMutuelleEmployerShare} %</span>
              )}
            </label>
            <label className="space-y-1">
              <span className={uiLabel}>Mode calcul congés</span>
              <select
                className={`${uiSelect} w-full`}
                value={draft.clauses.congesCalculMode}
                onChange={(e) =>
                  patchClauses({ ...draft.clauses, congesCalculMode: e.target.value as HcrContractDraft["clauses"]["congesCalculMode"] })
                }
              >
                <option value="ouvrables">Jours ouvrables</option>
                <option value="ouvres">Jours ouvrés</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className={uiLabel}>Justificatif absence (heures)</span>
              <input
                className={`${uiInput} w-full`}
                type="number"
                min={selectedConvention.features.defaultAbsenceJustificationHours}
                value={draft.clauses.absenceJustificationHours}
                onChange={(e) =>
                  patchClauses({
                    ...draft.clauses,
                    absenceJustificationHours: Math.max(Number(e.target.value), currentCCN.features.defaultAbsenceJustificationHours),
                  })
                }
              />
              <span className="text-[11px] text-amber-600">Minimum légal : {currentCCN.features.defaultAbsenceJustificationHours} h</span>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className={uiLabel}>Mode préavis</span>
              <select
                className={`${uiSelect} w-full`}
                value={selectedConvention.features.preavisCalculMode === "auto" ? "auto" : draft.clauses.preavisMode}
                disabled={selectedConvention.features.preavisCalculMode === "auto"}
                onChange={(e) => patchClauses({ ...draft.clauses, preavisMode: e.target.value as HcrContractDraft["clauses"]["preavisMode"] })}
              >
                <option value="auto">Automatique CCN</option>
                <option value="custom">Texte personnalisé</option>
              </select>
              {selectedConvention.features.preavisCalculMode === "auto" ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                  🔒 Fixé par la CCN {currentCCN.shortLabel}
                </span>
              ) : null}
            </label>
            {selectedConvention.features.preavisCalculMode === "custom_allowed" && draft.clauses.preavisMode === "custom" ? (
              <label className="space-y-1 sm:col-span-2">
                <span className={uiLabel}>Texte personnalisé de préavis</span>
                <textarea
                  className={`${uiInput} min-h-24 w-full`}
                  value={draft.clauses.customPreavisText ?? ""}
                  onChange={(e) => patchClauses({ ...draft.clauses, customPreavisText: e.target.value })}
                />
              </label>
            ) : null}
            {draft.jobAndPay.weeklyHours < 35 ? (
              <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-3 sm:col-span-2">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Grille obligatoire temps partiel</p>
                  <p className="mt-1 text-xs text-amber-700">
                    La répartition des horaires doit être précisée pour un contrat inférieur à 35h.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {PART_TIME_DAYS.map((day) => (
                    <label key={day} className="space-y-1">
                      <span className={uiLabel}>{day}</span>
                      <input
                        className={`${uiInput} w-full`}
                        placeholder="Ex. 09:00-12:00"
                        value={draft.clauses.planningScheduleGrid?.[day] ?? ""}
                        onChange={(e) =>
                          patchClauses({
                            ...draft.clauses,
                            planningScheduleGrid: {
                              ...(draft.clauses.planningScheduleGrid ?? {}),
                              [day]: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {showTerm ? (
          <section className={uiCard}>
            <h2 className="text-base font-semibold text-stone-900">3. Variables CDD / Saisonnier</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select className={`${uiSelect} w-full`} value={draft.termDetails?.reason ?? ""} onChange={(e) => patch({ termDetails: { ...draft.termDetails!, reason: (e.target.value || null) as HcrCddReason | null } })}>
                <option value="">Motif précis obligatoire</option>
                {Object.entries(HCR_CDD_REASONS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              </select>
              <input className={uiInput} placeholder="Nom du salarié remplacé" value={draft.termDetails?.replacedEmployeeName ?? ""} onChange={(e) => patch({ termDetails: { ...draft.termDetails!, replacedEmployeeName: e.target.value } })} />
              <input className={uiInput} placeholder="Poste du salarié remplacé" value={draft.termDetails?.replacedEmployeePosition ?? ""} onChange={(e) => patch({ termDetails: { ...draft.termDetails!, replacedEmployeePosition: e.target.value } })} />
              <input className={uiInput} type="date" value={draft.termDetails?.startDate ?? ""} onChange={(e) => setDraft((prev) => withTrialDefault({ ...prev, termDetails: { ...prev.termDetails!, startDate: e.target.value } }))} />
              <input className={uiInput} type="date" disabled={draft.termDetails?.hasUncertainTerm} value={draft.termDetails?.endDate ?? ""} onChange={(e) => setDraft((prev) => withTrialDefault({ ...prev, termDetails: { ...prev.termDetails!, endDate: e.target.value } }))} />
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={draft.termDetails?.hasUncertainTerm ?? false} onChange={(e) => patch({ termDetails: { ...draft.termDetails!, hasUncertainTerm: e.target.checked } })} />
                Terme imprécis
              </label>
              {draft.contractKind === "saisonnier" ? (
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={draft.termDetails?.renewalClause ?? false} onChange={(e) => patch({ termDetails: { ...draft.termDetails!, renewalClause: e.target.checked } })} />
                  Clause de reconduction
                </label>
              ) : null}
              <input className={uiInput} placeholder="Durée minimale" value={draft.termDetails?.minimumDuration ?? ""} onChange={(e) => patch({ termDetails: { ...draft.termDetails!, minimumDuration: e.target.value } })} />
            </div>
          </section>
        ) : null}

        {showExtra ? (
          <section className={uiCard}>
            <h2 className="text-base font-semibold text-stone-900">3. Variables Extra</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className={uiInput} placeholder="Date(s) de l'extra" value={draft.termDetails?.extraDates ?? ""} onChange={(e) => patch({ termDetails: { ...draft.termDetails!, extraDates: e.target.value } })} />
              <input className={uiInput} placeholder="Nature de la mission" value={draft.termDetails?.extraMission ?? ""} onChange={(e) => patch({ termDetails: { ...draft.termDetails!, extraMission: e.target.value } })} />
              <input className={uiInput} placeholder="Date du banquet (optionnel)" value={draft.termDetails?.banquetDate ?? ""} onChange={(e) => patch({ termDetails: { ...draft.termDetails!, banquetDate: e.target.value } })} />
            </div>
          </section>
        ) : null}

        <section className={uiCard}>
          <h2 className="text-base font-semibold text-stone-900">4. Signature</h2>
          <p className="mt-1 text-xs text-stone-500">
            Ces informations alimentent la mention “Fait à …, le …” en fin de contrat.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className={uiLabel}>Ville de signature</span>
              <input
                className={`${uiInput} w-full`}
                placeholder="Ex. Paris"
                value={draft.signatureCity}
                onChange={(e) => patch({ signatureCity: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className={uiLabel}>Date de signature</span>
              <input
                className={`${uiInput} w-full`}
                type="date"
                value={draft.signatureDate}
                onChange={(e) => patch({ signatureDate: e.target.value })}
              />
            </label>
          </div>
        </section>

        <section className={uiCard}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-stone-900">Aperçu du contrat</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={uiBtnSecondary}
                disabled={blockingIssues.length > 0 || pending}
                onClick={() => saveContract("draft")}
              >
                {pending ? "Enregistrement…" : "Enregistrer le brouillon"}
              </button>
              <button
                type="button"
                className={uiBtnPrimary}
                disabled={blockingIssues.length > 0 || pending}
                onClick={exportPdfAndSave}
              >
                Export PDF / Imprimer
              </button>
            </div>
          </div>
          {saveError ? <p className={`mt-3 ${uiError}`}>{saveError}</p> : null}
          {saveMessage ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {saveMessage}
            </p>
          ) : null}
          <div className="prose prose-slate mt-4 max-w-none rounded-xl border border-stone-100 bg-white p-4 text-sm" dangerouslySetInnerHTML={{ __html: document.html }} />
        </section>
      </div>

      <div className="space-y-4">
        <HcrClauseSidebar
          clauses={draft.clauses}
          trialLimit={trialLimit}
          weeklyHours={draft.jobAndPay.weeklyHours}
          status={draft.jobAndPay.status}
          onChange={patchClauses}
        />
        <button type="button" className={uiBtnSecondary} onClick={() => navigator.clipboard?.writeText(document.markdown)}>
          Copier le markdown
        </button>
      </div>
    </div>
  );
}
