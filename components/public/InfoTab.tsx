import { Clock, Mail, Phone } from "lucide-react";
import { RestaurantLocationPanel } from "@/components/public/RestaurantLocationPanel";
import type { Restaurant } from "@/lib/public/types";

type Props = {
  restaurant: Restaurant;
};

export function InfoTab({ restaurant }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-bold text-slate-900">À propos</h3>
        <p className="mt-3 leading-relaxed text-slate-600">{restaurant.description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h4 className="font-bold text-slate-900">Contact</h4>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {restaurant.phone ? (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                <a href={`tel:${restaurant.phone.replace(/\s/g, "")}`} className="hover:text-orange-600">
                  {restaurant.phone}
                </a>
              </li>
            ) : null}
            {restaurant.email ? (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                <a href={`mailto:${restaurant.email}`} className="hover:text-orange-600">
                  {restaurant.email}
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h4 className="font-bold text-slate-900">Horaires</h4>
          <p className="mt-4 flex items-start gap-2 text-sm text-slate-600">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden />
            {restaurant.opening_hours ?? "Horaires non renseignés"}
          </p>
        </div>
      </div>

      <RestaurantLocationPanel restaurant={restaurant} />
    </div>
  );
}
