import type { HygieneScore } from "@/lib/public/types";

export type LiveHygienePublicView = {
  label: HygieneScore;
  numericScore: number | null;
  hasData: boolean;
  detail: string;
};

/**
 * Convertit le score hygiène ERP (0–100, 7 jours glissants) en libellé public transparent.
 */
export function mapLiveHygieneToPublicView(
  score: number,
  hasData: boolean,
  detail: string
): LiveHygienePublicView {
  if (!hasData) {
    return {
      label: "Non communiqué",
      numericScore: null,
      hasData: false,
      detail: detail || "Pas encore de données de suivi hygiène.",
    };
  }

  if (score >= 85) {
    return {
      label: "Très satisfaisant",
      numericScore: score,
      hasData: true,
      detail,
    };
  }

  if (score >= 60) {
    return {
      label: "Satisfaisant",
      numericScore: score,
      hasData: true,
      detail,
    };
  }

  return {
    label: "À améliorer",
    numericScore: score,
    hasData: true,
    detail,
  };
}
