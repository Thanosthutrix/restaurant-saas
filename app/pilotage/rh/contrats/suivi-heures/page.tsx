import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { loadContractHoursReport } from "@/lib/rh/contractHoursReport";
import { currentYmParis } from "@/lib/rh/payslipMonth";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { uiBtnSecondary } from "@/components/ui/premium";
import { ContractHoursReportClient } from "@/components/rh/ContractHoursReportClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

function ymValid(ym: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}

export default async function ContractHoursReportPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");

  const sp = await searchParams;
  const periodYm = sp.month && ymValid(sp.month) ? sp.month : currentYmParis();
  const restaurantId = ctx.currentRestaurant.id;

  const report = await loadContractHoursReport(restaurantId, periodYm);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={BarChart3}
        accentTone="bg-violet-50 text-violet-700"
        breadcrumbs={[
          { label: "Pilotage", href: "/pilotage" },
          { label: "RH", href: "/pilotage/rh" },
          { label: "Contrats", href: "/pilotage/rh/contrats" },
          { label: "Suivi heures" },
        ]}
        eyebrow="LegalTech RH"
        title="Suivi heures — contrat vs planning"
        subtitle="Comparez les heures contractuelles (CDD/CDI) aux heures prévues et pointées sur la période du contrat."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/pilotage/rh/contrats" className={uiBtnSecondary}>
              Contrats
            </Link>
            <Link href="/equipe" className={uiBtnSecondary}>
              Planning
            </Link>
          </div>
        }
      />

      <ContractHoursReportClient restaurantId={restaurantId} report={report} />
    </PageContainer>
  );
}
