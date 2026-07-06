/** Score d'hygiène officiel (contrôle sanitaire). */
export type HygieneScore =
  | "Très satisfaisant"
  | "Satisfaisant"
  | "À améliorer"
  | "Non communiqué";

export type MenuCategory = "entrée" | "plat" | "dessert";

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
  cuisine_type: string;
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
  latitude?: number | null;
  longitude?: number | null;
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

export type RestaurantWithDetails = Restaurant & {
  menu_items: MenuItem[];
  reviews: Review[];
};
