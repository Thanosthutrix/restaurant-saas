"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { uiCard, uiError } from "@/components/ui/premium";
import {
  deleteFixedChargeAction,
  saveFixedChargeAction,
  savePocketSettingsAction,
  setStaffHourlyRateAction,
  setStaffPasRateAction,
} from "./actions";
import type { PocketFixedChargeRow } from "@/lib/pocket/pocketReport";
import { EXPENSE_CATEGORIES, getExpenseCategoryLabel } from "@/lib/pocket/expenseCategories";

type StaffRow = {
  id: string;
  displayName: string;
  hourlyGrossRate: number | null;
  withholdingTaxRatePct: number | null;
};

const PERIODICITIES = [
  { value: "monthly", label: "/mois", long: "Mensuel" },
  { value: "quarterly", label: "/trim.", long: "Trimestriel" },
  { value: "yearly", label: "/an", long: "Annuel" },
] as const;

function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function BilanSettingsClient({
  restaurantId,
  staff,
  charges,
  payrollEmployerPct,
  pocketTaxPct,
  payrollAtmpRatePct,
}: {
  restaurantId: string;
  staff: StaffRow[];
  charges: PocketFixedChargeRow[];
  payrollEmployerPct: number;
  pocketTaxPct: number | null;
  payrollAtmpRatePct: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(staff.map((s) => [s.id, s.hourlyGrossRate != null ? String(s.hourlyGrossRate) : ""]))
  );
  const [pasRates, setPasRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      staff.map((s) => [
        s.id,
        s.withholdingTaxRatePct != null ? String(s.withholdingTaxRatePct) : "",
      ])
    )
  );

  const [chargeLabel, setChargeLabel] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeCategory, setChargeCategory] = useState("locaux");
  const [chargePeriodicity, setChargePeriodicity] = useState("monthly");

  const [employerPct, setEmployerPct] = useState(String(payrollEmployerPct));
  const [taxPct, setTaxPct] = useState(pocketTaxPct != null ? String(pocketTaxPct) : "");
  const [atmpPct, setAtmpPct] = useState(String(payrollAtmpRatePct));

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Erreur inattendue.");
        return;
      }
      router.refresh();
    });
  }

  function saveRate(staffId: string) {
    const raw = rates[staffId] ?? "";
    const rate = raw.trim() === "" ? null : parseAmount(raw);
    if (raw.trim() !== "" && rate == null) {
      setError("Taux horaire invalide.");
      return;
    }
    run(() =>
      setStaffHourlyRateAction({ restaurantId, staffMemberId: staffId, hourlyGrossRate: rate })
    );
  }

  function addCharge() {
    const amount = parseAmount(chargeAmount);
    if (!chargeLabel.trim() || amount == null) {
      setError("Libellé et montant requis.");
      return;
    }
    run(async () => {
      const res = await saveFixedChargeAction({
        restaurantId,
        label: chargeLabel,
        monthlyAmount: amount,
        category: chargeCategory,
        periodicity: chargePeriodicity,
      });
      if (res.ok) {
        setChargeLabel("");
        setChargeAmount("");
      }
      return res;
    });
  }

  function savePasRate(staffId: string) {
    const raw = pasRates[staffId] ?? "";
    const rate = raw.trim() === "" ? null : parseAmount(raw);
    if (raw.trim() !== "" && rate == null) {
      setError("Taux PAS invalide.");
      return;
    }
    run(() =>
      setStaffPasRateAction({ restaurantId, staffMemberId: staffId, withholdingTaxRatePct: rate })
    );
  }

  function saveSettings() {
    const employer = parseAmount(employerPct);
    const tax = taxPct.trim() === "" ? null : parseAmount(taxPct);
    const atmp = parseAmount(atmpPct);
    if (employer == null) {
      setError("Charges patronales : pourcentage requis.");
      return;
    }
    if (atmp == null) {
      setError("Taux AT/MP requis.");
      return;
    }
    run(() =>
      savePocketSettingsAction({
        restaurantId,
        payrollEmployerPct: employer,
        pocketTaxPct: tax,
        payrollAtmpRatePct: atmp,
      })
    );
  }

  const inputCls =
    "min-w-0 w-full max-w-[5.5rem] rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-800 text-right tabular-nums";
  const inputWideCls =
    "min-w-0 w-full rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-800";
  const btnCls =
    "shrink-0 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:border-stone-300 disabled:opacity-50";

  return (
    <div className={`${uiCard} min-w-0 max-w-full overflow-hidden`}>
      <h2 className="text-sm font-semibold text-stone-900">Réglages du bilan</h2>
      {error ? <p className={`${uiError} mt-2`}>{error}</p> : null}

      <div className="mt-4 grid min-w-0 gap-8 xl:grid-cols-3">
        {/* Salaires */}
        <section className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Salaires & PAS
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            Brut horaire et taux de prélèvement à la source (bulletins de paie).
          </p>
          <div className="mt-3 space-y-3">
            {staff.length === 0 ? (
              <p className="text-sm text-stone-500">Aucun employé actif.</p>
            ) : (
              staff.map((s) => (
                <div key={s.id} className="min-w-0 rounded-xl border border-stone-100 p-3">
                  <p className="truncate text-sm font-medium text-stone-800">{s.displayName}</p>
                  <div className="mt-2 space-y-2">
                    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center">
                      <span className="shrink-0 text-xs text-stone-500 sm:w-10">Brut</span>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                        <input
                          value={rates[s.id] ?? ""}
                          onChange={(e) => setRates((r) => ({ ...r, [s.id]: e.target.value }))}
                          placeholder="12,02"
                          inputMode="decimal"
                          className={inputCls}
                          aria-label={`Brut horaire de ${s.displayName}`}
                        />
                        <span className="text-xs text-stone-400">€/h</span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => saveRate(s.id)}
                          className={btnCls}
                        >
                          OK
                        </button>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center">
                      <span className="shrink-0 text-xs text-stone-500 sm:w-10">PAS</span>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                        <input
                          value={pasRates[s.id] ?? ""}
                          onChange={(e) => setPasRates((r) => ({ ...r, [s.id]: e.target.value }))}
                          placeholder="0"
                          inputMode="decimal"
                          className={inputCls}
                          aria-label={`Taux PAS de ${s.displayName}`}
                        />
                        <span className="text-xs text-stone-400">%</span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => savePasRate(s.id)}
                          className={btnCls}
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Charges récurrentes sans facture */}
        <section className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Charges récurrentes (sans facture)
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            Uniquement ce qui n&apos;a pas de facture déposée : loyer, échéance d&apos;emprunt,
            amortissements… Les factures (EDF, assurance, SACEM…) se déposent dans Achats →
            Factures : elles sont comptées automatiquement.
          </p>
          <div className="mt-3 space-y-2">
            {charges.map((c) => (
              <div
                key={c.id}
                className="flex min-w-0 flex-col gap-1 rounded-lg py-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="min-w-0 truncate text-sm text-stone-700">
                  {c.label}
                  <span className="ml-1.5 text-xs text-stone-400">
                    {getExpenseCategoryLabel(c.category)}
                  </span>
                </p>
                <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                  <span className="whitespace-nowrap text-sm tabular-nums font-medium text-stone-800">
                    {c.monthlyAmount.toLocaleString("fr-FR")} €
                    {PERIODICITIES.find((p) => p.value === c.periodicity)?.label ?? "/mois"}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteFixedChargeAction({ restaurantId, chargeId: c.id }))}
                    className="rounded-lg p-1 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                    aria-label={`Supprimer ${c.label}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            ))}
            <div className="space-y-2 border-t border-stone-100 pt-3">
              <input
                value={chargeLabel}
                onChange={(e) => setChargeLabel(e.target.value)}
                placeholder="Loyer"
                className={inputWideCls}
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <input
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  placeholder="1800"
                  inputMode="decimal"
                  className={inputWideCls}
                />
                <span className="text-xs text-stone-400 sm:text-right">€ HT</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={chargeCategory}
                  onChange={(e) => setChargeCategory(e.target.value)}
                  aria-label="Poste comptable"
                  className={`${inputWideCls} cursor-pointer`}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={chargePeriodicity}
                  onChange={(e) => setChargePeriodicity(e.target.value)}
                  aria-label="Périodicité"
                  className={`${inputWideCls} cursor-pointer`}
                >
                  {PERIODICITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.long}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={addCharge}
                className={`${btnCls} inline-flex w-full items-center justify-center gap-1 sm:w-auto`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Ajouter
              </button>
            </div>
          </div>
        </section>

        {/* Pourcentages */}
        <section className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Paie & estimations</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-sm text-stone-700" htmlFor="atmpPct">
                Taux AT/MP (% du brut)
              </label>
              <div className="mt-1 flex max-w-full flex-wrap items-center gap-1.5">
                <input
                  id="atmpPct"
                  value={atmpPct}
                  onChange={(e) => setAtmpPct(e.target.value)}
                  inputMode="decimal"
                  className={inputCls}
                />
                <span className="text-xs text-stone-400">%</span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                Taux transmis par votre caisse (restauration ~2,30 % par défaut).
              </p>
            </div>
            <div>
              <label className="text-sm text-stone-700" htmlFor="employerPct">
                Charges patronales (% du brut)
              </label>
              <div className="mt-1 flex max-w-full flex-wrap items-center gap-1.5">
                <input
                  id="employerPct"
                  value={employerPct}
                  onChange={(e) => setEmployerPct(e.target.value)}
                  inputMode="decimal"
                  className={inputCls}
                />
                <span className="text-xs text-stone-400">%</span>
              </div>
              <p className="mt-1 text-xs text-stone-500">~42 % en HCR ; à ajuster avec le comptable.</p>
            </div>
            <div>
              <label className="text-sm text-stone-700" htmlFor="taxPct">
                Impôts & cotisations dirigeant (% du résultat)
              </label>
              <div className="mt-1 flex max-w-full flex-wrap items-center gap-1.5">
                <input
                  id="taxPct"
                  value={taxPct}
                  onChange={(e) => setTaxPct(e.target.value)}
                  placeholder="vide = masqué"
                  inputMode="decimal"
                  className={inputCls}
                />
                <span className="text-xs text-stone-400">%</span>
              </div>
            </div>
            <button type="button" disabled={pending} onClick={saveSettings} className={btnCls}>
              Enregistrer les estimations
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
