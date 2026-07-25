import {
  Boxes,
  Cog,
  DoorOpen,
  Droplets,
  Fan,
  Flame,
  Snowflake,
  Sparkles,
  Trash2,
  Truck,
  Utensils,
  type LucideIcon,
} from "lucide-react";

const COLD_CATEGORIES = new Set(["chambre_froide", "frigo", "congelateur"]);

export type HygieneCategoryMeta = {
  Icon: LucideIcon;
  tone: string;
  tile: string;
};

/** Icône + teinte par famille de catégorie (tuiles hygiène). */
export function hygieneCategoryMeta(cat: string): HygieneCategoryMeta {
  if (COLD_CATEGORIES.has(cat)) return { Icon: Snowflake, tone: "bg-sky-50 text-sky-700", tile: "tile-sky" };
  if (cat === "four" || cat === "piano_plaque") return { Icon: Flame, tone: "bg-amber-50 text-amber-700", tile: "tile-amber" };
  if (cat === "hotte") return { Icon: Fan, tone: "bg-amber-50 text-amber-700", tile: "tile-amber" };
  if (cat === "trancheuse" || cat === "machine") return { Icon: Cog, tone: "bg-violet-50 text-violet-700", tile: "tile-violet" };
  if (cat === "poubelle" || cat === "zone_dechets") return { Icon: Trash2, tone: "bg-stone-100 text-stone-700", tile: "tile-copper" };
  if (cat === "vehicule") return { Icon: Truck, tone: "bg-stone-100 text-stone-700", tile: "tile-copper" };
  if (cat === "plonge" || cat === "sanitaire") return { Icon: Droplets, tone: "bg-cyan-50 text-cyan-700", tile: "tile-cyan" };
  if (cat === "ustensile" || cat === "bac_gastronorme") return { Icon: Utensils, tone: "bg-emerald-50 text-emerald-700", tile: "tile-emerald" };
  if (cat === "etagere" || cat === "reserve") return { Icon: Boxes, tone: "bg-emerald-50 text-emerald-700", tile: "tile-emerald" };
  if (cat === "poignee_contact") return { Icon: DoorOpen, tone: "bg-cyan-50 text-cyan-700", tile: "tile-cyan" };
  return { Icon: Sparkles, tone: "bg-cyan-50 text-cyan-700", tile: "tile-cyan" };
}
