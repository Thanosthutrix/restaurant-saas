import { redirect } from "next/navigation";
import { Banknote } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { getEmployerProfile } from "@/lib/rh/employerProfile";
import { listPayrollPeriods } from "@/lib/rh/payslipsDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { PaieHubClient } from "./PaieHubClient";

export const dynamic = "force-dynamic";

export default async function PaiePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");

  const restaurantId = ctx.currentRestaurant.id;
  const [periods, profile] = await Promise.all([
    listPayrollPeriods(restaurantId),
    getEmployerProfile(restaurantId),
  ]);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Banknote}
        accentTone="bg-emerald-50 text-emerald-700"
        breadcrumbs={[
          { label: "Pilotage", href: "/pilotage" },
          { label: "RH", href: "/pilotage/rh" },
          { label: "Fiches de paie" },
        ]}
        eyebrow="Espace gestion"
        title="Fiches de paie"
        subtitle="Import des heures depuis le planning, validation manuelle, bulletins liés au bilan et à l'administratif."
      />
      <PaieHubClient
        restaurantId={restaurantId}
        periods={periods}
        hasEmployerSiret={Boolean(profile?.siret?.trim())}
      />
    </PageContainer>
  );
}
