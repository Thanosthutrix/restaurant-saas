import { supabaseServer } from "@/lib/supabaseServer";
import { getPublicSocialData } from "@/lib/meta/metaDb";
import { getHygieneScoreForRestaurant } from "@/lib/hygiene/hygieneDb";
import { getEstablishmentLabels } from "@/lib/restaurant/establishmentLabels";
import {
  buildOpeningHoursSchedule,
  formatOpeningHoursForPublic,
} from "@/lib/public/formatOpeningHours";
import { mapLiveHygieneToPublicView } from "@/lib/public/liveHygieneLabel";
import { formatBudgetRange } from "@/lib/public/budgetRange";
import { resolveRestaurantMarkerKind } from "@/lib/public/restaurantMapMarker";
import { isMenuFormulaType, resolveSetMenuDessertTiming } from "@/lib/public/menuFormulas";
import type { MenuCategory, MenuItem, PublicSetMenu, PublicSetMenuDish, Restaurant, Review } from "@/lib/public/types";
import { isMenuCategory, normalizeMenuCategory } from "@/lib/public/menuCategories";
import { isValidSetMenuStepCategory } from "@/lib/public/setMenuDishes";

const PUBLIC_RESTAURANT_SELECT =
  "id, name, description, address_text, activity_type, template_slug, image_url, cover_url, is_public_listed, planning_opening_hours, closed_days_of_week, latitude, longitude, phone, email, instagram_url, facebook_url, instagram_username";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80";

type PublicRestaurantRow = {
  id: string;
  name: string;
  description: string | null;
  address_text: string | null;
  activity_type: string | null;
  template_slug: string | null;
  image_url: string | null;
  cover_url: string | null;
  is_public_listed: boolean;
  planning_opening_hours: unknown;
  closed_days_of_week: number[] | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  instagram_username: string | null;
};

type PublicDishRow = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  selling_price_ttc: number | null;
  menu_category: string | null;
  is_public: boolean;
  image_url: string | null;
  model_3d_source_image_url: string | null;
};

type PublicReviewRow = {
  id: string;
  restaurant_id: string;
  rating: number;
  comment: string;
  author_name: string | null;
  is_certified: boolean;
  created_at: string;
};

function resolveCuisineType(row: PublicRestaurantRow): string {
  const labels = getEstablishmentLabels({
    id: row.id,
    owner_id: "",
    name: row.name,
    messaging_sender_display_name: null,
    activity_type: row.activity_type,
    template_slug: row.template_slug,
    avg_covers: null,
    service_type: null,
    latitude: null,
    longitude: null,
    school_zone: null,
    address_text: row.address_text,
    school_zone_is_manual: false,
    closed_days_of_week: row.closed_days_of_week ?? [],
    created_at: "",
    updated_at: "",
  });
  return labels.activityLabel !== "—" ? labels.activityLabel : "Restaurant";
}

async function mapRestaurantRow(
  row: PublicRestaurantRow,
  stats: { average_rating: number; review_count: number },
  avgPublicDishPrice: number | null
): Promise<Restaurant> {
  const closedDays = Array.isArray(row.closed_days_of_week) ? row.closed_days_of_week : [];
  const openingHours = formatOpeningHoursForPublic(row.planning_opening_hours, closedDays);
  const openingSchedule = buildOpeningHoursSchedule(row.planning_opening_hours, closedDays);

  const hygieneRaw = await getHygieneScoreForRestaurant(row.id, 7);
  const hygiene = mapLiveHygieneToPublicView(
    hygieneRaw.score,
    hygieneRaw.max > 0,
    hygieneRaw.detail
  );

  const address = row.address_text?.trim() || "Adresse non renseignée";

  return {
    id: row.id,
    name: row.name,
    description: row.description?.trim() || "",
    address,
    cuisine_type: resolveCuisineType(row),
    template_slug: row.template_slug,
    activity_type: row.activity_type,
    marker_kind: resolveRestaurantMarkerKind({
      template_slug: row.template_slug,
      activity_type: row.activity_type,
    }),
    hygiene_score: hygiene.label,
    hygiene_score_live: hygiene.numericScore,
    hygiene_has_live_data: hygiene.hasData,
    hygiene_score_detail: hygiene.detail,
    image_url: row.image_url?.trim() || row.cover_url?.trim() || DEFAULT_IMAGE,
    cover_url: row.cover_url?.trim() || row.image_url?.trim() || DEFAULT_IMAGE,
    average_rating: stats.average_rating,
    review_count: stats.review_count,
    budget_label: formatBudgetRange(avgPublicDishPrice),
    opening_hours: openingHours,
    opening_hours_schedule: openingSchedule,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    phone: row.phone?.trim() || undefined,
    email: row.email?.trim() || undefined,
    social_links: {
      instagram_url: row.instagram_url?.trim() || null,
      facebook_url: row.facebook_url?.trim() || null,
      instagram_username: row.instagram_username?.trim() || null,
    },
  };
}


function mapDishRow(row: PublicDishRow): MenuItem {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name,
    description: row.description?.trim() || "",
    price: row.selling_price_ttc != null ? Number(row.selling_price_ttc) : 0,
    category: normalizeMenuCategory(row.menu_category),
    is_public: row.is_public,
    image_url:
      row.image_url?.trim() ||
      row.model_3d_source_image_url?.trim() ||
      undefined,
  };
}

function mapReviewRow(row: PublicReviewRow): Review {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    rating: Number(row.rating),
    comment: row.comment,
    created_at: row.created_at,
    is_certified: row.is_certified,
    author_name: row.author_name?.trim() || undefined,
  };
}

async function fetchReviewStats(restaurantIds: string[]): Promise<
  Map<string, { average_rating: number; review_count: number }>
> {
  const stats = new Map<string, { average_rating: number; review_count: number }>();
  if (restaurantIds.length === 0) return stats;

  const { data, error } = await supabaseServer
    .from("restaurant_reviews")
    .select("restaurant_id, rating")
    .in("restaurant_id", restaurantIds);

  if (error || !data) {
    for (const id of restaurantIds) {
      stats.set(id, { average_rating: 0, review_count: 0 });
    }
    return stats;
  }

  const buckets = new Map<string, number[]>();
  for (const row of data as { restaurant_id: string; rating: number }[]) {
    const list = buckets.get(row.restaurant_id) ?? [];
    list.push(Number(row.rating));
    buckets.set(row.restaurant_id, list);
  }

  for (const id of restaurantIds) {
    const ratings = buckets.get(id) ?? [];
    if (ratings.length === 0) {
      stats.set(id, { average_rating: 0, review_count: 0 });
      continue;
    }
    const sum = ratings.reduce((a, b) => a + b, 0);
    stats.set(id, {
      average_rating: Math.round((sum / ratings.length) * 10) / 10,
      review_count: ratings.length,
    });
  }

  return stats;
}

async function fetchAvgPublicDishPrices(
  restaurantIds: string[]
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (restaurantIds.length === 0) return result;

  const { data, error } = await supabaseServer
    .from("dishes")
    .select("restaurant_id, selling_price_ttc")
    .in("restaurant_id", restaurantIds)
    .eq("is_public", true);

  if (error || !data) {
    for (const id of restaurantIds) result.set(id, null);
    return result;
  }

  const buckets = new Map<string, number[]>();
  for (const row of data as { restaurant_id: string; selling_price_ttc: number | null }[]) {
    const price = row.selling_price_ttc != null ? Number(row.selling_price_ttc) : 0;
    if (price <= 0) continue;
    const list = buckets.get(row.restaurant_id) ?? [];
    list.push(price);
    buckets.set(row.restaurant_id, list);
  }

  for (const id of restaurantIds) {
    const prices = buckets.get(id) ?? [];
    if (prices.length === 0) {
      result.set(id, null);
      continue;
    }
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    result.set(id, Math.round(avg * 100) / 100);
  }

  return result;
}

export async function listListedRestaurantsFromDb(): Promise<Restaurant[]> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select(PUBLIC_RESTAURANT_SELECT)
    .eq("is_public_listed", true)
    .order("name");

  if (error) {
    console.error("[publicDb] listListedRestaurantsFromDb:", error.message);
    return [];
  }

  const rows = (data ?? []) as PublicRestaurantRow[];
  const ids = rows.map((r) => r.id);
  const [stats, avgPrices] = await Promise.all([
    fetchReviewStats(ids),
    fetchAvgPublicDishPrices(ids),
  ]);
  return Promise.all(
    rows.map((row) =>
      mapRestaurantRow(
        row,
        stats.get(row.id) ?? { average_rating: 0, review_count: 0 },
        avgPrices.get(row.id) ?? null
      )
    )
  );
}

export async function getListedRestaurantFromDb(id: string): Promise<Restaurant | null> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select(PUBLIC_RESTAURANT_SELECT)
    .eq("id", id)
    .eq("is_public_listed", true)
    .maybeSingle();

  if (error) {
    console.error("[publicDb] getListedRestaurantFromDb:", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as PublicRestaurantRow;
  const [stats, avgPrices] = await Promise.all([
    fetchReviewStats([row.id]),
    fetchAvgPublicDishPrices([row.id]),
  ]);
  return mapRestaurantRow(
    row,
    stats.get(row.id) ?? { average_rating: 0, review_count: 0 },
    avgPrices.get(row.id) ?? null
  );
}

export async function listPublicMenuItemsFromDb(restaurantId: string): Promise<MenuItem[]> {
  const { data, error } = await supabaseServer
    .from("dishes")
    .select(
      "id, restaurant_id, name, description, selling_price_ttc, menu_category, is_public, image_url, model_3d_source_image_url"
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_public", true)
    .order("name");

  if (error) {
    console.error("[publicDb] listPublicMenuItemsFromDb:", error.message);
    return [];
  }

  return ((data ?? []) as PublicDishRow[]).map(mapDishRow);
}

type PublicSetMenuRow = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price_ttc: number;
  formula_type: string;
  dessert_timing: string | null;
  is_public: boolean;
  sort_order: number;
};

type PublicSetMenuDishRow = {
  menu_id: string;
  dish_id: string;
  step_category: string;
  sort_order: number;
  dishes: { id: string; name: string } | { id: string; name: string }[] | null;
};

function mapSetMenuRow(row: PublicSetMenuRow, dishes: PublicSetMenuDish[] = []): PublicSetMenu | null {
  if (!isMenuFormulaType(row.formula_type)) return null;
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name.trim(),
    description: row.description?.trim() || "",
    price: Number(row.price_ttc),
    formula_type: row.formula_type,
    dessert_timing: resolveSetMenuDessertTiming(row.formula_type, row.dessert_timing),
    is_public: row.is_public,
    sort_order: row.sort_order,
    dishes,
  };
}

async function fetchSetMenuDishesByMenuIds(menuIds: string[]): Promise<Map<string, PublicSetMenuDish[]>> {
  const map = new Map<string, PublicSetMenuDish[]>();
  if (menuIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from("restaurant_public_menu_dishes")
    .select("menu_id, dish_id, step_category, sort_order, dishes(id, name)")
    .in("menu_id", menuIds)
    .order("sort_order")
    .order("dish_id");

  if (error) {
    if (!error.message.includes("restaurant_public_menu_dishes")) {
      console.error("[publicDb] fetchSetMenuDishesByMenuIds:", error.message);
    }
    return map;
  }

  for (const row of (data ?? []) as PublicSetMenuDishRow[]) {
    if (!isValidSetMenuStepCategory(row.step_category)) continue;
    const dishRaw = row.dishes;
    const dish = Array.isArray(dishRaw) ? dishRaw[0] : dishRaw;
    if (!dish?.id || !dish.name) continue;
    const list = map.get(row.menu_id) ?? [];
    list.push({
      id: dish.id,
      name: dish.name.trim(),
      step_category: row.step_category as MenuCategory,
    });
    map.set(row.menu_id, list);
  }

  return map;
}

async function attachDishesToSetMenus(rows: PublicSetMenuRow[]): Promise<PublicSetMenu[]> {
  const dishMap = await fetchSetMenuDishesByMenuIds(rows.map((r) => r.id));
  return rows
    .map((row) => mapSetMenuRow(row, dishMap.get(row.id) ?? []))
    .filter((m): m is PublicSetMenu => m != null);
}

export async function listPublicSetMenusFromDb(restaurantId: string): Promise<PublicSetMenu[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_public_menus")
    .select("id, restaurant_id, name, description, price_ttc, formula_type, dessert_timing, is_public, sort_order")
    .eq("restaurant_id", restaurantId)
    .eq("is_public", true)
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("[publicDb] listPublicSetMenusFromDb:", error.message);
    return [];
  }

  return attachDishesToSetMenus((data ?? []) as PublicSetMenuRow[]);
}

export async function listAllSetMenusForRestaurantFromDb(
  restaurantId: string
): Promise<PublicSetMenu[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_public_menus")
    .select("id, restaurant_id, name, description, price_ttc, formula_type, dessert_timing, is_public, sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("[publicDb] listAllSetMenusForRestaurantFromDb:", error.message);
    return [];
  }

  return attachDishesToSetMenus((data ?? []) as PublicSetMenuRow[]);
}

export async function listPublicReviewsFromDb(restaurantId: string): Promise<Review[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_reviews")
    .select("id, restaurant_id, rating, comment, author_name, is_certified, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[publicDb] listPublicReviewsFromDb:", error.message);
    return [];
  }

  return ((data ?? []) as PublicReviewRow[]).map(mapReviewRow);
}

export type RestaurantPublicProfile = {
  is_public_listed: boolean;
  description: string;
  image_url: string;
  cover_url: string;
};

export async function getListedRestaurantSocialFromDb(id: string): Promise<{
  stories: import("./types").SocialStory[];
}> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select("id")
    .eq("id", id)
    .eq("is_public_listed", true)
    .maybeSingle();

  if (error || !data) return { stories: [] };

  const social = await getPublicSocialData(id);
  return { stories: social.stories };
}

export async function getRestaurantPublicProfileFromDb(
  restaurantId: string
): Promise<RestaurantPublicProfile | null> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select("is_public_listed, description, image_url, cover_url")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    is_public_listed: boolean;
    description: string | null;
    image_url: string | null;
    cover_url: string | null;
  };

  return {
    is_public_listed: Boolean(row.is_public_listed),
    description: row.description?.trim() ?? "",
    image_url: row.image_url?.trim() ?? "",
    cover_url: row.cover_url?.trim() ?? "",
  };
}
