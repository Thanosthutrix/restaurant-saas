"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createDish } from "@/lib/db";
import { getCurrentRestaurant } from "@/lib/auth";

export async function createDishAction(formData: FormData) {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const name = (formData.get("name") as string)?.trim();
  const productionMode = (formData.get("productionMode") as string) || "prepared";
  if (!name) return;

  const mode = productionMode === "resale" ? "resale" : "prepared";
  const { data, error } = await createDish(restaurant.id, name, mode);
  if (error || !data) return;
  if (mode === "resale") {
    revalidatePath("/inventory");
  }

  const returnTo = (formData.get("returnTo") as string)?.trim();
  if (returnTo?.startsWith("/") && !returnTo.includes("//")) {
    redirect(returnTo);
  }
  redirect(`/dishes/${data.id}`);
}
