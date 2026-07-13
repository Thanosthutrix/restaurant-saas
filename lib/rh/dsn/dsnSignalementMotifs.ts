/** Motifs arrêt de travail — S21.G00.60.001 */
export const ARRET_MOTIF_OPTIONS = [
  { code: "01", label: "Maladie" },
  { code: "02", label: "Maternité" },
  { code: "03", label: "Paternité / accueil enfant" },
  { code: "04", label: "Accident de trajet" },
  { code: "05", label: "Maladie professionnelle" },
  { code: "06", label: "Accident du travail" },
] as const;

/** Motifs reprise — S21.G00.60.011 */
export const REPRISE_MOTIF_OPTIONS = [
  { code: "01", label: "Reprise normale" },
  { code: "02", label: "Reprise temps partiel thérapeutique" },
] as const;

/** Motifs rupture contrat — S21.G00.62.002 (extraits courants restauration) */
export const FIN_CONTRAT_MOTIF_OPTIONS = [
  { code: "008", label: "Fin de CDD" },
  { code: "059", label: "Démission" },
  { code: "098", label: "Fin de période d'essai" },
  { code: "084", label: "Rupture d'un commun accord (CDD / apprentissage)" },
  { code: "020", label: "Licenciement pour autre motif" },
  { code: "014", label: "Licenciement pour motif économique" },
  { code: "043", label: "Rupture conventionnelle" },
  { code: "039", label: "Départ à la retraite (initiative salarié)" },
  { code: "038", label: "Mise à la retraite par l'employeur" },
] as const;

export function motifLabelForKind(
  kind: "arret_travail" | "reprise_arret" | "fin_contrat",
  code: string
): string {
  const list =
    kind === "arret_travail"
      ? ARRET_MOTIF_OPTIONS
      : kind === "reprise_arret"
        ? REPRISE_MOTIF_OPTIONS
        : FIN_CONTRAT_MOTIF_OPTIONS;
  return list.find((m) => m.code === code)?.label ?? code;
}
