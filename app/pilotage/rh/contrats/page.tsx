import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { listHcrContracts } from "@/lib/hcr-contracts/hcrContractsDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { uiBtnPrimary, uiBtnSecondary, uiCard, uiSectionTitleSm } from "@/components/ui/premium";
import { HcrContractsListClient } from "./HcrContractsListClient";

export const dynamic = "force-dynamic";

export default async function HcrContractsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");

  const restaurant = ctx.currentRestaurant;
  const contracts = await listHcrContracts(restaurant.id);
  const draftCount = contracts.filter((c) => c.status === "draft").length;
  const exportedCount = contracts.filter((c) => c.status === "exported").length;

  return (
    <PageContainer>
      <PageHeader
        accentIcon={FileText}
        accentTone="bg-rose-50 text-rose-700"
        breadcrumbs={[
          { label: "Pilotage", href: "/pilotage" },
          { label: "RH", href: "/pilotage/rh" },
          { label: "Contrats" },
        ]}
        eyebrow="LegalTech RH"
        title="Générateur de contrats de travail HCR"
        subtitle="Créez, enregistrez et retrouvez vos brouillons de contrats CDI, CDD ou saisonniers."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/pilotage/rh/administratif" className={uiBtnSecondary}>
              Profil employeur
            </Link>
            <Link href="/pilotage/rh/contrats/nouveau" className={uiBtnPrimary}>
              Nouveau contrat
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={uiCard}>
          <p className="text-xs font-medium text-stone-500">Total enregistrés</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{contracts.length}</p>
        </div>
        <div className={uiCard}>
          <p className="text-xs font-medium text-stone-500">Brouillons</p>
          <p className="mt-1 text-2xl font-semibold text-stone-700">{draftCount}</p>
        </div>
        <div className={uiCard}>
          <p className="text-xs font-medium text-stone-500">Exportés</p>
          <p className="mt-1 text-2xl font-semibold text-rose-800">{exportedCount}</p>
        </div>
      </div>

      <section>
        <h2 className={uiSectionTitleSm}>Contrats enregistrés</h2>
        {contracts.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={FileText}
              title="Aucun contrat enregistré"
              description="Créez un premier contrat avec l'assistant, puis enregistrez-le pour le retrouver ici."
              actionLabel="Nouveau contrat"
              actionHref="/pilotage/rh/contrats/nouveau"
              compact
            />
          </div>
        ) : (
          <div className="mt-3">
            <HcrContractsListClient restaurantId={restaurant.id} contracts={contracts} />
          </div>
        )}
      </section>
    </PageContainer>
  );
}
