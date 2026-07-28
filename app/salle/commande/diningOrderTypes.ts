import type { DiningDiscountKind } from "@/lib/dining/lineDiscount";

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
};
