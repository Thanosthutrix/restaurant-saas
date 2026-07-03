"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Boxes, FileClock, FileText, Sparkles, Thermometer, Truck } from "lucide-react";
import type { RegistresTab } from "@/lib/registres/types";
import { REGISTRES_TABS, REGISTRES_TAB_LABELS } from "@/lib/registres/types";
import {
  HYGIENE_RISK_LABEL_FR,
  type HygieneRiskLevel,
} from "@/lib/hygiene/types";
import {
  TEMPERATURE_LOG_STATUS_LABEL_FR,
  type TemperatureLogStatus,
} from "@/lib/haccpTemperature/types";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { uiTableLink } from "@/components/ui/premium";

const PILL: Record<string, string> = {
  stone: "bg-stone-100 text-stone-700",
  sky: "bg-sky-100 text-sky-800",
  emerald: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-900",
  rose: "bg-rose-100 text-rose-800",
};

function Pill({ label, tone }: { label: string; tone: keyof typeof PILL }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${PILL[tone]}`}>{label}</span>
  );
}

const BL_STATUS: Record<string, { label: string; tone: keyof typeof PILL }> = {
  draft: { label: "Brouillon", tone: "stone" },
  validated: { label: "Validé", tone: "sky" },
  received: { label: "Reçu", tone: "emerald" },
};

const INVOICE_STATUS: Record<string, { label: string; tone: keyof typeof PILL }> = {
  draft: { label: "À traiter", tone: "amber" },
  linked: { label: "À contrôler", tone: "sky" },
  reviewed: { label: "Prête comptable", tone: "emerald" },
};

const RISK_TONE: Record<HygieneRiskLevel, keyof typeof PILL> = {
  critical: "rose",
  important: "amber",
  standard: "stone",
};

const TEMP_TONE: Record<TemperatureLogStatus, keyof typeof PILL> = {
  normal: "emerald",
  alert: "amber",
  critical: "rose",
};

export type RegistresBlItem = {
  id: string;
  supplierName: string;
  dateLabel: string;
  number: string | null;
  status: string;
  linesCount: number;
  href: string;
};

export type RegistresInvoiceItem = {
  id: string;
  supplierName: string;
  dateLabel: string;
  number: string | null;
  status: string;
  amountLabel: string | null;
  href: string;
};

export type RegistresCleaningItem = {
  id: string;
  completedAtLabel: string;
  elementName: string;
  categoryLabel: string;
  areaLabel: string;
  riskLevel: HygieneRiskLevel;
  riskLabel: string;
  actionLabel: string;
  byLabel: string;
  comment: string | null;
  href: string;
};

export type RegistresTemperatureItem = {
  id: string;
  dateLabel: string;
  pointName: string;
  pointTypeLabel: string;
  value: number;
  status: TemperatureLogStatus;
  byLabel: string;
  comment: string | null;
  href: string;
};

export type RegistresPreparationItem = {
  id: string;
  startedAtLabel: string;
  lotReference: string | null;
  label: string;
  tempEndLabel: string | null;
  temp2hLabel: string | null;
  dlcLabel: string | null;
  byLabel: string;
  href: string;
};

type Props = {
  initialTab: RegistresTab;
  bl: RegistresBlItem[];
  invoices: RegistresInvoiceItem[];
  cleaning: RegistresCleaningItem[];
  temperatures: RegistresTemperatureItem[];
  preparations: RegistresPreparationItem[];
};

const TAB_META: Record<RegistresTab, { icon: LucideIcon; tone: string }> = {
  bl: { icon: Truck, tone: "bg-sky-50 text-sky-700" },
  factures: { icon: FileText, tone: "bg-amber-50 text-amber-700" },
  nettoyage: { icon: Sparkles, tone: "bg-cyan-50 text-cyan-700" },
  temperatures: { icon: Thermometer, tone: "bg-violet-50 text-violet-700" },
  preparations: { icon: Boxes, tone: "bg-emerald-50 text-emerald-700" },
};

const TABLE_WRAP = "overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm";
const THEAD = "border-b border-stone-100 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wide text-stone-500";
const ROW = "cursor-pointer border-b border-stone-50 transition hover:bg-copper-50/40";
const TD = "px-3 py-2.5 align-top";

export function RegistresClient({ initialTab, bl, invoices, cleaning, temperatures, preparations }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as RegistresTab | null) ?? initialTab;

  function setTab(next: RegistresTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/registres?${params.toString()}`, { scroll: false });
  }

  const counts: Record<RegistresTab, number> = {
    bl: bl.length,
    factures: invoices.length,
    nettoyage: cleaning.length,
    temperatures: temperatures.length,
    preparations: preparations.length,
  };

  return (
    <PageContainer>
      <PageHeader
        accentIcon={FileClock}
        accentTone="bg-blue-50 text-blue-700"
        eyebrow="Recherche & contrôle"
        title="Registres"
        subtitle="Tous vos historiques et justificatifs au même endroit. Choisissez un registre, puis ouvrez une entrée pour accéder à sa fiche détaillée."
      />

      {/* Sélecteur = cartes compteurs par registre */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Registres">
        {REGISTRES_TABS.map((key) => {
          const active = tab === key;
          const meta = TAB_META[key];
          const Icon = meta.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={active}
              className={`flex items-center gap-3 rounded-2xl border p-3 text-left shadow-sm transition ${
                active
                  ? "border-copper-300 bg-copper-50/50 ring-1 ring-copper-200"
                  : "border-stone-200/70 bg-white hover:-translate-y-0.5 hover:border-copper-200 hover:shadow-md"
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-semibold tabular-nums leading-none tracking-tight text-stone-900">
                  {counts[key]}
                </p>
                <p className="mt-1 truncate text-xs font-medium text-stone-500">{REGISTRES_TAB_LABELS[key]}</p>
              </div>
            </button>
          );
        })}
      </section>

      {/* ═══ BL ═══ */}
      {tab === "bl" ? (
        bl.length === 0 ? (
          <EmptyState icon={Truck} title="Aucun bon de livraison" description="Les BL enregistrés à la réception apparaîtront ici." />
        ) : (
          <div className={TABLE_WRAP}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className={THEAD}>
                    <th className="px-3 py-2.5">Fournisseur</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">N° BL</th>
                    <th className="px-3 py-2.5 text-right">Lignes</th>
                    <th className="px-3 py-2.5">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {bl.map((r) => {
                    const s = BL_STATUS[r.status] ?? { label: r.status, tone: "stone" as const };
                    return (
                      <tr key={r.id} className={ROW} onClick={() => router.push(r.href)}>
                        <td className={TD}>
                          <Link href={r.href} className={uiTableLink}>
                            {r.supplierName}
                          </Link>
                        </td>
                        <td className={`${TD} whitespace-nowrap text-stone-600`}>{r.dateLabel}</td>
                        <td className={`${TD} text-stone-700`}>{r.number ?? "—"}</td>
                        <td className={`${TD} text-right tabular-nums text-stone-700`}>{r.linesCount}</td>
                        <td className={TD}>
                          <Pill label={s.label} tone={s.tone} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}

      {/* ═══ Factures ═══ */}
      {tab === "factures" ? (
        invoices.length === 0 ? (
          <EmptyState icon={FileText} title="Aucune facture fournisseur" description="Les factures importées apparaîtront ici." />
        ) : (
          <div className={TABLE_WRAP}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className={THEAD}>
                    <th className="px-3 py-2.5">Facture</th>
                    <th className="px-3 py-2.5">Fournisseur</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5 text-right">Montant</th>
                    <th className="px-3 py-2.5">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((r) => {
                    const s = INVOICE_STATUS[r.status] ?? { label: r.status, tone: "stone" as const };
                    return (
                      <tr key={r.id} className={ROW} onClick={() => router.push(r.href)}>
                        <td className={TD}>
                          <Link href={r.href} className={uiTableLink}>
                            {r.number ? `Facture ${r.number}` : "Facture sans n°"}
                          </Link>
                        </td>
                        <td className={`${TD} text-stone-700`}>{r.supplierName}</td>
                        <td className={`${TD} whitespace-nowrap text-stone-600`}>{r.dateLabel}</td>
                        <td className={`${TD} whitespace-nowrap text-right tabular-nums text-stone-800`}>
                          {r.amountLabel ?? "—"}
                        </td>
                        <td className={TD}>
                          <Pill label={s.label} tone={s.tone} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}

      {/* ═══ Nettoyage ═══ */}
      {tab === "nettoyage" ? (
        cleaning.length === 0 ? (
          <EmptyState icon={Sparkles} title="Aucune validation de nettoyage" description="Les tâches de nettoyage validées apparaîtront ici." />
        ) : (
          <div className={TABLE_WRAP}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className={THEAD}>
                    <th className="px-3 py-2.5">Élément</th>
                    <th className="px-3 py-2.5">Criticité</th>
                    <th className="px-3 py-2.5">Intervention</th>
                    <th className="px-3 py-2.5">Par</th>
                    <th className="px-3 py-2.5">Réalisé le</th>
                  </tr>
                </thead>
                <tbody>
                  {cleaning.map((r) => (
                    <tr key={r.id} className={ROW} onClick={() => router.push(r.href)}>
                      <td className={TD}>
                        <Link href={r.href} className={uiTableLink}>
                          {r.elementName}
                        </Link>
                        <span className="block text-xs text-stone-400">
                          {[r.categoryLabel, r.areaLabel].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td className={TD}>
                        <Pill label={HYGIENE_RISK_LABEL_FR[r.riskLevel]} tone={RISK_TONE[r.riskLevel]} />
                      </td>
                      <td className={`${TD} text-stone-700`}>{r.actionLabel}</td>
                      <td className={`${TD} text-stone-700`}>{r.byLabel}</td>
                      <td className={`${TD} whitespace-nowrap text-stone-600`}>{r.completedAtLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}

      {/* ═══ Températures ═══ */}
      {tab === "temperatures" ? (
        temperatures.length === 0 ? (
          <EmptyState icon={Thermometer} title="Aucun relevé de température" description="Les relevés HACCP apparaîtront ici." />
        ) : (
          <div className={TABLE_WRAP}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead>
                  <tr className={THEAD}>
                    <th className="px-3 py-2.5">Point</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5 text-center">Mesure</th>
                    <th className="px-3 py-2.5">Statut</th>
                    <th className="px-3 py-2.5">Par</th>
                    <th className="px-3 py-2.5">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {temperatures.map((r) => (
                    <tr key={r.id} className={ROW} onClick={() => router.push(r.href)}>
                      <td className={TD}>
                        <Link href={r.href} className={uiTableLink}>
                          {r.pointName}
                        </Link>
                      </td>
                      <td className={`${TD} text-stone-600`}>{r.pointTypeLabel}</td>
                      <td className={`${TD} text-center`}>
                        <span className="inline-flex items-center justify-center rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-stone-800">
                          {String(r.value).replace(".", ",")}°
                        </span>
                      </td>
                      <td className={TD}>
                        <Pill label={TEMPERATURE_LOG_STATUS_LABEL_FR[r.status]} tone={TEMP_TONE[r.status]} />
                      </td>
                      <td className={`${TD} text-stone-700`}>{r.byLabel}</td>
                      <td className={`${TD} whitespace-nowrap text-stone-600`}>{r.dateLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}

      {/* ═══ Préparations ═══ */}
      {tab === "preparations" ? (
        preparations.length === 0 ? (
          <EmptyState icon={Boxes} title="Aucune préparation" description="Les lots de préparation enregistrés apparaîtront ici." />
        ) : (
          <div className={TABLE_WRAP}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className={THEAD}>
                    <th className="px-3 py-2.5">Préparation</th>
                    <th className="px-3 py-2.5">N° lot</th>
                    <th className="px-3 py-2.5 text-center">T° fin</th>
                    <th className="px-3 py-2.5 text-center">T° +2 h</th>
                    <th className="px-3 py-2.5">DLC</th>
                    <th className="px-3 py-2.5">Démarrée le</th>
                  </tr>
                </thead>
                <tbody>
                  {preparations.map((r) => (
                    <tr key={r.id} className={ROW} onClick={() => router.push(r.href)}>
                      <td className={TD}>
                        <Link href={r.href} className={uiTableLink}>
                          {r.label}
                        </Link>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {r.lotReference ? (
                          <span className="rounded-md bg-copper-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-copper-800">
                            {r.lotReference}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className={`${TD} text-center tabular-nums text-stone-700`}>{r.tempEndLabel ?? "—"}</td>
                      <td className={`${TD} text-center tabular-nums text-stone-700`}>{r.temp2hLabel ?? "—"}</td>
                      <td className={`${TD} whitespace-nowrap text-stone-700`}>{r.dlcLabel ?? "—"}</td>
                      <td className={`${TD} whitespace-nowrap text-stone-600`}>{r.startedAtLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}
    </PageContainer>
  );
}
