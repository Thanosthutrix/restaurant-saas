export type DiningWaitThresholds = {
  /** Minutes avant passage bleu → vert. */
  greenMinutes: number;
  /** Minutes avant passage vert → orange. */
  orangeMinutes: number;
  /** Minutes avant passage orange → rouge. */
  redMinutes: number;
};

export const DEFAULT_DINING_WAIT_THRESHOLDS: DiningWaitThresholds = {
  greenMinutes: 10,
  orangeMinutes: 20,
  redMinutes: 30,
};

export function parseDiningWaitThresholds(row: {
  dining_wait_green_minutes?: unknown;
  dining_wait_orange_minutes?: unknown;
  dining_wait_red_minutes?: unknown;
} | null | undefined): DiningWaitThresholds {
  const green = Number(row?.dining_wait_green_minutes);
  const orange = Number(row?.dining_wait_orange_minutes);
  const red = Number(row?.dining_wait_red_minutes);
  const greenMinutes = Number.isFinite(green) && green > 0 ? Math.round(green) : DEFAULT_DINING_WAIT_THRESHOLDS.greenMinutes;
  const orangeMinutes =
    Number.isFinite(orange) && orange > greenMinutes
      ? Math.round(orange)
      : Math.max(greenMinutes + 1, DEFAULT_DINING_WAIT_THRESHOLDS.orangeMinutes);
  const redMinutes =
    Number.isFinite(red) && red > orangeMinutes
      ? Math.round(red)
      : Math.max(orangeMinutes + 1, DEFAULT_DINING_WAIT_THRESHOLDS.redMinutes);
  return { greenMinutes, orangeMinutes, redMinutes };
}

export type TableWaitColor = "blue" | "green" | "orange" | "red";

export function waitColorFromElapsedMinutes(
  elapsedMinutes: number,
  thresholds: DiningWaitThresholds
): TableWaitColor {
  if (elapsedMinutes < thresholds.greenMinutes) return "blue";
  if (elapsedMinutes < thresholds.orangeMinutes) return "green";
  if (elapsedMinutes < thresholds.redMinutes) return "orange";
  return "red";
}

export const TABLE_WAIT_COLOR_CLASS: Record<TableWaitColor, string> = {
  blue: "bg-sky-500",
  green: "bg-emerald-500",
  orange: "bg-orange-500",
  red: "bg-rose-600",
};

/** Priorité d'affichage pass (rouge en premier). */
export function waitColorUrgencyRank(color: TableWaitColor): number {
  return { blue: 1, green: 2, orange: 3, red: 4 }[color];
}

export function elapsedMinutesSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60_000);
}

export function waitColorFromSentAt(
  sentAt: string | null | undefined,
  thresholds: DiningWaitThresholds
): TableWaitColor {
  if (!sentAt) return "blue";
  return waitColorFromElapsedMinutes(elapsedMinutesSince(sentAt), thresholds);
}

export type TableChannelStatus = {
  orderId: string | null;
  /** Au moins une ligne envoyée sur ce circuit. */
  active: boolean;
  /** Couleur d'attente (null si prêt à servir / clignotement). */
  waitColor: TableWaitColor | null;
  /** Prêt en cuisine / bar, en attente d'acquittement serveur. */
  blinking: boolean;
};

export type TableServiceStatus = {
  kitchen: TableChannelStatus;
  bar: TableChannelStatus;
};

export function emptyTableServiceStatus(): TableServiceStatus {
  const idle: TableChannelStatus = {
    orderId: null,
    active: false,
    waitColor: null,
    blinking: false,
  };
  return { kitchen: { ...idle }, bar: { ...idle } };
}
