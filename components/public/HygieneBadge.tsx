import { ShieldCheck } from "lucide-react";
import type { HygieneScore } from "@/lib/public/types";

type Props = {
  score: HygieneScore;
  liveScore?: number | null;
  hasLiveData?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "px-2 py-1 text-[0.65rem]",
  md: "px-3 py-1.5 text-xs",
  lg: "px-4 py-2 text-sm",
};

export function HygieneBadge({
  score,
  liveScore,
  hasLiveData = false,
  size = "md",
  className = "",
}: Props) {
  const isExcellent = score === "Très satisfaisant" || score === "Satisfaisant";
  const liveSuffix =
    hasLiveData && liveScore != null ? ` · ${liveScore}/100` : "";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wide ${
        isExcellent
          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/20"
          : score === "Non communiqué"
            ? "bg-stone-500 text-white"
            : "bg-amber-500 text-white"
      } ${sizeClasses[size]} ${className}`}
      title={
        hasLiveData
          ? "Score calculé en direct depuis le module hygiène ERP (7 derniers jours)"
          : undefined
      }
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Score Hygiène : {score.toUpperCase()}
      {liveSuffix}
    </span>
  );
}
