import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import {
  getDiningOrderLines,
  listDiningOrderPayments,
  orderTotalTtc,
  sumDiningOrderPayments,
} from "@/lib/dining/diningDb";
import { mapLinesToClients } from "@/lib/dining/diningOrderViewData";

export type OrderTicketSnapshot = {
  lines: DiningLineClient[];
  totalTtc: number;
  amountPaidTtc: number;
  amountDueTtc: number;
};

export async function fetchOrderTicketSnapshot(
  restaurantId: string,
  orderId: string
): Promise<{ data: OrderTicketSnapshot | null; error: string | null }> {
  const [linesRes, payRes] = await Promise.all([
    getDiningOrderLines(orderId, restaurantId),
    listDiningOrderPayments(orderId, restaurantId),
  ]);

  if (linesRes.error) return { data: null, error: linesRes.error.message };

  const rawLines = linesRes.data ?? [];
  const lines = mapLinesToClients(rawLines);
  const totalTtc = orderTotalTtc(rawLines);
  const amountPaidTtc = payRes.error ? 0 : sumDiningOrderPayments(payRes.data);
  const amountDueTtc = Math.max(0, Math.round((totalTtc - amountPaidTtc) * 100) / 100);

  return { data: { lines, totalTtc, amountPaidTtc, amountDueTtc }, error: null };
}
