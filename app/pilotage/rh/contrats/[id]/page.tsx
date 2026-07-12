import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { getHcrContractById } from "@/lib/hcr-contracts/hcrContractsDb";
import { listStaffMembers } from "@/lib/staff/staffDb";
import { HcrContractWizard } from "@/components/hcr-contracts/HcrContractWizard";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditHcrContractPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");

  const { id } = await params;
  const restaurant = ctx.currentRestaurant;
  const contract = await getHcrContractById(restaurant.id, id);
  if (!contract) redirect("/pilotage/rh/contrats");

  const staff = await listStaffMembers(restaurant.id, true);

  return (
    <PageContainer width="wide">
      <PageHeader
        breadcrumbs={[
          { label: "Pilotage", href: "/pilotage" },
          { label: "RH", href: "/pilotage/rh" },
          { label: "Contrats", href: "/pilotage/rh/contrats" },
          { label: contract.title },
        ]}
        eyebrow="Modifier le contrat"
        title={contract.title}
        subtitle="Reprenez le brouillon, ajustez les clauses puis enregistrez ou exportez en PDF."
      />
      <HcrContractWizard
        restaurant={restaurant}
        staff={staff}
        initialDraft={contract.draft}
        contractId={contract.id}
      />
    </PageContainer>
  );
}
