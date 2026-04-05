import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/auth";
import { getRecentDeliveryNotesForRestaurant, getDeliveryNoteFileUrl, getSuppliers } from "@/lib/db";
import { LivraisonBlForm } from "./LivraisonBlForm";
import { uiBackLink, uiCard, uiLead, uiPageTitle, uiSectionTitleSm } from "@/components/ui/premium";

export default async function LivraisonPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const [{ data: notes, error: notesErr }, { data: suppliers }] = await Promise.all([
    getRecentDeliveryNotesForRestaurant(restaurant.id, 40),
    getSuppliers(restaurant.id, true),
  ]);

  if (notesErr) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {notesErr.message}
        </p>
      </div>
    );
  }

  const supplierList = suppliers ?? [];
  const supplierName = (id: string) => supplierList.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Livraison</h1>
        <p className={`mt-2 ${uiLead}`}>
          Photographiez un bon de livraison (même si la commande n’a pas été passée dans l’application). Les lignes
          sont préremplies par analyse de l’image lorsque c’est possible, puis rattachées à vos articles stock pour la
          validation — même logique que pour une réception issue d’une commande.
        </p>
      </div>

      <section className={`${uiCard} space-y-4`}>
        <h2 className={uiSectionTitleSm}>Nouvelle réception depuis un BL</h2>
        <LivraisonBlForm restaurantId={restaurant.id} suppliers={supplierList} />
      </section>

      <section>
        <h2 className={uiSectionTitleSm}>Réceptions récentes</h2>
        {!notes?.length ? (
          <p className={`mt-2 ${uiLead}`}>Aucune réception enregistrée pour l’instant.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notes.map((n) => {
              const fileUrl = n.file_url ?? getDeliveryNoteFileUrl(n.file_path);
              const statusLabel =
                n.status === "validated" ? "Validée" : n.status === "draft" ? "Brouillon" : n.status;
              const displayDate = n.delivery_date ?? n.created_at;
              return (
                <li key={n.id}>
                  <Link
                    href={`/receiving/${n.id}`}
                    className={`${uiCard} block transition hover:border-indigo-200 hover:shadow-md`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{supplierName(n.supplier_id)}</p>
                        <p className={`mt-0.5 text-sm ${uiLead}`}>
                          {displayDate
                            ? new Date(displayDate).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}{" "}
                          · {n.lines_count} ligne{n.lines_count !== 1 ? "s" : ""} · {statusLabel}
                          {n.source === "from_upload" ? " · BL importé" : null}
                        </p>
                      </div>
                      {fileUrl ? (
                        <span className="text-xs font-medium text-indigo-600">Voir →</span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
