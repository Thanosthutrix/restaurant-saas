export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

export type ReservationSource = "phone" | "walk_in" | "website" | "other";

export type RestaurantReservationRow = {
  id: string;
  restaurant_id: string;
  customer_id: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status: ReservationStatus;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  source: ReservationSource;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
  /** Table salle (après enregistrement d’arrivée). */
  dining_table_id: string | null;
  /** Commande salle / ticket en cours. */
  dining_order_id: string | null;
};
