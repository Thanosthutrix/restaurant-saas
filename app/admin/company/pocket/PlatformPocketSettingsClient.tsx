"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  deletePlatformFixedChargeAction,
  savePlatformFixedChargeAction,
  savePlatformPocketSettingsAction,
  setPlatformStaffHourlyRateAction,
} from "./actions";
import type { PlatformFixedChargeRow } from "@/lib/platform/platformPocketReport";
import {
  PLATFORM_EXPENSE_CATEGORIES,
  getPlatformExpenseCategoryLabel,
  type PlatformExpenseCategory,
} from "@/lib/platform/platformExpenseCategories";

type StaffRow = { id: string; displayName: string; hourlyGrossRate: number | null };

const PERIODICITIES = [
  { value: "monthly", label: "/mois" },
  { value: "quarterly", label: "/trim." },
  { value: "yearly", label: "/an" },
] as const;

function parseAmount(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function PlatformPocketSettingsClient({
  staff,
  charges,
  payrollEmployerPct,
  pocketTaxPct,
}: {
  staff: StaffRow[];
  charges: PlatformFixedChargeRow[];
  payrollEmployerPct: number;
  pocketTaxPct: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [chargeLabel, setChargeLabel] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeCategory, setChargeCategory] = useState<PlatformExpenseCategory>("loyer");
  const [chargePeriodicity, setChargePeriodicity] = useState("monthly");

  const [employerPct, setEmployerPct] = useState(String(payrollEmployerPct));
  const [taxPct, setTaxPct] = useState(pocketTaxPct != null ? String(pocketTaxPct) : "");
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(staff.map((s) => [s.id, s.hourlyGrossRate != null ? String(s.hourlyGrossRate) : ""]))
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Charges récurrentes</h2>
        <p className="mt-1 text-xs text-gray-500">
          Loyer, assurances, abonnements sans facture mensuelle…
        </p>

        {charges.length > 0 ? (
          <ul className="mt-4 divide-y divide-gray-50 rounded-lg border border-gray-100">
            {charges.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span>
                  <span className="font-medium text-gray-900">{c.label}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {getPlatformExpenseCategoryLabel(c.category)} ·{" "}
                    {c.monthlyAmount.toLocaleString("fr-FR")} €
                    {c.periodicity === "monthly" ? "/mois" : c.periodicity === "quarterly" ? "/trim." : "/an"}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => deletePlatformFixedChargeAction(c.id))}
                  className="text-red-600 hover:text-red-700"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm italic text-gray-400">Aucune charge récurrente.</p>
        )}

        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const amount = parseAmount(chargeAmount);
            if (amount == null) {
              setError("Montant invalide.");
              return;
            }
            run(() =>
              savePlatformFixedChargeAction({
                label: chargeLabel,
                monthlyAmount: amount,
                category: chargeCategory,
                periodicity: chargePeriodicity,
              })
            );
            setChargeLabel("");
            setChargeAmount("");
          }}
        >
          <input
            value={chargeLabel}
            onChange={(e) => setChargeLabel(e.target.value)}
            placeholder="Loyer bureau, RC Pro…"
            required
            className="min-w-[10rem] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={chargeAmount}
            onChange={(e) => setChargeAmount(e.target.value)}
            placeholder="Montant"
            required
            className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <select
            value={chargeCategory}
            onChange={(e) => setChargeCategory(e.target.value as PlatformExpenseCategory)}
            className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
          >
            {PLATFORM_EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={chargePeriodicity}
            onChange={(e) => setChargePeriodicity(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
          >
            {PERIODICITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </form>
      </section>

      {staff.length > 0 ? (
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Taux horaires équipe</h2>
          <ul className="mt-3 space-y-2">
            {staff.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-[8rem] font-medium text-gray-900">{s.displayName}</span>
                <input
                  value={rates[s.id] ?? ""}
                  onChange={(e) => setRates((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  placeholder="€/h brut"
                  className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const raw = rates[s.id]?.trim();
                    const rate = raw ? parseAmount(raw) : null;
                    run(() =>
                      setPlatformStaffHourlyRateAction({
                        staffMemberId: s.id,
                        hourlyGrossRate: rate,
                      })
                    );
                  }}
                  className="text-xs font-medium text-amber-700 hover:underline"
                >
                  Enregistrer
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Paramètres bilan</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="text-sm">
            <span className="text-xs text-gray-500">Charges patronales (%)</span>
            <input
              value={employerPct}
              onChange={(e) => setEmployerPct(e.target.value)}
              className="mt-1 block w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-gray-500">Impôts estimés (% résultat)</span>
            <input
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
              placeholder="vide = 0"
              className="mt-1 block w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const employer = parseAmount(employerPct);
              const taxRaw = taxPct.trim();
              const tax = taxRaw ? parseAmount(taxRaw) : null;
              if (employer == null) {
                setError("Charges patronales invalides.");
                return;
              }
              run(() =>
                savePlatformPocketSettingsAction({
                  payrollEmployerPct: employer,
                  pocketTaxPct: tax,
                })
              );
            }}
            className="self-end rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Enregistrer paramètres
          </button>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
