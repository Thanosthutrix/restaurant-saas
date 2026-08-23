import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { getPlatformCompany } from "@/lib/platform/companyDb";
import { buildPlatformPocketReport } from "@/lib/platform/platformPocketReport";
import { listPlatformStaffMembers } from "@/lib/platform/platformStaffDb";
import { getPlatformExpenseCategoryLabel } from "@/lib/platform/platformExpenseCategories";
import { PlatformPocketSettingsClient } from "./PlatformPocketSettingsClient";

export const metadata = { title: "Ma poche — Ubion" };

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function parisToday(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

function shiftDays(ymd: string, delta: number): string {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

type SearchParams = { p?: string; from?: string; to?: string };

function resolvePeriod(sp: SearchParams) {
  const today = parisToday();
  if (sp.from && sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) {
    const [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    return { from, to, preset: "custom" };
  }
  switch (sp.p) {
    case "lastmonth": {
      const first = today.slice(0, 8) + "01";
      const lastOfPrev = shiftDays(first, -1);
      return { from: lastOfPrev.slice(0, 8) + "01", to: lastOfPrev, preset: "lastmonth" };
    }
    case "year":
      return { from: today.slice(0, 4) + "-01-01", to: today, preset: "year" };
    default:
      return { from: today.slice(0, 8) + "01", to: today, preset: "month" };
  }
}

export default async function AdminCompanyPocketPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const company = await getPlatformCompany();
  if (!company) redirect("/admin/company");

  const sp = await searchParams;
  const { from, to } = resolvePeriod(sp);

  const [report, staffRows] = await Promise.all([
    buildPlatformPocketReport(company.id, from, to),
    listPlatformStaffMembers(company.id),
  ]);

  const staff = staffRows
    .filter((s) => s.active)
    .map((s) => ({
      id: s.id,
      displayName: s.display_name,
      hourlyGrossRate: s.hourly_gross_rate,
    }));

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <Link href="/admin/company" className="text-xs text-gray-500 hover:text-gray-700">
        ← Ma société
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
        <Wallet size={22} className="text-amber-600" />
        Ma poche
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Bilan interne Ubion — vos dépenses, charges fixes et résultat.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {[
          { key: "month", label: "Mois en cours" },
          { key: "lastmonth", label: "Mois dernier" },
          { key: "year", label: "Année" },
        ].map((p) => (
          <Link
            key={p.key}
            href={`/admin/company/pocket?p=${p.key}`}
            className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50"
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
          <p className="text-xs text-emerald-800">Recettes (factures émises)</p>
          <p className="text-2xl font-bold text-emerald-900">{eur(report.revenueHt)}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
          <p className="text-xs text-red-800">Dépenses totales</p>
          <p className="text-2xl font-bold text-red-900">{eur(report.totalExpenses)}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
          <p className="text-xs text-amber-800">Ma poche (après impôts estimés)</p>
          <p className={`text-2xl font-bold ${report.pocket >= 0 ? "text-amber-900" : "text-red-700"}`}>
            {eur(report.pocket)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Période : {from} → {to} ({report.days} j.) · Recettes = factures émises PA ·{" "}
        <Link href="/admin/finances" className="underline">
          Revenus Stripe
        </Link>{" "}
        dans un onglet séparé.
      </p>

      {report.invoicesWithoutAmount > 0 ? (
        <p className="mt-2 text-xs text-amber-700">
          {report.invoicesWithoutAmount} facture(s) sans montant —{" "}
          <Link href="/admin/company/invoices" className="underline">
            complétez-les
          </Link>
          .
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Dépenses par poste</h2>
        {report.postes.length === 0 ? (
          <p className="text-sm italic text-gray-400">
            Aucune dépense — importez vos factures ou ajoutez des charges récurrentes.
          </p>
        ) : (
          <ul className="space-y-2">
            {report.postes.map((p) => (
              <li
                key={p.category}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium text-gray-900">{getPlatformExpenseCategoryLabel(p.category)}</span>
                <span className="text-gray-600">
                  {eur(p.total)}
                  <span className="ml-2 text-xs text-gray-400">
                    {p.invoicesCount > 0 ? `${p.invoicesCount} fact.` : ""}
                    {p.manualPortion > 0 ? ` · ${eur(p.manualPortion)} récurrent` : ""}
                    {p.labor > 0 ? ` · ${eur(p.labor)} salaires` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8">
        <PlatformPocketSettingsClient
          staff={staff}
          charges={report.fixedCharges}
          payrollEmployerPct={report.payrollEmployerPct}
          pocketTaxPct={report.pocketTaxPct}
        />
      </div>
    </div>
  );
}
