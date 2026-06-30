import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  BarChart3,
  Boxes,
  ClipboardList,
  Droplets,
  Percent,
  Truck,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

/**
 * Identité couleur par section : un pictogramme + une teinte cohérents,
 * réutilisés sur le hub Cuisine et dans l'en-tête des pages correspondantes.
 * `tone` = classes du carré d'accent (fond + texte).
 */
export const SECTION_ACCENT: Record<string, { icon: LucideIcon; tone: string }> = {
  service: { icon: ClipboardList, tone: "bg-copper-50 text-copper-700" },
  dishes: { icon: UtensilsCrossed, tone: "bg-violet-50 text-violet-700" },
  preparations: { icon: Boxes, tone: "bg-sky-50 text-sky-700" },
  inventory: { icon: Boxes, tone: "bg-emerald-50 text-emerald-700" },
  margins: { icon: Percent, tone: "bg-amber-50 text-amber-700" },
  hygiene: { icon: Droplets, tone: "bg-cyan-50 text-cyan-700" },
  salle: { icon: Armchair, tone: "bg-copper-50 text-copper-700" },
  caisse: { icon: Wallet, tone: "bg-copper-50 text-copper-700" },
  pilotage: { icon: BarChart3, tone: "bg-blue-50 text-blue-700" },
  achats: { icon: Truck, tone: "bg-stone-100 text-stone-700" },
};
