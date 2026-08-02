import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { getLatestAnalysisReport } from "@/lib/analysis/analysisReportDb";
import {
  defaultMarginDateRange,
  parseMarginDateParam,
} from "@/lib/margins/realizedServiceMargins";
import { UltimateAnalysisDashboard } from "@/components/analysis/UltimateAnalysisDashboard";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { uiBtnSecondary } from "@/components/ui/premium";

type SearchParams = { from?: string; to?: string };

export default async function AnalysePilotagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const defaults = defaultMarginDateRange();
  let from = parseMarginDateParam(sp.from, defaults.from);
  let to = parseMarginDateParam(sp.to, defaults.to);
  if (from > to) {
    const x = from;
    from = to;
    to = x;
  }

  const { data: report } = await getLatestAnalysisReport(restaurant.id);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Sparkles}
        accentTone="bg-violet-50 text-violet-700"
        breadcrumbs={[{ label: "Pilotage", href: "/pilotage" }, { label: "Analyse ultime" }]}
        title="Analyse ultime"
        subtitle={`${restaurant.name} · anti-gaspillage & optimisation recettes`}
        actions={
          <>
            <Link href="/margins" className={uiBtnSecondary}>
              Marges détaillées
            </Link>
            <Link href="/cuisine/pertes" className={uiBtnSecondary}>
              Pertes
            </Link>
            <Link href="/insights/ventes" className={uiBtnSecondary}>
              Ventes
            </Link>
          </>
        }
      />
      <UltimateAnalysisDashboard
        restaurantId={restaurant.id}
        initialReport={report}
        defaultFrom={from}
        defaultTo={to}
      />
    </PageContainer>
  );
}
