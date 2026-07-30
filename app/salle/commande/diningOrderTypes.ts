import type { DiningDiscountKind } from "@/lib/dining/lineDiscount";
import type { DiningLineModification } from "@/lib/dining/lineModificationTypes";
import type { MenuCategory } from "@/lib/public/menuCategories";
import { isMenuCategory } from "@/lib/public/menuCategories";

export type DiningLineClient = {
  id: string;
  dishId: string;
  dishName: string;
  qty: number;
  /** Cuisine : ligne marquée comme prête. */
  isPrepared: boolean;
  /** Service repas (entrée / plat / dessert), null = boisson etc. */
  courseType: "entrée" | "plat" | "dessert" | null;
  /** Envoi cuisine par le serveur. */
  sentToKitchenAt: string | null;
  /** Prix catalogue × qté (avant remise). */
  lineGrossTtc: number;
  /** TTC ligne après remise. */
  lineTotalTtc: number;
  discountKind: DiningDiscountKind;
  discountValue: number | null;
  /** Retraits garniture / changements accompagnement. */
  modifications: DiningLineModification[];
  /** Libellés modifs en cours (ticket serveur). */
  kitchenLabels: string[];
  /** Catégorie carte (boisson, vin, plat…). */
  menuCategory: MenuCategory | null;
  /** Chemin rubrique carte (ex. Boissons › Cocktails). */
  categoryPath: string | null;
  /** Ligne routée vers le pass bar. */
  isBarLine: boolean;
  /** Modifs en attente de validation serveur pour le pass cuisine. */
  pendingKitchenMods: boolean;
  /** Au moins un composant retirable ou accompagnement substituable. */
  canCustomize: boolean;
};
