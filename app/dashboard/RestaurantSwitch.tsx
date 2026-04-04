"use client";

import { switchRestaurantAction } from "@/app/restaurants/actions";
import type { Restaurant } from "@/lib/auth";

export function RestaurantSwitch({
  currentRestaurant,
  restaurants,
}: {
  currentRestaurant: Restaurant;
  restaurants: Restaurant[];
}) {
  if (restaurants.length <= 1) return null;

  return (
    <form action={switchRestaurantAction} className="mb-4">
      <label htmlFor="restaurant-switch" className="mb-1 block text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Restaurant actif
      </label>
      <div className="flex gap-2">
        <select
          id="restaurant-switch"
          name="restaurantId"
          defaultValue={currentRestaurant.id}
          onChange={(e) => {
            const form = e.target.form;
            if (form) form.requestSubmit();
          }}
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
