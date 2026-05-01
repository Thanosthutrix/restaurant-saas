"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveRestaurantProfile } from "@/lib/templates/restaurantTemplates";
import { seedRestaurantTemplateContent } from "@/lib/templates/seedRestaurantTemplateContent";
import { ACTIVE_RESTAURANT_COOKIE } from "@/lib/auth";
import { analyzeMenuImageFromBuffer } from "@/lib/menu-analysis";
import { getImageBuffersFromFormData, getMenuImageBuffersFromFormData } from "@/lib/getMenuImageBuffersFromFormData";
import { mergeMenuSuggestionsByNormalizedLabel } from "@/lib/mergeMenuSuggestions";
import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";
import { analyzeRecipeImageFromBuffer, type RecipePhotoSuggestion } from "@/lib/recipe-photo-analysis";

export type SubmitOnboardingFormResult = {
  error: string | null;
  restaurantId?: string | null;
  /** Présent si des images menu ont été envoyées (éventuellement tableau vide après fusion). */
  menuSuggestions?: MenuSuggestionItem[];
  /** Présent si des photos recettes ont été envoyées (éventuellement tableau vide). */
  recipeSuggestions?: RecipePhotoSuggestion[];
};

/**
 * Crée le restaurant, applique le modèle si besoin, analyse les photos menu dans la même requête
 * (évite la perte d’état client après revalidate du layout).
 */
export async function submitOnboardingFormData(formData: FormData): Promise<SubmitOnboardingFormResult> {
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
  const recipeBuffers = await getImageBuffersFromFormData(formData, "recipe_image");
  if (Number.isFinite(declaredImageCount) && declaredImageCount > 0 && menuBuffers.length === 0) {
    return {
      error:
        "Les photos de carte n’ont pas été reçues par le serveur (fichiers trop lourds ou navigateur). Réessayez avec des images plus légères, ou importez la carte depuis Plats une fois le restaurant créé.",
    };
  }

  const forceSkipTemplate =
    String(formData.get("_force_skip_template_seed") ?? "") === "1";
  const skip_template_seed = menuBuffers.length > 0 || forceSkipTemplate;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non connecté." };

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

  let recipeSuggestions: RecipePhotoSuggestion[] | undefined;
  if (recipeBuffers.length > 0) {
    const merged: RecipePhotoSuggestion[] = [];
    const analyzeErrors: string[] = [];
    for (const buf of recipeBuffers) {
      try {
        const { suggestions, error: aerr } = await analyzeRecipeImageFromBuffer(buf);
        if (aerr) analyzeErrors.push(aerr);
        merged.push(...suggestions);
      } catch (e) {
        analyzeErrors.push(e instanceof Error ? e.message : "Erreur lecture recette.");
      }
    }
    if (analyzeErrors.length > 0 && merged.length === 0) {
      return { error: analyzeErrors.join(" "), restaurantId };
    }
    recipeSuggestions = merged;
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_RESTAURANT_COOKIE, restaurantId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/dashboard");
  return { error: null, restaurantId, menuSuggestions, recipeSuggestions };
}

export type OnboardingPayload = {
  name: string;
  profile: string;
  avg_covers: number | null;
  service_type: string;
  skip_template_seed?: boolean;
};

/** Création onboarding : accepte un `FormData` (avec `menu_image`) ou l’ancien objet payload (sans fichiers). */
export async function submitOnboarding(input: FormData): Promise<SubmitOnboardingFormResult>;
export async function submitOnboarding(input: OnboardingPayload): Promise<SubmitOnboardingFormResult>;
export async function submitOnboarding(
  input: FormData | OnboardingPayload
): Promise<SubmitOnboardingFormResult> {
  if (input instanceof FormData) {
    return submitOnboardingFormData(input);
  }
  const fd = new FormData();
  fd.append("name", input.name?.trim() ?? "");
  fd.append("profile", input.profile ?? "");
  fd.append(
    "avg_covers",
    input.avg_covers != null && Number.isFinite(input.avg_covers) ? String(input.avg_covers) : ""
  );
  fd.append("service_type", input.service_type ?? "both");
  if (input.skip_template_seed) {
    fd.append("_force_skip_template_seed", "1");
  }
  return submitOnboardingFormData(fd);
}
