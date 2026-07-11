"use server";

import { revalidatePath } from "next/cache";
import { invalidateDishesCache, invalidateInventoryCache } from "@/lib/cacheInvalidation";
import { redirect } from "next/navigation";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import { createDish } from "@/lib/db";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  getMenuFormulaSteps,
  isMenuFormulaType,
  resolveSetMenuDessertTiming,
  type MenuFormulaType,
  type SetMenuDessertTiming,
} from "@/lib/public/menuFormulas";
import { normalizeMenuCategory, type MenuCategory } from "@/lib/public/menuCategories";
import {
  isValidSetMenuStepCategory,
  type SetMenuDishIdsByStep,
} from "@/lib/public/setMenuDishes";

function revalidatePublicMenuPaths(restaurantId: string) {
  revalidatePath("/dishes");
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath(`/restaurant/${restaurantId}`);
  revalidatePath(`/restaurants/${restaurantId}/edit`);
}

export async function createDishAction(formData: FormData) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const gate = await assertRestaurantAction(user.id, restaurant.id, "dishes.mutate");
  if (!gate.ok) return;

  const name = (formData.get("name") as string)?.trim();
  const productionMode = (formData.get("productionMode") as string) || "prepared";
  if (!name) return;

  const mode = productionMode === "resale" ? "resale" : "prepared";
  const { data, error } = await createDish(restaurant.id, name, mode);
  if (error || !data) return;
  invalidateDishesCache();
  if (mode === "resale") {
    revalidatePath("/inventory");
    invalidateInventoryCache();
  }

  const returnTo = (formData.get("returnTo") as string)?.trim();
  if (returnTo?.startsWith("/") && !returnTo.includes("//")) {
    redirect(returnTo);
  }
  redirect(`/dishes/${data.id}`);
}

async function replaceSetMenuDishes(
  menuId: string,
  restaurantId: string,
  formulaType: MenuFormulaType,
  dishIdsByStep: SetMenuDishIdsByStep | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowedSteps = getMenuFormulaSteps(formulaType);
  const allowedStepSet = new Set(allowedSteps);

  const rows: Array<{ menu_id: string; dish_id: string; step_category: MenuCategory; sort_order: number }> =
    [];

  if (dishIdsByStep) {
    const allIds = new Set<string>();
    for (const step of allowedSteps) {
      for (const dishId of dishIdsByStep[step] ?? []) {
        const id = dishId.trim();
        if (!id) continue;
        if (allIds.has(id)) {
          return { ok: false, error: "Un même plat ne peut pas être sélectionné plusieurs fois." };
        }
        allIds.add(id);
        rows.push({
          menu_id: menuId,
          dish_id: id,
          step_category: step,
          sort_order: rows.filter((r) => r.step_category === step).length,
        });
      }
    }

    if (allIds.size > 0) {
      const { data: dishes, error: dishErr } = await supabaseServer
        .from("dishes")
        .select("id, menu_category")
        .eq("restaurant_id", restaurantId)
        .in("id", [...allIds]);

      if (dishErr) return { ok: false, error: dishErr.message };
      if ((dishes ?? []).length !== allIds.size) {
        return { ok: false, error: "Un ou plusieurs plats sélectionnés sont introuvables." };
      }

      const categoryById = new Map(
        (dishes ?? []).map((d) => [d.id as string, normalizeMenuCategory(d.menu_category as string | null)])
      );

      for (const row of rows) {
        if (!allowedStepSet.has(row.step_category)) {
          return { ok: false, error: "Étape de formule invalide." };
        }
        if (!isValidSetMenuStepCategory(row.step_category)) {
          return { ok: false, error: "Catégorie d'étape invalide." };
        }
        const dishCategory = categoryById.get(row.dish_id);
        if (dishCategory !== row.step_category) {
          return {
            ok: false,
            error: `Le plat sélectionné pour « ${row.step_category} » doit être catégorisé ${row.step_category} dans la fiche plat.`,
          };
        }
      }
    }
  }

  const { error: delErr } = await supabaseServer
    .from("restaurant_public_menu_dishes")
    .delete()
    .eq("menu_id", menuId);

  if (delErr) {
    if (delErr.message.includes("restaurant_public_menu_dishes")) {
      return { ok: false, error: "Migration formules/plats requise (npm run db:apply)." };
    }
    return { ok: false, error: delErr.message };
  }

  if (rows.length === 0) return { ok: true };

  const { error: insErr } = await supabaseServer.from("restaurant_public_menu_dishes").insert(rows);
  if (insErr) {
    if (insErr.message.includes("restaurant_public_menu_dishes")) {
      return { ok: false, error: "Migration formules/plats requise (npm run db:apply)." };
    }
    return { ok: false, error: insErr.message };
  }

  return { ok: true };
}

export async function savePublicSetMenuAction(params: {
  restaurantId: string;
  id?: string;
  name: string;
  description: string;
  priceTtc: number;
  formulaType: MenuFormulaType;
  dessertTiming?: SetMenuDessertTiming;
  isPublic: boolean;
  sortOrder?: number;
  dishIdsByStep?: SetMenuDishIdsByStep;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const gate = await assertRestaurantAction(user.id, params.restaurantId, "dishes.mutate");
  if (!gate.ok) return gate;

  const name = params.name.trim();
  if (!name) return { ok: false, error: "Le nom de la formule est requis." };

  if (!isMenuFormulaType(params.formulaType)) {
    return { ok: false, error: "Type de formule invalide." };
  }

  const price = Number(params.priceTtc);
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "Le prix doit être supérieur à 0." };
  }

  const payload = {
    restaurant_id: params.restaurantId,
    name,
    description: params.description.trim() || null,
    price_ttc: Math.round(price * 100) / 100,
    formula_type: params.formulaType,
    dessert_timing: resolveSetMenuDessertTiming(params.formulaType, params.dessertTiming),
    is_public: params.isPublic,
    sort_order: params.sortOrder ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (params.id) {
    const { data, error } = await supabaseServer
      .from("restaurant_public_menus")
      .update(payload)
      .eq("id", params.id)
      .eq("restaurant_id", params.restaurantId)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.message.includes("restaurant_public_menus")) {
        return { ok: false, error: "Migration formules requise (npm run db:apply)." };
      }
      return { ok: false, error: error.message };
    }
    if (!data) return { ok: false, error: "Formule introuvable." };

    const menuId = data.id as string;
    const dishSync = await replaceSetMenuDishes(
      menuId,
      params.restaurantId,
      params.formulaType,
      params.dishIdsByStep
    );
    if (!dishSync.ok) return dishSync;

    revalidatePublicMenuPaths(params.restaurantId);
    return { ok: true, id: menuId };
  }

  const { data, error } = await supabaseServer
    .from("restaurant_public_menus")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("restaurant_public_menus")) {
      return { ok: false, error: "Migration formules requise (npm run db:apply)." };
    }
    return { ok: false, error: error.message };
  }

  const menuId = data.id as string;
  const dishSync = await replaceSetMenuDishes(
    menuId,
    params.restaurantId,
    params.formulaType,
    params.dishIdsByStep
  );
  if (!dishSync.ok) {
    await supabaseServer.from("restaurant_public_menus").delete().eq("id", menuId);
    return dishSync;
  }

  revalidatePublicMenuPaths(params.restaurantId);
  return { ok: true, id: menuId };
}

export async function deletePublicSetMenuAction(
  restaurantId: string,
  menuId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const gate = await assertRestaurantAction(user.id, restaurantId, "dishes.mutate");
  if (!gate.ok) return gate;

  const { error } = await supabaseServer
    .from("restaurant_public_menus")
    .delete()
    .eq("id", menuId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };

  revalidatePublicMenuPaths(restaurantId);
  return { ok: true };
}
