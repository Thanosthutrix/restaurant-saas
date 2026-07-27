import "server-only";

import { isPushSendConfigured } from "./pushConfig";
import { listPushTokensForRestaurant } from "./pushTokenDb";
import { sendPushToDevices } from "./pushSendService";

/** Alerte l'équipe qu'un plat vient d'être commandé en salle (pass cuisine). */
export async function notifyKitchenNewOrderLine(params: {
  restaurantId: string;
  orderLabel: string;
  dishName: string;
  qty: number;
}): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!isPushSendConfigured()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const tokens = await listPushTokensForRestaurant(params.restaurantId);
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const qtyLabel = params.qty > 1 ? `${params.qty}× ` : "";
  const result = await sendPushToDevices({
    tokens,
    title: `Cuisine · ${params.orderLabel}`,
    body: `${qtyLabel}${params.dishName}`,
    data: {
      type: "kitchen_order",
      restaurantId: params.restaurantId,
      url: "/cuisine/pass",
    },
  });

  return { ...result, skipped: false };
}
