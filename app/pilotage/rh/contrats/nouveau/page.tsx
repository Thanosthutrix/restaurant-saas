import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { getEmployerProfile } from "@/lib/rh/employerProfile";
import { listStaffMembers } from "@/lib/staff/staffDb";
import { HcrContractWizard } from "@/components/hcr-contracts/HcrContractWizard";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewHcrContractPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");

  const restaurant = ctx.currentRestaurant;
  const [staff, employerProfile] = await Promise.all([
    listStaffMembers(restaurant.id, true),
    getEmployerProfile(restaurant.id),
  ]);

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Pilotage", href: "/pilotage" },
          { label: "RH", href: "/pilotage/rh" },
          { label: "Contrats", href: "/pilotage/rh/contrats" },
          { label: "Nouveau contrat" },
        ]}
        eyebrow="Nouveau contrat"
        title="Assistant de génération HCR"
        subtitle="Complétez les informations obligatoires, sélectionnez les clauses, puis exportez le contrat en PDF."
      />
      <HcrContractWizard restaurant={restaurant} staff={staff} employerProfile={employerProfile} />
    </PageContainer>
  );
}
