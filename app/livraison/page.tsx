import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { PackageOpen } from "lucide-react";
import { getRecentDeliveryNotesForRestaurant } from "@/lib/db";
import { cachedGetSuppliers } from "@/lib/cache";
import { LivraisonBlForm } from "./LivraisonBlForm";
import { uiCard, uiLead, uiSectionTitleSm } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

export default async function LivraisonPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [{ data: notes, error: notesErr }, { data: suppliers }] = await Promise.all([
    getRecentDeliveryNotesForRestaurant(restaurant.id, 40),
    cachedGetSuppliers(restaurant.id, true),
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
  const awaitingNotes = (notes ?? []).filter((n) => n.status === "draft" && n.source === "from_purchase_order");
  const recentNotes = (notes ?? []).filter((n) => !(n.status === "draft" && n.source === "from_purchase_order"));

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Achats & stock", href: "/achats" }, { label: "Réceptions / BL" }]}
        title="Livraison"
        subtitle={
          <>
            Enregistrez le fichier du bon de livraison (même si la commande n’a pas été passée dans l’application). Sur la
            fiche réception, vous pouvez lancer la <strong>lecture automatique</strong> du BL (photo) ou saisir les lignes à
            la main.
          </>
        }
      />
      <p className="text-sm">
        <Link
          href="/receiving/registre"
          className="font-medium text-copper-800 underline decoration-copper-300 underline-offset-2"
        >
          Registre photos traçabilité
        </Link>
        <span className={`${uiLead} ml-1`}>— lots, DLC et photos par type.</span>
      </p>

      <section className={`${uiCard} space-y-4`}>
        <h2 className={uiSectionTitleSm}>Nouvelle réception depuis un BL</h2>
        <LivraisonBlForm restaurantId={restaurant.id} suppliers={supplierList} />
      </section>

      <section>
        <h2 className={uiSectionTitleSm}>Commandes en attente de réception</h2>
        {awaitingNotes.length === 0 ? (
          <p className={`mt-2 ${uiLead}`}>
            Aucune commande fournisseur envoyée en attente. Dès qu’une commande est envoyée, les produits attendus
            apparaissent ici pour pointage.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {awaitingNotes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/receiving/${n.id}`}
                  className={`${uiCard} block border-amber-200 bg-amber-50/60 transition hover:border-amber-300 hover:shadow-md`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-stone-900">{supplierName(n.supplier_id)}</p>
                      <p className="mt-0.5 text-sm text-amber-800">
                        À pointer · {n.lines_count} produit{n.lines_count !== 1 ? "s" : ""} attendu
                        {n.purchase_order_id ? " · commande liée" : ""}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-amber-800">Ouvrir la réception →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className={uiSectionTitleSm}>Réceptions récentes</h2>
        {recentNotes.length === 0 ? (
          <p className={`mt-2 ${uiLead}`}>Aucune réception enregistrée pour l’instant.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recentNotes.map((n) => {
              const statusLabel =
                n.status === "validated" ? "Validée" : n.status === "draft" ? "Brouillon" : n.status;
              const displayDate = n.delivery_date ?? n.created_at;
              return (
                <li key={n.id}>
                  <Link
                    href={`/receiving/${n.id}`}
                    className="group flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white px-3.5 py-3 shadow-sm transition hover:border-copper-200 hover:shadow-md"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
                      <PackageOpen className="h-5 w-5 text-copper-700" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-stone-900 transition group-hover:text-copper-700">
                        {supplierName(n.supplier_id)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-stone-500">
                        {displayDate
                          ? new Date(displayDate).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}{" "}
                        · {n.lines_count} ligne{n.lines_count !== 1 ? "s" : ""} · {statusLabel}
                        {n.source === "from_upload" ? " · BL importé" : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
