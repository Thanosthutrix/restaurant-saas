"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import type { RegistresTab } from "@/lib/registres/types";
import { REGISTRES_TABS, REGISTRES_TAB_LABELS } from "@/lib/registres/types";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_CLEANING_ACTION_LABEL_FR,
  HYGIENE_RISK_LABEL_FR,
  type HygieneCleaningActionType,
} from "@/lib/hygiene/types";
import {
  TEMPERATURE_LOG_STATUS_LABEL_FR,
  TEMPERATURE_POINT_TYPE_LABEL_FR,
  type TemperatureLogStatus,
} from "@/lib/haccpTemperature/types";
import { uiCard, uiLead, uiPageTitle } from "@/components/ui/premium";

const BL_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  validated: "Validé",
  received: "Reçu",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "À traiter",
  linked: "À contrôler",
  reviewed: "Prête comptable",
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

function RegisterRow({
  href,
  title,
  subtitle,
  meta,
  badge,
}: {
  href: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={`${uiCard} group flex items-start justify-between gap-3 transition hover:-translate-y-0.5 hover:border-copper-100 hover:shadow-md`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-900 group-hover:text-copper-900">{title}</p>
        {subtitle ? <p className="mt-0.5 text-sm text-stone-600">{subtitle}</p> : null}
        {meta ? <p className="mt-1 text-xs text-stone-500">{meta}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {badge ? (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">{badge}</span>
        ) : null}
        <ArrowUpRight className="h-4 w-4 text-stone-300 transition group-hover:text-copper-600" aria-hidden />
      </div>
    </Link>
  );
}

function EmptyTab({ message }: { message: string }) {
  return <p className={`${uiLead} rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-8 text-center`}>{message}</p>;
}

export function RegistresClient({
  initialTab,
  bl,
  invoices,
  cleaning,
  temperatures,
  preparations,
}: Props) {
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
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper-700">Recherche & contrôle</p>
        <h1 className={`${uiPageTitle} mt-2`}>Registres</h1>
        <p className={`${uiLead} mt-2 max-w-2xl`}>
          Historiques et justificatifs : ouvrez une entrée pour accéder à la fiche détaillée (BL, facture, élément
          d’hygiène, relevé ou préparation).
        </p>
      </header>

      <div className="overflow-x-auto border-b border-stone-200">
        <nav className="-mb-px flex min-w-max gap-1" aria-label="Registres">
          {REGISTRES_TABS.map((key) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "border-copper-700 text-copper-800"
                    : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800"
                }`}
              >
                {REGISTRES_TAB_LABELS[key]}
                <span className={`ml-1.5 tabular-nums ${active ? "text-copper-600" : "text-stone-400"}`}>
                  ({counts[key]})
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {tab === "bl" && (
        <section className="space-y-2" aria-label="Bons de livraison">
          {bl.length === 0 ? (
            <EmptyTab message="Aucun bon de livraison enregistré." />
          ) : (
            bl.map((row) => (
              <RegisterRow
                key={row.id}
                href={row.href}
                title={row.supplierName}
                subtitle={[row.dateLabel, row.number ? `BL n° ${row.number}` : null].filter(Boolean).join(" · ")}
                meta={`${row.linesCount} ligne${row.linesCount !== 1 ? "s" : ""}`}
                badge={BL_STATUS_LABELS[row.status] ?? row.status}
              />
            ))
          )}
        </section>
      )}

      {tab === "factures" && (
        <section className="space-y-2" aria-label="Factures fournisseurs">
          {invoices.length === 0 ? (
            <EmptyTab message="Aucune facture fournisseur enregistrée." />
          ) : (
            invoices.map((row) => (
              <RegisterRow
                key={row.id}
                href={row.href}
                title={row.number ? `Facture ${row.number}` : "Facture sans numéro"}
                subtitle={row.supplierName}
                meta={[row.dateLabel, row.amountLabel].filter(Boolean).join(" · ")}
                badge={INVOICE_STATUS_LABELS[row.status] ?? row.status}
              />
            ))
          )}
        </section>
      )}

      {tab === "nettoyage" && (
        <section className="space-y-2" aria-label="Registre nettoyage">
          {cleaning.length === 0 ? (
            <EmptyTab message="Aucune tâche de nettoyage validée." />
          ) : (
            cleaning.map((row) => (
              <RegisterRow
                key={row.id}
                href={row.href}
                title={row.elementName}
                subtitle={[row.categoryLabel, row.areaLabel].filter(Boolean).join(" · ")}
                meta={[row.completedAtLabel, row.actionLabel, row.byLabel, row.comment].filter(Boolean).join(" · ")}
                badge={row.riskLabel}
              />
            ))
          )}
        </section>
      )}

      {tab === "temperatures" && (
        <section className="space-y-2" aria-label="Registre températures">
          {temperatures.length === 0 ? (
            <EmptyTab message="Aucun relevé de température enregistré." />
          ) : (
            temperatures.map((row) => (
              <RegisterRow
                key={row.id}
                href={row.href}
                title={row.pointName}
                subtitle={row.pointTypeLabel}
                meta={[row.dateLabel, `${row.value} °C`, row.byLabel, row.comment].filter(Boolean).join(" · ")}
                badge={TEMPERATURE_LOG_STATUS_LABEL_FR[row.status]}
              />
            ))
          )}
        </section>
      )}

      {tab === "preparations" && (
        <section className="space-y-2" aria-label="Registre préparations">
          {preparations.length === 0 ? (
            <EmptyTab message="Aucune préparation enregistrée." />
          ) : (
            preparations.map((row) => (
              <RegisterRow
                key={row.id}
                href={row.href}
                title={row.label}
                subtitle={row.lotReference ? `Lot ${row.lotReference}` : undefined}
                meta={[
                  row.startedAtLabel,
                  row.tempEndLabel ? `T° fin ${row.tempEndLabel}` : null,
                  row.temp2hLabel ? `T° +2 h ${row.temp2hLabel}` : null,
                  row.dlcLabel ? `DLC ${row.dlcLabel}` : null,
                  row.byLabel,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))
          )}
        </section>
      )}
    </div>
  );
}
