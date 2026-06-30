import Link from "next/link";
import { redirect } from "next/navigation";
import { Thermometer } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { listTemperatureLogs, type TemperatureLogFilter } from "@/lib/haccpTemperature/haccpTemperatureDb";
import {
  TEMPERATURE_LOG_STATUS_LABEL_FR,
  TEMPERATURE_POINT_TYPE_LABEL_FR,
  type TemperatureLogStatus,
} from "@/lib/haccpTemperature/types";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";

type Search = { filter?: string };

/** Date + heure déterministes (Europe/Paris) — rendu serveur stable. */
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function statusPill(status: TemperatureLogStatus): string {
  if (status === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "alert") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default async function HaccpRegistrePage({ searchParams }: { searchParams: Promise<Search> }) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const filter: TemperatureLogFilter = sp.filter === "anomalies" ? "anomalies" : "all";
  const rows = await listTemperatureLogs(restaurant.id, { limit: 400, filter });

  const segBase = "rounded-full px-3 py-1.5 text-sm font-medium transition";
  const segOn = "bg-copper-700 text-white shadow-sm";
  const segOff = "border border-stone-200 text-stone-600 hover:bg-stone-50";

  return (
    <PageContainer>
      <PageHeader
        accentIcon={SECTION_ACCENT.hygiene.icon}
        accentTone={SECTION_ACCENT.hygiene.tone}
        breadcrumbs={[
          { label: "Cuisine", href: "/cuisine" },
          { label: "Températures HACCP", href: "/hygiene/haccp" },
          { label: "Registre" },
        ]}
        title="Registre des relevés"
        subtitle="Historique des mesures et traitement des anomalies."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/hygiene/haccp/registre" className={`${segBase} ${filter === "all" ? segOn : segOff}`}>
              Tous
            </Link>
            <Link
              href="/hygiene/haccp/registre?filter=anomalies"
              className={`${segBase} ${filter === "anomalies" ? segOn : segOff}`}
            >
              Anomalies seulement
            </Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Thermometer}
          title={filter === "anomalies" ? "Aucune anomalie" : "Aucun relevé enregistré"}
          description={
            filter === "anomalies"
              ? "Aucune mesure hors seuil sur la période. Les anomalies à traiter apparaîtront ici."
              : "Les mesures de température HACCP s’afficheront ici au fil des relevés."
          }
          actionLabel="Faire un relevé"
          actionHref="/hygiene/haccp/check"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Point</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5 text-center">Mesure</th>
                  <th className="px-3 py-2.5">Statut</th>
                  <th className="px-3 py-2.5">Par</th>
                  <th className="px-3 py-2.5">Commentaire / action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-stone-50 transition hover:bg-stone-50/70">
                    <td className="whitespace-nowrap px-3 py-2.5 text-stone-700">{fmtDateTime(r.created_at)}</td>
                    <td className="px-3 py-2.5 font-medium text-stone-900">{r.point_name}</td>
                    <td className="px-3 py-2.5 text-stone-600">{TEMPERATURE_POINT_TYPE_LABEL_FR[r.point_type]}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-stone-800">
                        {r.value}°
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${statusPill(
                          r.log_status as TemperatureLogStatus
                        )}`}
                      >
                        {TEMPERATURE_LOG_STATUS_LABEL_FR[r.log_status as TemperatureLogStatus]}
                      </span>
                    </td>
                    <td className="max-w-[10rem] px-3 py-2.5 text-xs text-stone-600">{r.recorded_by_display ?? "—"}</td>
                    <td className="max-w-[18rem] px-3 py-2.5 text-stone-600">
                      {r.comment && <p>{r.comment}</p>}
                      {r.corrective_action && (
                        <p className="text-xs text-stone-500">
                          <span className="font-medium text-stone-600">Action : </span>
                          {r.corrective_action}
                        </p>
                      )}
                      {r.product_impact && <p className="text-xs text-stone-500">Produit : {r.product_impact}</p>}
                      {!r.comment && !r.corrective_action && !r.product_impact ? "—" : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-stone-400">
        Support de traçabilité interne ; adaptez les procédures à votre établissement et aux exigences du contrôle
        sanitaire.
      </p>
    </PageContainer>
  );
}
