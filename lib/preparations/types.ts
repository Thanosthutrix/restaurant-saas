export type PreparationRecord = {
  id: string;
  restaurant_id: string;
  inventory_item_id: string | null;
  dish_id: string | null;
  label: string;
  /** Attribué au 1er relevé T° fin ; sert au repérage (douchette / étiquette plus tard). */
  lot_reference: string | null;
  started_at: string;
  temp_end_celsius: number | null;
  temp_end_recorded_at: string | null;
  temp_2h_celsius: number | null;
  temp_2h_due_at: string | null;
  temp_2h_recorded_at: string | null;
  dlc_date: string | null;
  recorded_by_user_id: string | null;
  recorded_by_display: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type PreparationCandidatePrep = {
  id: string;
  name: string;
  unit: string;
};

export type PreparationCandidateDish = {
  id: string;
  name: string;
};
