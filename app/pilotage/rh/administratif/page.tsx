import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { getSuppliers } from "@/lib/db";
import { getEmployerProfile } from "@/lib/rh/employerProfile";
import { loadAdministratifSectors } from "@/lib/rh/administratifDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { AdministratifClient } from "./AdministratifClient";

export const dynamic = "force-dynamic";

export default async function AdministratifPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");

  const restaurant = ctx.currentRestaurant;

  const [profile, suppliersRes] = await Promise.all([
    getEmployerProfile(restaurant.id),
    getSuppliers(restaurant.id, true),
  ]);

  if (!profile) redirect("/onboarding");

  const suppliers = suppliersRes.data ?? [];
  const supplierNames = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));

  const sectors = await loadAdministratifSectors(restaurant.id, supplierNames);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Building2}
        accentTone="bg-amber-50 text-amber-700"
        breadcrumbs={[
          { label: "Pilotage", href: "/pilotage" },
          { label: "RH", href: "/pilotage/rh" },
          { label: "Administratif" },
        ]}
        eyebrow="Espace gestion"
        title="Administratif"
        subtitle="Identité employeur, charges fixes et factures — organisées simplement par rubrique."
      />
      <AdministratifClient
        restaurantId={restaurant.id}
        profile={profile}
        sectors={sectors}
        suppliers={suppliers}
      />
    </PageContainer>
  );
}
