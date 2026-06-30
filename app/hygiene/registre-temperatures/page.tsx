import { redirect } from "next/navigation";
import { Thermometer } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { listColdTemperatureRegister } from "@/lib/hygiene/hygieneDb";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_COLD_EVENT_LABEL_FR,
  type HygieneColdEventKind,
} from "@/lib/hygiene/types";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";

/** Date + heure déterministes (Europe/Paris) — rendu serveur stable. */
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default async function HygieneRegistreTemperaturesPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const rows = await listColdTemperatureRegister(restaurant.id, 500);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={SECTION_ACCENT.hygiene.icon}
        accentTone={SECTION_ACCENT.hygiene.tone}
        breadcrumbs={[
          { label: "Cuisine", href: "/cuisine" },
          { label: "Relevés froid", href: "/hygiene/temperatures-ouverture" },
          { label: "Registre" },
        ]}
        title="Registre des températures"
        subtitle="Historique des relevés à l’ouverture et à la fermeture des équipements froids."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Thermometer}
          title="Aucun relevé enregistré"
          description="Les relevés de température des équipements froids (ouverture / fermeture) s’afficheront ici."
          actionLabel="Faire un relevé"
          actionHref="/hygiene/temperatures-ouverture"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  <th className="px-3 py-2.5">Date et heure</th>
                  <th className="px-3 py-2.5">Équipement</th>
                  <th className="px-3 py-2.5">Moment</th>
                  <th className="px-3 py-2.5 text-center">Température</th>
                  <th className="px-3 py-2.5">Par</th>
                  <th className="px-3 py-2.5">Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-stone-50 transition hover:bg-stone-50/70">
                    <td className="whitespace-nowrap px-3 py-2.5 text-stone-700">{fmtDateTime(r.recorded_at)}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-stone-900">{r.element_name}</span>
                      <span className="block text-xs text-stone-500">
                        {HYGIENE_CATEGORY_LABEL_FR[r.element_category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ??
                          r.element_category}
                        {r.area_label ? ` · ${r.area_label}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-stone-700">
                      {HYGIENE_COLD_EVENT_LABEL_FR[r.event_kind as HygieneColdEventKind]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-stone-800">
                        {r.temperature_celsius}°
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-stone-700">
                      {r.recorded_by_initials ? <span className="font-medium">{r.recorded_by_initials}</span> : null}
                      {r.recorded_by_display ? (
                        <span className={`${r.recorded_by_initials ? "mt-0.5 block " : ""}text-xs text-stone-500`}>
                          {r.recorded_by_initials ? "Compte : " : ""}
                          {r.recorded_by_display}
                        </span>
                      ) : null}
                      {!r.recorded_by_initials && !r.recorded_by_display ? "—" : null}
                    </td>
                    <td className="max-w-[14rem] px-3 py-2.5 text-stone-600">{r.comment ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-stone-400">
        Les indications du registre sont un support de traçabilité interne ; elles ne remplacent pas les obligations
        réglementaires applicables à votre établissement.
      </p>
    </PageContainer>
  );
}
