import { supabaseServer } from "@/lib/supabaseServer";
import { listPublicMenuItemsFromDb, listPublicReviewsFromDb } from "@/lib/public/publicDb";
import { formatBudgetRange } from "@/lib/public/budgetRange";

export type FactualSnapshot = {
  refreshedAt: string;
  restaurantName: string;
  publicDishCount: number;
  avgPublicDishPriceTtc: number | null;
  budgetLabel: string;
  signatureMenuItems: string[];
  recentReviewSnippets: { rating: number; excerpt: string; certified: boolean }[];
  avgReviewRating: number | null;
  reviewCount: number;
};

export async function buildFactualSnapshot(restaurantId: string): Promise<FactualSnapshot> {
  const now = new Date().toISOString();

  const [{ data: rest }, menu, reviews] = await Promise.all([
    supabaseServer.from("restaurants").select("name").eq("id", restaurantId).maybeSingle(),
    listPublicMenuItemsFromDb(restaurantId),
    listPublicReviewsFromDb(restaurantId),
  ]);

  const prices = menu.map((m) => m.price).filter((p) => Number.isFinite(p) && p > 0);
  const avg =
    prices.length > 0 ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : null;

  const topDishes = [...menu]
    .sort((a, b) => b.price - a.price)
    .slice(0, 5)
    .map((m) => m.name);

  const recentReviews = reviews.slice(0, 8);
  const ratings = recentReviews.map((r) => r.rating).filter((r) => Number.isFinite(r));
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  return {
    refreshedAt: now,
    restaurantName: String((rest as { name?: string } | null)?.name ?? ""),
    publicDishCount: menu.length,
    avgPublicDishPriceTtc: avg,
    budgetLabel: formatBudgetRange(avg),
    signatureMenuItems: topDishes,
    recentReviewSnippets: recentReviews.map((r) => ({
      rating: r.rating,
      excerpt: r.comment.trim().slice(0, 180),
      certified: r.is_certified,
    })),
    avgReviewRating: avgRating,
    reviewCount: reviews.length,
  };
}
