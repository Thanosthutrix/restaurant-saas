/** Score d'hygiène officiel (contrôle sanitaire). */
export type HygieneScore =
  | "Très satisfaisant"
  | "Satisfaisant"
  | "À améliorer"
  | "Non communiqué";

import type { OpeningHoursDay } from "@/lib/public/formatOpeningHours";
import type { RestaurantMarkerKind } from "@/lib/public/restaurantMapMarker";

export type { MenuCategory } from "@/lib/public/menuCategories";
export type { MenuFormulaType, SetMenuDessertTiming } from "@/lib/public/menuFormulas";

import type { MenuCategory } from "@/lib/public/menuCategories";
import type { MenuFormulaType, SetMenuDessertTiming } from "@/lib/public/menuFormulas";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";

/** Fiche restaurant exposée sur le portail B2C. */
export type Restaurant = {
  id: string;
  name: string;
  description: string;
  address: string;
  /** Type d'établissement (libellé affiché). */
  cuisine_type: string;
  /** Slug template ERP — utilisé pour le pictogramme carte. */
  template_slug?: string | null;
  activity_type?: string | null;
  marker_kind?: RestaurantMarkerKind;
  hygiene_score: HygieneScore;
  image_url: string;
  /** Note moyenne calculée à partir des avis certifiés et libres (1–5). */
  average_rating: number;
  /** Nombre total d'avis affichés sur le portail. */
  review_count: number;
  /** Score hygiène ERP live (0–100), calculé sur 7 jours. */
  hygiene_score_live?: number | null;
  /** true si le score live repose sur des tâches hygiène réelles. */
  hygiene_has_live_data?: boolean;
  /** Détail du calcul hygiène (transparence). */
  hygiene_score_detail?: string;
  phone?: string;
  email?: string;
  cover_url?: string;
  opening_hours?: string;
  /** Horaires structurés par jour (planning ERP). */
  opening_hours_schedule?: OpeningHoursDay[];
  /** Fourchette de budget (carte publique). */
  budget_label?: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Liens réseaux sociaux (ERP → portail public). */
  social_links?: {
    instagram_url: string | null;
    facebook_url: string | null;
    instagram_username: string | null;
  };
  /** Stories Instagram actives (cache Meta, 24 h). */
  social_stories?: SocialStory[];
};

export type SocialStoryMediaType = "IMAGE" | "VIDEO";

export type SocialStory = {
  id: string;
  mediaType: SocialStoryMediaType;
  mediaUrl: string;
  thumbnailUrl: string;
  permalink: string | null;
  timestamp: string;
};

export type GeocodedPlace = {
  lat: number;
  lng: number;
  label: string;
};

/** Plat de carte publique (géré depuis l'ERP via is_public). */
export type MenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  is_public: boolean;
  image_url?: string;
};

/** Réservation en ligne soumise par un client B2C. */
export type Reservation = {
  id: string;
  restaurant_id: string;
  date: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  comments?: string;
};

/** Avis client — is_certified = validé via ticket de caisse ERP. */
export type Review = {
  id: string;
  restaurant_id: string;
  rating: number;
  comment: string;
  created_at: string;
  is_certified: boolean;
  author_name?: string;
};

/** Formule menu publique (entrée+plat+dessert, etc.). */
export type PublicSetMenuDish = {
  id: string;
  name: string;
  step_category: MenuCategory;
};

export type PublicSetMenu = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  formula_type: MenuFormulaType;
  /** Pertinent si la formule inclut un dessert. */
  dessert_timing: SetMenuDessertTiming;
  is_public: boolean;
  sort_order: number;
  /** Plats proposés par étape de la formule. */
  dishes: PublicSetMenuDish[];
};

export type RestaurantWithDetails = Restaurant & {
  menu_items: MenuItem[];
  set_menus: PublicSetMenu[];
  reviews: Review[];
};
