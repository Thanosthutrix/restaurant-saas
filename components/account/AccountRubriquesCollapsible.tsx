"use client";

import type { ReactNode } from "react";
import { CategoryTileShell } from "@/components/catalog/CategoryTileShell";
import { uiLead } from "@/components/ui/premium";

type Props = {
  rubriqueCount: number;
  children: ReactNode;
};

export function AccountRubriquesCollapsible({ rubriqueCount, children }: Props) {
  const subtitle =
    rubriqueCount === 0
      ? "Aucune rubrique · carte et stock"
      : `${rubriqueCount} rubrique${rubriqueCount > 1 ? "s" : ""} · carte et stock`;

  return (
    <section id="rubriques" className="scroll-mt-4">
      <CategoryTileShell
        tileKey="account-rubriques"
        title="Rubriques"
        subtitle={subtitle}
        panelId="account-rubriques-panel"
        depth={0}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <p className={`text-sm ${uiLead}`}>
            Créez vos propres rubriques et sous-rubriques pour classer les plats (carte) et les composants
            stock (ex. Vin → Bordeaux → Rouge). La portée indique si la rubrique apparaît pour la carte,
            pour le stock, ou pour les deux.
          </p>
          {children}
        </div>
      </CategoryTileShell>
    </section>
  );
}
