import { redirect } from "next/navigation";
import { Boxes, Check, Clock, FileClock } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { listPreparationRegister } from "@/lib/preparations/preparationsDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";

/** Date + heure déterministes (Europe/Paris) — rendu serveur stable. */
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
  });
  const time = d.toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

function fmtDate(ymd: string | null): string {
  if (!ymd) return "—";
  const d = new Date(ymd + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** YYYY-MM-DD du jour en Europe/Paris (comparaison DLC). */
function todayParisIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

function dlcTone(ymd: string | null, todayIso: string): string {
  if (!ymd) return "border-stone-200 bg-stone-50 text-stone-500";
  if (ymd < todayIso) return "border-rose-200 bg-rose-50 text-rose-700";
  if (ymd === todayIso) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-stone-200 bg-stone-50 text-stone-600";
}

export default async function PreparationsRegistrePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const rows = await listPreparationRegister(restaurant.id, 300);
  const todayIso = todayParisIso();

  const total = rows.length;
  const done2h = rows.filter((r) => r.temp_2h_recorded_at).length;
  const pending2h = rows.filter((r) => r.temp_end_recorded_at && !r.temp_2h_recorded_at).length;

  const stats: { label: string; value: number; icon: typeof Check; tone: string }[] = [
    { label: "Lots enregistrés", value: total, icon: Boxes, tone: "bg-sky-50 text-sky-700" },
    { label: "Contrôles +2 h faits", value: done2h, icon: Check, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Relevés +2 h manquants", value: pending2h, icon: Clock, tone: "bg-amber-50 text-amber-700" },
  ];

  return (
    <PageContainer>
      <PageHeader
        accentIcon={SECTION_ACCENT.preparations.icon}
        accentTone={SECTION_ACCENT.preparations.tone}
        breadcrumbs={[
          { label: "Cuisine", href: "/cuisine" },
          { label: "Préparations", href: "/preparations" },
          { label: "Registre" },
        ]}
        title="Registre des préparations"
        subtitle="Historique des lots : températures de fin, contrôle +2 h, DLC et auteur. Conservez-le comme preuve de traçabilité HACCP."
      />

      {total > 0 ? (
        <section className="grid grid-cols-3 gap-3" aria-label="Synthèse">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-3 shadow-sm sm:p-4"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tabular-nums leading-none tracking-tight text-stone-900">
                    {s.value}
                  </p>
                  <p className="mt-1 text-xs font-medium text-stone-500">{s.label}</p>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {total === 0 ? (
        <EmptyState
          icon={FileClock}
          title="Aucune entrée au registre"
          description="Lancez une préparation depuis la page Préparations : chaque lot validé apparaîtra ici avec ses relevés de température."
          actionLabel="Aller aux préparations"
          actionHref="/preparations"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  <th className="px-3 py-2.5">Démarrage</th>
                  <th className="px-3 py-2.5">N° lot</th>
                  <th className="px-3 py-2.5">Libellé</th>
                  <th className="px-3 py-2.5 text-center">T° fin</th>
                  <th className="px-3 py-2.5 text-center">T° +2 h</th>
                  <th className="px-3 py-2.5">DLC</th>
                  <th className="px-3 py-2.5">Enregistré par</th>
                  <th className="px-3 py-2.5">Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const has2h = !!r.temp_2h_recorded_at;
                  const awaiting2h = !!r.temp_end_recorded_at && !has2h;
                  return (
                    <tr key={r.id} className="border-b border-stone-50 transition hover:bg-stone-50/70">
                      <td className="whitespace-nowrap px-3 py-2.5 text-stone-700">{fmtDateTime(r.started_at)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {r.lot_reference ? (
                          <span className="rounded-md bg-copper-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-copper-800">
                            {r.lot_reference}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-stone-900">{r.label}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center">
                        {r.temp_end_celsius != null ? (
                          <span className="inline-flex items-center justify-center rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-stone-800">
                            {r.temp_end_celsius}°
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center">
                        {has2h ? (
                          <span
                            title={`Relevé le ${fmtDateTime(r.temp_2h_recorded_at)}`}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-800"
                          >
                            <Check className="h-3 w-3" aria-hidden />
                            {r.temp_2h_celsius}°
                          </span>
                        ) : awaiting2h ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            <Clock className="h-3 w-3" aria-hidden />
                            manquant
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${dlcTone(
                            r.dlc_date,
                            todayIso
                          )}`}
                        >
                          {fmtDate(r.dlc_date)}
                        </span>
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-2.5 text-xs text-stone-600">
                        {r.recorded_by_display ?? "—"}
                      </td>
                      <td className="max-w-[12rem] truncate px-3 py-2.5 text-stone-600">{r.comment ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-stone-400">
        Traçabilité interne : les DLC et températures doivent être alignées avec votre méthode HACCP et les règles
        d’étiquetage en vigueur.
      </p>
    </PageContainer>
  );
}
