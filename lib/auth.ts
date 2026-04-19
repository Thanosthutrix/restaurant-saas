/**
 * Auth et restaurant actif (multi-restaurants).
 * - getCurrentUser() : utilisateur connecté
 * - getAccessibleRestaurantsForUser() : liste des restaurants accessibles (owner)
 * - getCurrentRestaurant() : restaurant actif pour les propriétaires uniquement (cookie)
 * - getRestaurantForPage() : restaurant pour les pages (propriétaire ou collaborateur lié)
 * - setCurrentRestaurant() : server action pour changer le restaurant actif (cookie)
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const ACTIVE_RESTAURANT_COOKIE = "active_restaurant_id" as const;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

export type Restaurant = {
  id: string;
  owner_id: string;
  name: string;
  activity_type: string | null;
  template_slug: string | null;
  avg_covers: number | null;
  service_type: string | null;
  latitude: number | null;
  longitude: number | null;
  school_zone: "A" | "B" | "C" | null;
  address_text: string | null;
  school_zone_is_manual: boolean;
  created_at: string;
  updated_at: string;
};

type RestaurantRow = {
  id: string;
  owner_id: string;
  name: string;
  activity_type: string | null;
  template_slug: string | null;
  avg_covers: unknown;
  service_type: string | null;
  latitude: unknown;
  longitude: unknown;
  school_zone: string | null;
  address_text: string | null;
  school_zone_is_manual: unknown;
  created_at: string;
  updated_at: string;
};

function mapRestaurantFromRow(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    activity_type: row.activity_type,
    template_slug: row.template_slug,
    avg_covers: row.avg_covers != null ? Number(row.avg_covers) : null,
    service_type: row.service_type,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    school_zone:
      row.school_zone === "A" || row.school_zone === "B" || row.school_zone === "C"
        ? row.school_zone
        : null,
    address_text: row.address_text?.trim() || null,
    school_zone_is_manual: Boolean(row.school_zone_is_manual),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Retourne l'utilisateur connecté (session cookies) ou null.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Liste des restaurants accessibles par l'utilisateur (owner_id = user.id).
 * Ordre : par nom.
 */
export async function getAccessibleRestaurantsForUser(userId: string): Promise<Restaurant[]> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select("id, owner_id, name, activity_type, template_slug, avg_covers, service_type, latitude, longitude, school_zone, address_text, school_zone_is_manual, created_at, updated_at")
    .eq("owner_id", userId)
    .order("name");

  if (error || !data) return [];
  return (data as RestaurantRow[]).map(mapRestaurantFromRow);
}

/** Charge un restaurant par id (ex. accès collaborateur). */
export async function getRestaurantById(restaurantId: string): Promise<Restaurant | null> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select(
      "id, owner_id, name, activity_type, template_slug, avg_covers, service_type, latitude, longitude, school_zone, address_text, school_zone_is_manual, created_at, updated_at"
    )
    .eq("id", restaurantId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRestaurantFromRow(data as RestaurantRow);
}

/**
 * Liste accessible + restaurant actif (cookie), en une lecture liste — pour layout / header.
 */
export async function getRestaurantHeaderSession(userId: string): Promise<{
  restaurants: Restaurant[];
  current: Restaurant | null;
}> {
  const restaurants = await getAccessibleRestaurantsForUser(userId);
  if (restaurants.length === 0) return { restaurants, current: null };

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_RESTAURANT_COOKIE)?.value;
  const current = activeId
    ? (restaurants.find((r) => r.id === activeId) ?? restaurants[0])
    : restaurants[0];
  return { restaurants, current };
}

/**
 * Retourne le restaurant actif pour la session :
 * - si un cookie active_restaurant_id est défini et que l'utilisateur a accès à ce restaurant → ce restaurant
 * - sinon le premier restaurant de la liste accessible (sans modifier le cookie)
 * - si aucun restaurant accessible → null (rediriger vers onboarding)
 */
export async function getCurrentRestaurant(): Promise<Restaurant | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { current } = await getRestaurantHeaderSession(user.id);
  return current;
}

/**
 * Restaurant actif pour les pages et actions : établissement possédé (cookie) ou,
 * pour un collaborateur, celui de la fiche staff liée au compte.
 */
export async function getRestaurantForPage(): Promise<Restaurant | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const owned = await getAccessibleRestaurantsForUser(user.id);
  if (owned.length > 0) {
    const cookieStore = await cookies();
    const activeId = cookieStore.get(ACTIVE_RESTAURANT_COOKIE)?.value;
    return activeId ? (owned.find((r) => r.id === activeId) ?? owned[0]) : owned[0];
  }

  const { data: sm } = await supabaseServer
    .from("staff_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!sm) return null;
  return getRestaurantById(String((sm as { restaurant_id: string }).restaurant_id));
}
