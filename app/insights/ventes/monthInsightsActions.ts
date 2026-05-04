"use server";

import { getRestaurantForPage } from "@/lib/auth";
import {
  getSalesInsightsForCalendarMonth,
  toMonthSalesInsightsClientPayload,
  type MonthSalesInsightsForClient,
} from "@/lib/insights/salesInsights";

export async function loadMonthSalesInsightsAction(
  isoMonth: string
): Promise<{ ok: true; data: MonthSalesInsightsForClient } | { ok: false; error: string }> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) return { ok: false, error: "Restaurant introuvable." };
  if (!/^\d{4}-\d{2}$/.test(isoMonth)) return { ok: false, error: "Mois invalide." };

  const full = await getSalesInsightsForCalendarMonth(restaurant.id, isoMonth);
  const data = toMonthSalesInsightsClientPayload(full);
  return { ok: true, data };
}
