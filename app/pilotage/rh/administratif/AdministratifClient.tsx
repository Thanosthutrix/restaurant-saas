"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Landmark,
  Receipt,
  Shield,
  Users,
  Wrench,
  MoreHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EmployerProfile } from "@/lib/rh/employerProfile";
import type { AdministratifSectorData } from "@/lib/rh/administratifDb";
import {
  ADMINISTRATIF_SECTORS,
  type AdministratifSectorId,
} from "@/lib/rh/administratifSectors";
import type { Supplier } from "@/lib/db";
import { CONVENTION_REGISTRY } from "@/lib/hcr-contracts/conventionRegistry";
import { saveEmployerProfileAction } from "./actions";
import { AdministratifSectorPanel } from "./AdministratifSectorPanel";
import {
  uiBtnPrimary,
  uiCard,
  uiError,
  uiInput,
  uiLabel,
  uiLead,
  uiSectionTitle,
  uiSelect,
  uiSegmentActive,
  uiSegmentIdle,
  uiSuccess,
} from "@/components/ui/premium";

const SECTOR_ICONS: Record<AdministratifSectorId, LucideIcon> = {
  locaux_energies: Building2,
  personnel: Users,
  impots_taxes: Receipt,
  banque_assurances: Shield,
  structure_operationnelle: Wrench,
  autres: MoreHorizontal,
};

export function AdministratifClient({
  restaurantId,
  profile,
  sectors,
  suppliers,
}: {
  restaurantId: string;
  profile: EmployerProfile;
  sectors: AdministratifSectorData[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeSector, setActiveSector] = useState<AdministratifSectorId>("locaux_energies");

  const [form, setForm] = useState({
    legalName: profile.legalName,
    legalForm: profile.legalForm,
    siret: profile.siret,
    urssafOffice: profile.urssafOffice,
    address: profile.address,
    representativeName: profile.representativeName,
    representativeRole: profile.representativeRole,
    collectiveAgreementIdcc: profile.collectiveAgreementIdcc,
    retirementFund: profile.retirementFund,
    healthProvider: profile.healthProvider,
    medecineTravailOrganisme: profile.medecineTravailOrganisme,
  });

  const sectorDataById = useMemo(
    () => Object.fromEntries(sectors.map((s) => [s.id, s])) as Record<AdministratifSectorId, AdministratifSectorData>,
    [sectors]
  );

  const activeConfig = ADMINISTRATIF_SECTORS.find((s) => s.id === activeSector)!;
  const ActiveIcon = SECTOR_ICONS[activeSector];

  function patch(next: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...next }));
    setSaved(false);
  }

  function saveProfile() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveEmployerProfileAction({ restaurantId, profile: form });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const profileComplete = Boolean(
    form.legalName.trim() &&
      form.siret.trim() &&
      form.urssafOffice.trim() &&
      form.address.trim() &&
      form.representativeName.trim() &&
      form.retirementFund.trim() &&
      form.healthProvider.trim()
  );

  return (
    <div className="space-y-10">
      {/* ── Identité employeur ── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={uiSectionTitle}>Votre établissement employeur</h2>
            <p className={`mt-1 max-w-2xl ${uiLead}`}>
              Ces informations alimentent vos contrats de travail. Renseignez-les une fois, réutilisez-les à chaque
              embauche.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              profileComplete ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
            }`}
          >
            {profileComplete ? "Prêt pour les contrats" : "À compléter"}
          </span>
        </div>

        {error ? <p className={uiError}>{error}</p> : null}
        {saved ? <p className={uiSuccess}>Profil employeur enregistré.</p> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={uiCard}>
            <h3 className="text-sm font-semibold text-stone-900">Identité légale</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 sm:col-span-2">
                <span className={uiLabel}>Nom commercial</span>
                <input className={`${uiInput} w-full`} value={profile.companyName} disabled />
              </label>
              <label className="space-y-1">
                <span className={uiLabel}>Raison sociale</span>
                <input
                  className={`${uiInput} w-full`}
                  value={form.legalName}
                  onChange={(e) => patch({ legalName: e.target.value })}
                  placeholder="SARL Le Bistrot"
                />
              </label>
              <label className="space-y-1">
                <span className={uiLabel}>Forme juridique</span>
                <input
                  className={`${uiInput} w-full`}
                  value={form.legalForm}
                  onChange={(e) => patch({ legalForm: e.target.value })}
                  placeholder="SARL, SAS…"
                />
              </label>
              <label className="space-y-1">
                <span className={uiLabel}>SIRET</span>
                <input
                  className={`${uiInput} w-full`}
                  value={form.siret}
                  onChange={(e) => patch({ siret: e.target.value })}
                  placeholder="14 chiffres"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className={uiLabel}>Adresse</span>
                <input
                  className={`${uiInput} w-full`}
                  value={form.address}
                  onChange={(e) => patch({ address: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className={uiLabel}>Représentant légal</span>
                <input
                  className={`${uiInput} w-full`}
                  value={form.representativeName}
                  onChange={(e) => patch({ representativeName: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className={uiLabel}>Fonction</span>
                <input
                  className={`${uiInput} w-full`}
                  value={form.representativeRole}
                  onChange={(e) => patch({ representativeRole: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className={uiCard}>
            <h3 className="text-sm font-semibold text-stone-900">Organismes & convention</h3>
            <div className="mt-4 grid gap-3">
              <label className="space-y-1">
                <span className={uiLabel}>URSSAF</span>
                <input
                  className={`${uiInput} w-full`}
                  value={form.urssafOffice}
                  onChange={(e) => patch({ urssafOffice: e.target.value })}
                  placeholder="Ex. URSSAF Île-de-France"
                />
              </label>
              <label className="space-y-1">
                <span className={uiLabel}>Convention collective (IDCC)</span>
                <select
                  className={`${uiSelect} w-full`}
                  value={form.collectiveAgreementIdcc}
                  onChange={(e) => patch({ collectiveAgreementIdcc: e.target.value })}
                >
                  {Object.entries(CONVENTION_REGISTRY).map(([idcc, cfg]) => (
                    <option key={idcc} value={idcc}>
                      {idcc} — {cfg.shortLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={uiLabel}>Caisse de retraite</span>
                <input
                  className={`${uiInput} w-full`}
                  value={form.retirementFund}
                  onChange={(e) => patch({ retirementFund: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className={uiLabel}>Mutuelle / prévoyance</span>
                <input
                  className={`${uiInput} w-full`}
                  value={form.healthProvider}
                  onChange={(e) => patch({ healthProvider: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className={uiLabel}>Médecine du travail</span>
                <input
                  className={`${uiInput} w-full`}
                  value={form.medecineTravailOrganisme}
                  onChange={(e) => patch({ medecineTravailOrganisme: e.target.value })}
                />
              </label>
            </div>
          </div>
        </div>

        <button type="button" className={uiBtnPrimary} disabled={pending} onClick={saveProfile}>
          {pending ? "Enregistrement…" : "Enregistrer le profil employeur"}
        </button>
      </section>

      {/* ── Dépenses par rubrique ── */}
      <section className="space-y-5">
        <div>
          <h2 className={uiSectionTitle}>Vos charges fixes</h2>
          <p className={`mt-1 max-w-2xl ${uiLead}`}>
            Choisissez une rubrique, renseignez seulement ce qui vous concerne. Pas de jargon comptable — chaque espace
            regroupe ce qui va ensemble.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {ADMINISTRATIF_SECTORS.map((sector) => {
            const Icon = SECTOR_ICONS[sector.id];
            const count =
              (sectorDataById[sector.id]?.charges.length ?? 0) +
              (sectorDataById[sector.id]?.investments.length ?? 0) +
              (sectorDataById[sector.id]?.invoices.length ?? 0);
            const active = activeSector === sector.id;
            return (
              <button
                key={sector.id}
                type="button"
                onClick={() => setActiveSector(sector.id)}
                className={active ? uiSegmentActive : uiSegmentIdle}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {sector.label}
                  {count > 0 ? (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className={`${uiCard} overflow-hidden`}>
          <div className="flex items-start gap-3 border-b border-stone-100 pb-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${activeConfig.tone}`}>
              <ActiveIcon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-semibold text-stone-900">{activeConfig.label}</h3>
              <p className="text-sm text-stone-500">{activeConfig.subtitle}</p>
            </div>
          </div>
          <div className="pt-5">
            <AdministratifSectorPanel
              restaurantId={restaurantId}
              config={activeConfig}
              data={sectorDataById[activeSector]}
              suppliers={suppliers}
            />
          </div>
        </div>

        <p className={`flex items-start gap-2 ${uiLead}`}>
          <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
          Les achats alimentaires (matières premières) restent dans{" "}
          <a href="/achats" className="font-semibold text-copper-800 underline">
            Achats & stock
          </a>
          . Ces rubriques alimentent le bilan « Ma poche ».
        </p>
      </section>
    </div>
  );
}
