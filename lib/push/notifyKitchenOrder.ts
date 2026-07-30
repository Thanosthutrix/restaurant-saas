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
  return notifyKitchenOrderBatch({
    restaurantId: params.restaurantId,
    orderLabel: params.orderLabel,
    batchLabel: params.dishName,
    lines: [{ dishName: params.dishName, qty: params.qty, kitchenLabels: [] }],
  });
}

type KitchenBatchLine = {
  dishName: string;
  qty: number;
  kitchenLabels?: string[];
};

/** Une seule notification pour un lot complet envoyé au bar. */
export async function notifyBarOrderBatch(params: {
  restaurantId: string;
  orderLabel: string;
  batchLabel: string;
  lines: KitchenBatchLine[];
}): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!isPushSendConfigured()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const tokens = await listPushTokensForRestaurant(params.restaurantId);
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const preview = params.lines
    .slice(0, 3)
    .map((l) => `${l.qty}× ${l.dishName}`)
    .join(" · ");
  const suffix = params.lines.length > 3 ? ` (+${params.lines.length - 3})` : "";
  const body = preview ? `${preview}${suffix}` : `${params.lines.length} boisson(s)`;

  const result = await sendPushToDevices({
    tokens,
    title: `Bar · ${params.orderLabel}`,
    body,
    data: {
      type: "bar_order",
      restaurantId: params.restaurantId,
      url: "/bar/pass",
    },
  });

  return { ...result, skipped: false };
}

/** Une seule notification pour un lot complet envoyé en cuisine. */
export async function notifyKitchenOrderBatch(params: {
  restaurantId: string;
  orderLabel: string;
  batchLabel: string;
  lines: KitchenBatchLine[];
}): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!isPushSendConfigured()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const tokens = await listPushTokensForRestaurant(params.restaurantId);
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const totalQty = params.lines.reduce((n, l) => n + l.qty, 0);
  const preview = params.lines
    .slice(0, 3)
    .map((l) => `${l.qty}× ${l.dishName}`)
    .join(" · ");
  const suffix = params.lines.length > 3 ? ` (+${params.lines.length - 3})` : "";
  const body = preview ? `${preview}${suffix}` : `${totalQty} article(s)`;

  const result = await sendPushToDevices({
    tokens,
    title: `Cuisine · ${params.orderLabel} — ${params.batchLabel}`,
    body,
    data: {
      type: "kitchen_order",
      restaurantId: params.restaurantId,
      url: "/cuisine/pass",
    },
  });

  return { ...result, skipped: false };
}
