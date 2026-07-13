import Link from "next/link";
import { redirect } from "next/navigation";
import { FileWarning } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { supabaseServer } from "@/lib/supabaseServer";
import { getEmployerProfile } from "@/lib/rh/employerProfile";
import { listDsnSignalements } from "@/lib/rh/dsnSignalementsDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { uiBtnSecondary } from "@/components/ui/premium";
import { DsnSignalementsClient } from "./DsnSignalementsClient";

export const dynamic = "force-dynamic";

export default async function DsnSignalementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");

  const restaurantId = ctx.currentRestaurant.id;

  const [signalements, profile, staffRes] = await Promise.all([
    listDsnSignalements(restaurantId),
    getEmployerProfile(restaurantId),
    supabaseServer
      .from("staff_members")
      .select("id, display_name, active")
      .eq("restaurant_id", restaurantId)
      .order("display_name"),
  ]);

  if (staffRes.error) throw new Error(staffRes.error.message);

  const staffOptions = (staffRes.data ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    displayName: String((r as { display_name: string }).display_name ?? "Employé"),
    active: Boolean((r as { active: boolean }).active),
  }));

  return (
    <PageContainer>
      <PageHeader
        accentIcon={FileWarning}
        accentTone="bg-amber-50 text-amber-700"
        breadcrumbs={[
          { label: "Pilotage", href: "/pilotage" },
          { label: "RH", href: "/pilotage/rh" },
          { label: "Fiches de paie", href: "/pilotage/rh/paie" },
          { label: "Signalements DSN" },
        ]}
        eyebrow="Espace gestion"
        title="Signalements DSN"
        subtitle="Arrêts de travail, reprises anticipées et fins de contrat — délai légal 5 jours ouvrés."
        actions={
          <Link href="/pilotage/rh/paie" className={uiBtnSecondary}>
            Retour paie
          </Link>
        }
      />
      <DsnSignalementsClient
        restaurantId={restaurantId}
        signalements={signalements}
        staffOptions={staffOptions}
        hasEmployerSiret={Boolean(profile?.siret?.trim())}
      />
    </PageContainer>
  );
}
