import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import {
  emptyTableServiceStatus,
  waitColorFromElapsedMinutes,
  type DiningWaitThresholds,
  type TableChannelStatus,
  type TableServiceStatus,
} from "./diningWaitSettings";

type OrderReadySignals = {
  orderId: string;
  diningTableId: string | null;
  kitchenReadyNotifiedAt: string | null;
  kitchenReadyAckAt: string | null;
  barReadyNotifiedAt: string | null;
  barReadyAckAt: string | null;
};

function isBlinking(notifiedAt: string | null, ackAt: string | null): boolean {
  if (!notifiedAt) return false;
  if (!ackAt) return true;
  return new Date(notifiedAt).getTime() > new Date(ackAt).getTime();
}

function elapsedMinutesSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60_000);
}

function buildChannelStatus(params: {
  orderId: string;
  lines: DiningLineClient[];
  isBar: boolean;
  notifiedAt: string | null;
  ackAt: string | null;
  thresholds: DiningWaitThresholds;
}): TableChannelStatus {
  const channelLines = params.lines.filter((l) =>
    params.isBar ? l.isBarLine : !l.isBarLine
  );
  const sentLines = channelLines.filter((l) => l.sentToKitchenAt);
  if (sentLines.length === 0) {
    return { orderId: params.orderId, active: false, waitColor: null, blinking: false };
  }

  const pendingLines = sentLines.filter((l) => !l.isPrepared);
  const allPrepared = sentLines.length > 0 && pendingLines.length === 0;

  if (allPrepared) {
    return {
      orderId: params.orderId,
      active: true,
      waitColor: null,
      blinking: isBlinking(params.notifiedAt, params.ackAt),
    };
  }

  const oldestSent = sentLines
    .map((l) => l.sentToKitchenAt!)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]!;

  return {
    orderId: params.orderId,
    active: true,
    waitColor: waitColorFromElapsedMinutes(elapsedMinutesSince(oldestSent), params.thresholds),
    blinking: false,
  };
}

export function buildTableServiceStatusMap(params: {
  orders: OrderReadySignals[];
  linesByOrderId: Map<string, DiningLineClient[]>;
  thresholds: DiningWaitThresholds;
}): Map<string, TableServiceStatus> {
  const out = new Map<string, TableServiceStatus>();

  for (const order of params.orders) {
    if (!order.diningTableId) continue;
    const lines = params.linesByOrderId.get(order.orderId) ?? [];
    const kitchen = buildChannelStatus({
      orderId: order.orderId,
      lines,
      isBar: false,
      notifiedAt: order.kitchenReadyNotifiedAt,
      ackAt: order.kitchenReadyAckAt,
      thresholds: params.thresholds,
    });
    const bar = buildChannelStatus({
      orderId: order.orderId,
      lines,
      isBar: true,
      notifiedAt: order.barReadyNotifiedAt,
      ackAt: order.barReadyAckAt,
      thresholds: params.thresholds,
    });

    if (!kitchen.active && !bar.active) continue;

    out.set(order.diningTableId, { kitchen, bar });
  }

  return out;
}

export function tableHasBlinkingStatus(status: TableServiceStatus | undefined): boolean {
  if (!status) return false;
  return status.kitchen.blinking || status.bar.blinking;
}

export { emptyTableServiceStatus };
export type { TableChannelStatus, TableServiceStatus };
