import Link from "next/link";
import { FlaskConical } from "lucide-react";
import type { TrialBannerInfo } from "@/lib/pro/trialStatus";

type Props = {
  trial: TrialBannerInfo;
};

function formatDaysLabel(days: number): string {
  if (days <= 0) return "dernier jour";
  if (days === 1) return "1 jour restant";
  return `${days} jours restants`;
}

export function TrialPeriodBanner({ trial }: Props) {
  const daysLabel = formatDaysLabel(trial.daysRemaining);
  const ctaHref = trial.phase === "signup" ? "/onboarding" : "/settings/billing";
  const ctaLabel = trial.phase === "signup" ? "Créer mon établissement" : "Voir l'abonnement";

  return (
    <div
      className="border-b border-amber-300/80 bg-gradient-to-r from-amber-50 via-amber-100/90 to-orange-50 px-4 py-2 text-amber-950"
      role="status"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs sm:text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
          Période d&apos;essai · {daysLabel}
        </span>
        <span className="hidden text-amber-800/80 sm:inline">·</span>
        <Link href={ctaHref} className="font-medium text-amber-900 underline-offset-2 hover:underline">
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
