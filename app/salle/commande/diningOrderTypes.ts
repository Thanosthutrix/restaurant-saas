import type { DiningDiscountKind } from "@/lib/dining/lineDiscount";

export type DiningLineClient = {
  id: string;
  dishId: string;
  dishName: string;
  qty: number;
  /** Cuisine : ligne marquée comme prête. */
  isPrepared: boolean;
  /** Prix catalogue × qté (avant remise). */
  lineGrossTtc: number;
  /** TTC ligne après remise. */
  lineTotalTtc: number;
  discountKind: DiningDiscountKind;
  discountValue: number | null;
};
