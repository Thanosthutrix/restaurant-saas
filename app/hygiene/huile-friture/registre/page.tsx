import Link from "next/link";
import { redirect } from "next/navigation";
import { Droplets } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { listFryerOilLogs, type FryerOilLogFilter } from "@/lib/fryerOil/fryerOilDb";
import { TPM_TEST_METHOD_LABEL_FR } from "@/lib/fryerOil/types";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FryerStatusPill, fmtOilTemp, fmtTpm } from "../fryerOilUi";

type Search = { filter?: string };

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default async function FryerOilRegistrePage({ searchParams }: { searchParams: Promise<Search> }) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const filter: FryerOilLogFilter = sp.filter === "anomalies" ? "anomalies" : "all";
  const rows = await listFryerOilLogs(restaurant.id, { limit: 400, filter });

  const segBase = "rounded-full px-3 py-1.5 text-sm font-medium transition";
  const segOn = "bg-copper-700 text-white shadow-sm";
  const segOff = "border border-stone-200 text-stone-600 hover:bg-stone-50";

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Droplets}
        accentTone="bg-amber-50 text-amber-800"
        breadcrumbs={[
          { label: "Nettoyage", href: "/hygiene" },
          { label: "Huile friture", href: "/hygiene/huile-friture" },
          { label: "Registre" },
        ]}
        title="Registre huile de friteuse"
        subtitle="Historique TPM, températures, filtrations et changements d'huile."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/hygiene/huile-friture/registre" className={`${segBase} ${filter === "all" ? segOn : segOff}`}>
              Tous
            </Link>
            <Link
              href="/hygiene/huile-friture/registre?filter=anomalies"
              className={`${segBase} ${filter === "anomalies" ? segOn : segOff}`}
            >
              Anomalies seulement
            </Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Droplets}
          title={filter === "anomalies" ? "Aucune anomalie" : "Aucun contrôle enregistré"}
          description={
            filter === "anomalies"
              ? "Aucune alerte TPM ou qualité sur la période."
              : "Les contrôles huile s'afficheront ici au fil des saisies."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200/70 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/80 text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Friteuse</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">TPM</th>
                <th className="px-4 py-3 text-right">T° huile</th>
                <th className="px-4 py-3">Filtration</th>
                <th className="px-4 py-3">Chgt huile</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-stone-50">
                  <td className="px-4 py-3 text-stone-600">{fmtDateTime(r.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-stone-900">{r.unit_name}</td>
                  <td className="px-4 py-3">
                    <FryerStatusPill status={r.log_status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtTpm(r.tpm_percent)}
                    <span className="block text-[10px] text-stone-400">
                      {TPM_TEST_METHOD_LABEL_FR[r.tpm_test_method]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtOilTemp(r.oil_temperature_celsius)}</td>
                  <td className="px-4 py-3">{r.filtration_done ? "Oui" : "Non"}</td>
                  <td className="px-4 py-3">{r.oil_changed ? "Oui" : r.change_oil_required ? "Requis" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
