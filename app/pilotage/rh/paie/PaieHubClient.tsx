"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Banknote, ChevronRight, FileWarning, Plus } from "lucide-react";
import {
  uiBadgeEmerald,
  uiBadgeSlate,
  uiBtnPrimary,
  uiCard,
  uiError,
  uiInfoBanner,
  uiInput,
  uiListRow,
  uiMuted,
} from "@/components/ui/premium";
import { createPayrollPeriodAction } from "./actions";
import { formatPeriodMonthLabel, currentYmParis, recentMonths } from "@/lib/rh/payslipMonth";
import { PERIOD_STATUS_LABELS, type PayrollPeriodRow } from "@/lib/rh/payslipTypes";

type Props = {
  restaurantId: string;
  periods: PayrollPeriodRow[];
  hasEmployerSiret: boolean;
};

function statusBadge(status: PayrollPeriodRow["status"]) {
  if (status === "finalized") return uiBadgeEmerald;
  if (status === "draft") return uiBadgeSlate;
  return "inline-flex rounded-lg bg-copper-100 px-2 py-0.5 text-xs font-semibold text-copper-800";
}

export function PaieHubClient({ restaurantId, periods, hasEmployerSiret }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newMonth, setNewMonth] = useState(currentYmParis());

  const periodByMonth = new Map(periods.map((p) => [p.periodMonth, p]));
  const suggestedMonths = recentMonths(6).filter((ym) => !periodByMonth.has(ym));

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createPayrollPeriodAction({ restaurantId, periodYm: newMonth });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/pilotage/rh/paie/${newMonth}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className={uiInfoBanner}>
        <strong>Bulletins de paie</strong> — Vous pouvez établir vos propres bulletins. Le moteur
        applique le barème légal 2026 (PMSS, cotisations, PAS). Pensez à transmettre la DSN mensuelle
        à l&apos;URSSAF. Les <strong>signalements événementiels</strong> (arrêt, fin de contrat) ont un
        délai de 5 jours.
      </div>

      <Link
        href="/pilotage/rh/paie/signalements"
        className={`${uiListRow} border-amber-200/80 bg-amber-50/40`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <FileWarning className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-stone-900">Signalements DSN</p>
            <p className={uiMuted}>Arrêt maladie, reprise, fin de contrat (FCTU)</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-stone-400" aria-hidden />
      </Link>

      {!hasEmployerSiret && (
        <div className={uiError}>
          Complétez le SIRET dans{" "}
          <Link href="/pilotage/rh/administratif" className="font-semibold underline">
            Administratif
          </Link>{" "}
          avant de créer une période.
        </div>
      )}

      <div className={`${uiCard} flex flex-wrap items-end gap-3`}>
        <div className="min-w-[10rem] flex-1">
          <label className={uiMuted}>Nouvelle période</label>
          <input
            type="month"
            className={`${uiInput} mt-1 w-full`}
            value={newMonth}
            onChange={(e) => setNewMonth(e.target.value)}
            disabled={pending || !hasEmployerSiret}
          />
        </div>
        <button
          type="button"
          className={`${uiBtnPrimary} inline-flex items-center gap-2`}
          onClick={handleCreate}
          disabled={pending || !hasEmployerSiret || periodByMonth.has(newMonth)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Créer la période
        </button>
      </div>

      {error && <div className={uiError}>{error}</div>}

      {periods.length === 0 ? (
        <div className={`${uiCard} text-center`}>
          <Banknote className="mx-auto h-10 w-10 text-stone-300" aria-hidden />
          <p className="mt-2 text-sm text-stone-600">Aucune période de paie pour l&apos;instant.</p>
          {suggestedMonths.length > 0 && (
            <p className={uiMuted}>
              Suggestion : {formatPeriodMonthLabel(suggestedMonths[0])}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {periods.map((period) => (
            <Link
              key={period.id}
              href={`/pilotage/rh/paie/${period.periodMonth}`}
              className={uiListRow}
            >
              <div>
                <p className="font-semibold text-stone-900">
                  {formatPeriodMonthLabel(period.periodMonth)}
                </p>
                <p className={uiMuted}>
                  Source {period.hoursSource === "attendance" ? "pointage" : "planning"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={statusBadge(period.status)}>
                  {PERIOD_STATUS_LABELS[period.status]}
                </span>
                <ChevronRight className="h-4 w-4 text-stone-400" aria-hidden />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
