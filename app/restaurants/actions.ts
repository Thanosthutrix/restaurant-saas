"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getAccessibleRestaurantsForUser, ACTIVE_RESTAURANT_COOKIE } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { geocodeAddressFr } from "@/lib/geo/geocodeAddressFr";
import { getInventoryItems, getDishes } from "@/lib/db";
import {
  getRestaurantTemplateBySlug,
  resolveRestaurantProfile,
  type RestaurantTemplateComponent,
  type RestaurantTemplateSuggestedDish,
} from "@/lib/templates/restaurantTemplates";
import { seedRestaurantTemplateContent } from "@/lib/templates/seedRestaurantTemplateContent";
import { analyzeMenuImageFromBuffer } from "@/lib/menu-analysis";
import { getMenuImageBuffersFromFormData } from "@/lib/getMenuImageBuffersFromFormData";
import { mergeMenuSuggestionsByNormalizedLabel } from "@/lib/mergeMenuSuggestions";
import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

/**
 * Définit le restaurant actif (cookie). Vérifie que l'utilisateur a bien accès à ce restaurant.
 */
export async function setCurrentRestaurant(restaurantId: string): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Non connecté." };

  const list = await getAccessibleRestaurantsForUser(user.id);
  const hasAccess = list.some((r) => r.id === restaurantId);
  if (!hasAccess) return { error: "Accès refusé à ce restaurant." };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_RESTAURANT_COOKIE, restaurantId, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");
  return { error: null };
}

/**
 * Définit le restaurant actif et redirige vers le dashboard (pour le switch depuis l'UI).
 */
export async function switchRestaurantAction(formData: FormData) {
  const restaurantId = formData.get("restaurantId") as string | null;
  if (!restaurantId?.trim()) return;

  const result = await setCurrentRestaurant(restaurantId.trim());
  if (result.error) return;
  redirect("/dashboard");
}

export type CreateRestaurantPayload = {
  name: string;
  /** Slug du modèle (ex. snack-fastfood) ou `other`. */
  profile: string;
  avg_covers: number | null;
  service_type: string;
  /** Si true : n’applique pas composants + plats du modèle (remplacés par l’import carte). */
  skip_template_seed?: boolean;
};

/**
 * Crée un nouveau restaurant (compte déjà existant). Définit le cookie sur le nouveau restaurant.
 */
export async function createRestaurant(
  payload: CreateRestaurantPayload
): Promise<{ error: string | null; restaurantId?: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Non connecté." };

  const name = payload.name?.trim();
  if (!name) return { error: "Le nom du restaurant est requis." };

  const { template_slug, activity_type, template } = resolveRestaurantProfile(payload.profile ?? "");

  const { data: inserted, error } = await supabaseServer
    .from("restaurants")
    .insert({
      owner_id: user.id,
      name,
      activity_type,
      template_slug,
      avg_covers: payload.avg_covers != null && Number.isFinite(payload.avg_covers) ? payload.avg_covers : null,
      service_type: payload.service_type || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  const restaurantId = (inserted as { id: string }).id;

  if (template && !payload.skip_template_seed) {
    const seed = await seedRestaurantTemplateContent(restaurantId, template);
    if (seed.error) return { error: seed.error };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_RESTAURANT_COOKIE, restaurantId, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/dashboard");
  return { error: null, restaurantId };
}

export type CreateRestaurantFormResult = {
  error: string | null;
  restaurantId?: string | null;
  menuSuggestions?: MenuSuggestionItem[];
};

/**
 * Comme `createRestaurant` mais avec images en FormData : création + analyse IA en un seul aller-retour.
 */
export async function createRestaurantFormData(formData: FormData): Promise<CreateRestaurantFormResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Non connecté." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Le nom du restaurant est requis." };

  const profile = String(formData.get("profile") ?? "");
  const avgCoversRaw = String(formData.get("avg_covers") ?? "").trim();
  let avg_covers: number | null = null;
  if (avgCoversRaw) {
    const n = parseInt(avgCoversRaw, 10);
    avg_covers = Number.isFinite(n) ? n : null;
  }
  const service_type = String(formData.get("service_type") ?? "both") || "both";

  const declaredCountRaw = String(formData.get("menu_image_count") ?? "").trim();
  const declaredImageCount = declaredCountRaw ? parseInt(declaredCountRaw, 10) : 0;

  const menuBuffers = await getMenuImageBuffersFromFormData(formData);
  if (Number.isFinite(declaredImageCount) && declaredImageCount > 0 && menuBuffers.length === 0) {
    return {
      error:
        "Les photos de carte n’ont pas été reçues par le serveur (fichiers trop lourds ou navigateur). Réessayez avec des images plus légères, ou importez depuis Plats.",
    };
  }

  const skip_template_seed = menuBuffers.length > 0;

  const { template_slug, activity_type, template } = resolveRestaurantProfile(profile ?? "");

  const { data: inserted, error } = await supabaseServer
    .from("restaurants")
    .insert({
      owner_id: user.id,
      name,
      activity_type,
      template_slug,
      avg_covers: avg_covers != null && Number.isFinite(avg_covers) ? avg_covers : null,
      service_type: service_type || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  const restaurantId = (inserted as { id: string }).id;

  if (template && !skip_template_seed) {
    const seed = await seedRestaurantTemplateContent(restaurantId, template);
    if (seed.error) return { error: seed.error, restaurantId };
  }

  let menuSuggestions: MenuSuggestionItem[] | undefined;
  if (menuBuffers.length > 0) {
    const merged: MenuSuggestionItem[] = [];
    const analyzeErrors: string[] = [];
    for (const buf of menuBuffers) {
      try {
        const { suggestions, error: aerr } = await analyzeMenuImageFromBuffer(buf);
        if (aerr) analyzeErrors.push(aerr);
        else merged.push(...suggestions);
      } catch (e) {
        analyzeErrors.push(e instanceof Error ? e.message : "Erreur lecture image.");
      }
    }
    if (analyzeErrors.length > 0 && merged.length === 0) {
      return {
        error: analyzeErrors.join(" "),
        restaurantId,
      };
    }
    menuSuggestions = mergeMenuSuggestionsByNormalizedLabel(merged);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_RESTAURANT_COOKIE, restaurantId, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/dashboard");
  return { error: null, restaurantId, menuSuggestions };
}

export type UpdateRestaurantPayload = {
  name: string;
  template_slug: string | null;
  avg_covers: number | null;
  service_type: string;
  address_text: string | null;
  school_zone: "A" | "B" | "C" | null;
  school_zone_is_manual: boolean;
};

/**
 * Met à jour les infos d'un restaurant. Vérifie que l'utilisateur en est propriétaire.
 * template_slug : slug du template (pizzeria, snack-fastfood, etc.) ou null. N'écrase pas les données existantes.
 */
export async function updateRestaurant(
  restaurantId: string,
  payload: UpdateRestaurantPayload
): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Non connecté." };

  const list = await getAccessibleRestaurantsForUser(user.id);
  if (!list.some((r) => r.id === restaurantId)) return { error: "Accès refusé à ce restaurant." };

  const name = payload.name?.trim();
  if (!name) return { error: "Le nom du restaurant est requis." };

  const addressText = payload.address_text?.trim() || null;
  const zoneManual = Boolean(payload.school_zone_is_manual);
  let schoolZone: "A" | "B" | "C" | null =
    payload.school_zone === "A" || payload.school_zone === "B" || payload.school_zone === "C"
      ? payload.school_zone
      : null;

  if (zoneManual && !schoolZone) {
    return { error: "Choisissez une zone A, B ou C pour le mode manuel." };
  }

  let latitude: number | null = null;
  let longitude: number | null = null;

  if (addressText) {
    const geo = await geocodeAddressFr(addressText);
    if (!geo) {
      return {
        error: "Adresse introuvable. Indiquez le numéro, la rue et la ville (France).",
      };
    }
    latitude = geo.latitude;
    longitude = geo.longitude;
    if (!zoneManual) {
      schoolZone = geo.schoolZone;
    }
  } else if (!zoneManual) {
    schoolZone = null;
  }

  const { error } = await supabaseServer
    .from("restaurants")
    .update({
      name,
      template_slug: payload.template_slug?.trim() || null,
      avg_covers: payload.avg_covers != null && Number.isFinite(payload.avg_covers) ? payload.avg_covers : null,
      service_type: payload.service_type || null,
      address_text: addressText,
      latitude,
      longitude,
      school_zone: schoolZone,
      school_zone_is_manual: zoneManual,
      updated_at: new Date().toISOString(),
    })
    .eq("id", restaurantId)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath(`/restaurants/${restaurantId}`);
  revalidatePath("/insights/calendar", "page");
  return { error: null };
}

/** Résultat du calcul des suggestions (composants et plats manquants + liste complète des plats suggérés). */
export type TemplateSuggestions = {
  missingComponents: RestaurantTemplateComponent[];
  missingDishes: RestaurantTemplateSuggestedDish[];
  /** Liste complète des plats suggérés par le template (pour affichage sur /dishes). */
  allSuggestedDishes: RestaurantTemplateSuggestedDish[];
};

/**
 * Compare le template du restaurant à ses inventory_items et dishes existants.
 * Retourne les composants et plats suggérés par le template qui ne sont pas encore créés.
 */
export async function getTemplateSuggestions(restaurantId: string): Promise<{
  error: string | null;
  suggestions: TemplateSuggestions | null;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: "Non connecté.", suggestions: null };

  const list = await getAccessibleRestaurantsForUser(user.id);
  const restaurant = list.find((r) => r.id === restaurantId);
  if (!restaurant) return { error: "Accès refusé à ce restaurant.", suggestions: null };

  const slug = restaurant.template_slug?.trim();
  if (!slug) return { error: null, suggestions: null };

  const template = getRestaurantTemplateBySlug(slug);
  if (!template) return { error: null, suggestions: null };

  const [invRes, dishesRes] = await Promise.all([
    getInventoryItems(restaurantId),
    getDishes(restaurantId),
  ]);
  const existingInvNames = new Set((invRes.data ?? []).map((i) => i.name.toLowerCase().trim()));
  const existingDishNames = new Set((dishesRes.data ?? []).map((d) => d.name.toLowerCase().trim()));

  const missingComponents = template.components.filter((c) => !existingInvNames.has(c.name.trim().toLowerCase()));
  const missingDishes = template.suggestedDishes.filter(
    (d) => !existingDishNames.has(d.name.trim().toLowerCase())
  );

  return {
    error: null,
    suggestions: {
      missingComponents,
      missingDishes,
      allSuggestedDishes: template.suggestedDishes,
    },
  };
}

/**
 * Applique les suggestions du template : crée uniquement les composants et plats manquants (sans doublon).
 * Ne supprime ni ne modifie rien.
 */
export async function applyTemplateSuggestions(restaurantId: string): Promise<{
  error: string | null;
  added?: number;
  addedDishes?: number;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: "Non connecté." };

  const list = await getAccessibleRestaurantsForUser(user.id);
  const restaurant = list.find((r) => r.id === restaurantId);
  if (!restaurant) return { error: "Accès refusé à ce restaurant." };

  const slug = restaurant.template_slug?.trim();
  if (!slug) return { error: "Aucun template sélectionné pour ce restaurant. Modifiez le restaurant et choisissez un modèle." };

  const template = getRestaurantTemplateBySlug(slug);
  if (!template) return { error: "Template introuvable." };

  const invBefore = (await getInventoryItems(restaurantId)).data?.length ?? 0;
  const dishesBefore = (await getDishes(restaurantId)).data?.length ?? 0;

  const seed = await seedRestaurantTemplateContent(restaurantId, template);
  if (seed.error) return { error: seed.error };

  const invAfter = (await getInventoryItems(restaurantId)).data?.length ?? 0;
  const dishesAfter = (await getDishes(restaurantId)).data?.length ?? 0;

  revalidatePath("/", "layout");
  revalidatePath("/inventory");
  revalidatePath("/dishes");
  revalidatePath(`/restaurants/${restaurantId}`);
  return {
    error: null,
    added: Math.max(0, invAfter - invBefore),
    addedDishes: Math.max(0, dishesAfter - dishesBefore),
  };
}
