"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import type { Supplier } from "@/lib/db";
import type { AdministratifSectorData } from "@/lib/rh/administratifDb";
import type { AdministratifSectorConfig } from "@/lib/rh/administratifSectors";
import { deleteFixedChargeAction, saveFixedChargeAction } from "@/app/pilotage/bilan/actions";
import { deleteInvestmentAction, saveInvestmentAction } from "./actions";
import { AdministratifInvoiceUpload } from "./AdministratifInvoiceUpload";
import {
  uiBtnOutlineSm,
  uiBtnPrimarySm,
  uiCardMuted,
  uiError,
  uiInfoBanner,
  uiInput,
  uiListRow,
  uiMuted,
  uiSectionTitleSm,
} from "@/components/ui/premium";

const PERIODICITY_LABELS: Record<string, string> = {
  monthly: "par mois",
  quarterly: "par trimestre",
  yearly: "par an",
};

function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(n: number | null) {
  if (n == null) return "—";
  return `${n.toLocaleString("fr-FR")} €`;
}

export function AdministratifSectorPanel({
  restaurantId,
  config,
  data,
  suppliers,
}: {
  restaurantId: string;
  config: AdministratifSectorConfig;
  data: AdministratifSectorData;
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [chargeLabel, setChargeLabel] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargePeriodicity, setChargePeriodicity] = useState<"monthly" | "quarterly" | "yearly">("monthly");

  const [invLabel, setInvLabel] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [invDate, setInvDate] = useState("");
  const [invYears, setInvYears] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur inattendue.");
      else router.refresh();
    });
  }

  function applyPreset(label: string, periodicity: "monthly" | "quarterly" | "yearly") {
    setChargeLabel(label);
    setChargePeriodicity(periodicity);
  }

  function addCharge() {
    const amount = parseAmount(chargeAmount);
    if (!chargeLabel.trim() || amount == null) {
      setError("Indiquez un libellé et un montant.");
      return;
    }
    run(async () => {
      const res = await saveFixedChargeAction({
        restaurantId,
        label: chargeLabel,
        monthlyAmount: amount,
        category: config.saveCategory,
        periodicity: chargePeriodicity,
      });
      if (res.ok) {
        setChargeLabel("");
        setChargeAmount("");
      }
      return res;
    });
  }

  function addInvestment() {
    const amount = parseAmount(invAmount);
    const years = invYears.trim() === "" ? null : parseAmount(invYears);
    if (!invLabel.trim() || amount == null) {
      setError("Indiquez ce que vous avez acheté et le montant.");
      return;
    }
    run(async () => {
      const res = await saveInvestmentAction({
        restaurantId,
        label: invLabel,
        expenseCategory: config.saveCategory,
        acquisitionDate: invDate.trim() || null,
        amountTotal: amount,
        amortizationYears: years != null ? Math.round(years) : null,
      });
      if (res.ok) {
        setInvLabel("");
        setInvAmount("");
        setInvDate("");
        setInvYears("");
      }
      return res;
    });
  }

  return (
    <div className="space-y-5">
      <p className={uiInfoBanner}>{config.helper}</p>
      {error ? <p className={uiError}>{error}</p> : null}

      {config.id === "personnel" ? (
        <p className={uiInfoBanner}>
          Les <strong>salaires</strong> et heures d&apos;équipe se gèrent dans{" "}
          <Link href="/equipe" className="font-semibold text-copper-800 underline">
            Équipe
          </Link>{" "}
          et le bilan{" "}
          <Link href="/pilotage/bilan" className="font-semibold text-copper-800 underline">
            Ma poche
          </Link>
          . Ici : uniquement les cotisations et frais autour du personnel.
        </p>
      ) : null}

      {config.showCharges ? (
        <section className="space-y-3">
          <div>
            <h3 className={uiSectionTitleSm}>{config.chargesTitle}</h3>
            <p className={`mt-1 ${uiMuted}`}>{config.chargesHint}</p>
          </div>

          {data.charges.length > 0 ? (
            <ul className="space-y-2">
              {data.charges.map((c) => (
                <li key={c.id} className={uiListRow}>
                  <span className="min-w-0 truncate text-sm font-medium text-stone-800">{c.label}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm tabular-nums text-stone-700">
                      {c.monthlyAmount.toLocaleString("fr-FR")} €{" "}
                      <span className="text-xs text-stone-400">
                        {PERIODICITY_LABELS[c.periodicity] ?? c.periodicity}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => deleteFixedChargeAction({ restaurantId, chargeId: c.id }))}
                      className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                      aria-label={`Supprimer ${c.label}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`rounded-2xl border border-dashed border-stone-200 px-4 py-5 text-center text-sm text-stone-500`}>
              Rien de renseigné pour l&apos;instant.
            </p>
          )}

          {config.chargePresets.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {config.chargePresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.label, preset.periodicity)}
                  className={uiBtnOutlineSm}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className={`${uiCardMuted} grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]`}>
            <input
              value={chargeLabel}
              onChange={(e) => setChargeLabel(e.target.value)}
              placeholder="Libellé"
              className={uiInput}
            />
            <input
              value={chargeAmount}
              onChange={(e) => setChargeAmount(e.target.value)}
              placeholder="Montant €"
              inputMode="decimal"
              className={`${uiInput} w-28 text-right tabular-nums`}
            />
            <select
              value={chargePeriodicity}
              onChange={(e) => setChargePeriodicity(e.target.value as typeof chargePeriodicity)}
              className={uiInput}
            >
              <option value="monthly">/ mois</option>
              <option value="quarterly">/ trimestre</option>
              <option value="yearly">/ an</option>
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={addCharge}
              className={`${uiBtnPrimarySm} inline-flex items-center justify-center gap-1`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Ajouter
            </button>
          </div>
        </section>
      ) : null}

      {config.showInvestments ? (
        <section className="space-y-3">
          <div>
            <h3 className={uiSectionTitleSm}>{config.investmentsTitle}</h3>
            <p className={`mt-1 ${uiMuted}`}>{config.investmentsHint}</p>
          </div>

          {data.investments.length > 0 ? (
            <ul className="space-y-2">
              {data.investments.map((inv) => (
                <li key={inv.id} className={uiListRow}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-800">{inv.label}</p>
                    <p className="text-xs text-stone-500">
                      {formatMoney(inv.amountTotal)}
                      {inv.acquisitionDate ? ` · acheté le ${formatDate(inv.acquisitionDate)}` : ""}
                      {inv.monthlyAmortization != null
                        ? ` · ~${formatMoney(inv.monthlyAmortization)}/mois`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteInvestmentAction({ restaurantId, investmentId: inv.id }))}
                    className="shrink-0 rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    aria-label={`Supprimer ${inv.label}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-stone-200 px-4 py-5 text-center text-sm text-stone-500">
              Aucun gros achat enregistré.
            </p>
          )}

          <div className={`${uiCardMuted} space-y-2`}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={invLabel}
                onChange={(e) => setInvLabel(e.target.value)}
                placeholder="Ex. Four professionnel, travaux salle…"
                className={uiInput}
              />
              <input
                value={invAmount}
                onChange={(e) => setInvAmount(e.target.value)}
                placeholder="Prix d'achat (€)"
                inputMode="decimal"
                className={uiInput}
              />
              <input
                value={invDate}
                onChange={(e) => setInvDate(e.target.value)}
                type="date"
                className={uiInput}
                aria-label="Date d'achat"
              />
              <input
                value={invYears}
                onChange={(e) => setInvYears(e.target.value)}
                placeholder="Durée utile (années, optionnel)"
                inputMode="numeric"
                className={uiInput}
              />
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={addInvestment}
              className={`${uiBtnPrimarySm} inline-flex items-center gap-1`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Enregistrer l&apos;achat
            </button>
          </div>
        </section>
      ) : null}

      {config.showInvoices ? (
        <section className="space-y-3">
          <div>
            <h3 className={uiSectionTitleSm}>{config.invoicesTitle}</h3>
            <p className={`mt-1 ${uiMuted}`}>{config.invoicesHint}</p>
          </div>

          {data.invoices.length > 0 ? (
            <ul className="space-y-2">
              {data.invoices.map((inv) => (
                <li key={inv.id}>
                  <Link href={`/supplier-invoices/${inv.id}`} className={uiListRow}>
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                        <FileText className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-stone-900">
                          {inv.invoiceNumber || "Facture sans numéro"}
                        </span>
                        <span className="block truncate text-xs text-stone-500">
                          {inv.supplierName} · {formatDate(inv.invoiceDate)} ·{" "}
                          {formatMoney(inv.amountHt ?? inv.amountTtc)}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-stone-200 px-4 py-5 text-center text-sm text-stone-500">
              Aucune facture dans cette rubrique.
            </p>
          )}

          <div className={uiCardMuted}>
            <AdministratifInvoiceUpload
              restaurantId={restaurantId}
              suppliers={suppliers}
              expenseCategory={config.saveCategory}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
