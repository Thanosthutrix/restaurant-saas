import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { listStaffMembers } from "@/lib/staff/staffDb";
import { HcrContractWizard } from "@/components/hcr-contracts/HcrContractWizard";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";

export const dynamic = "force-dynamic";

export default async function NewHcrContractPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");

  const restaurant = ctx.currentRestaurant;
  const staff = await listStaffMembers(restaurant.id, true);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <Link href="/equipe/contrats" className={uiBackLink}>
        ← Contrats HCR
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-copper-700">Nouveau contrat</p>
        <h1 className={`mt-2 ${uiPageTitle}`}>Assistant de génération HCR</h1>
        <p className={`mt-2 max-w-3xl ${uiLead}`}>
          Complétez les informations obligatoires, sélectionnez les clauses, puis exportez le contrat en PDF.
        </p>
      </header>
      <HcrContractWizard restaurant={restaurant} staff={staff} />
    </main>
  );
}
