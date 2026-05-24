export const REGISTRES_TABS = ["bl", "factures", "nettoyage", "temperatures", "preparations"] as const;
export type RegistresTab = (typeof REGISTRES_TABS)[number];

export const REGISTRES_TAB_LABELS: Record<RegistresTab, string> = {
  bl: "Bons de livraison",
  factures: "Factures",
  nettoyage: "Nettoyage",
  temperatures: "Températures",
  preparations: "Préparations",
};

export function parseRegistresTab(raw: string | undefined): RegistresTab {
  if (raw && (REGISTRES_TABS as readonly string[]).includes(raw)) {
    return raw as RegistresTab;
  }
  return "bl";
}
