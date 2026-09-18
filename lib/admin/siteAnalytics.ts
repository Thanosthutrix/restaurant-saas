import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";

export type SiteAnalyticsSummary = {
  uniqueToday: number;
  unique7d: number;
  unique30d: number;
  pageViewsToday: number;
  pageViews7d: number;
  topPaths7d: { path: string; views: number }[];
};

function sinceDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function sinceStartOfTodayUtc(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getSiteAnalyticsSummary(): Promise<SiteAnalyticsSummary> {
  const empty: SiteAnalyticsSummary = {
    uniqueToday: 0,
    unique7d: 0,
    unique30d: 0,
    pageViewsToday: 0,
    pageViews7d: 0,
    topPaths7d: [],
  };

  const todayIso = sinceStartOfTodayUtc();
  const d7 = sinceDays(7);
  const d30 = sinceDays(30);

  const [todayRows, weekRows, monthRows] = await Promise.all([
    supabaseServer
      .from("platform_site_visits")
      .select("session_key, path")
      .gte("visited_at", todayIso),
    supabaseServer
      .from("platform_site_visits")
      .select("session_key, path")
      .gte("visited_at", d7),
    supabaseServer
      .from("platform_site_visits")
      .select("session_key")
      .gte("visited_at", d30),
  ]);

  if (todayRows.error || weekRows.error || monthRows.error) {
    return empty;
  }

  const today = todayRows.data ?? [];
  const week = weekRows.data ?? [];
  const month = monthRows.data ?? [];

  const pathCounts = new Map<string, number>();
  for (const row of week) {
    const path = String(row.path);
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
  }

  const topPaths7d = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, views]) => ({ path, views }));

  return {
    uniqueToday: new Set(today.map((r) => r.session_key)).size,
    unique7d: new Set(week.map((r) => r.session_key)).size,
    unique30d: new Set(month.map((r) => r.session_key)).size,
    pageViewsToday: today.length,
    pageViews7d: week.length,
    topPaths7d,
  };
}
