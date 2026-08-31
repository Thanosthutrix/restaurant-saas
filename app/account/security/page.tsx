import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getMfaStatus } from "@/lib/auth/mfaGate";
import { SecuritySettingsPanel } from "@/components/auth/SecuritySettingsPanel";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

export default async function AccountSecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [status, isAdmin] = await Promise.all([getMfaStatus(), isCurrentUserAdmin()]);

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Compte", href: "/account" },
          { label: "Sécurité" },
        ]}
        title="Sécurité du compte"
        subtitle={
          <>
            <Shield className="mr-1 inline h-4 w-4 text-stone-500" aria-hidden />
            Mot de passe et double authentification
          </>
        }
      />

      <SecuritySettingsPanel
        hasVerifiedTotp={status?.hasVerifiedTotp ?? false}
        verifiedFactors={status?.verifiedFactors ?? []}
        isAdmin={isAdmin}
        settingsBackHref="/account"
        enrollNextUrl="/account/security"
      />
    </PageContainer>
  );
}
