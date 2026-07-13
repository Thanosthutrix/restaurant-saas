import { redirect, notFound } from "next/navigation";
import { Banknote } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { formatPeriodMonthLabel } from "@/lib/rh/payslipMonth";
import { getPayrollPeriodByMonth, getPayrollPeriodBundle, loadPayrollEmployerPct } from "@/lib/rh/payslipsDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { PaiePeriodClient } from "../PaiePeriodClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ month: string }> };

export default async function PaiePeriodPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");

  const { month } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();

  const restaurantId = ctx.currentRestaurant.id;
  const period = await getPayrollPeriodByMonth(restaurantId, month);
  if (!period) notFound();

  const [bundle, payrollEmployerPct] = await Promise.all([
    getPayrollPeriodBundle(restaurantId, period.id),
    loadPayrollEmployerPct(restaurantId),
  ]);

  if (!bundle) notFound();

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Banknote}
        accentTone="bg-emerald-50 text-emerald-700"
        breadcrumbs={[
          { label: "Pilotage", href: "/pilotage" },
          { label: "RH", href: "/pilotage/rh" },
          { label: "Fiches de paie", href: "/pilotage/rh/paie" },
          { label: formatPeriodMonthLabel(month) },
        ]}
        eyebrow="Période mensuelle"
        title={formatPeriodMonthLabel(month)}
        subtitle="Workflow : import planning → validation heures → calcul → finalisation."
      />
      <PaiePeriodClient
        restaurantId={restaurantId}
        bundle={bundle}
        payrollEmployerPct={payrollEmployerPct}
      />
    </PageContainer>
  );
}
