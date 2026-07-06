export type ConsumerProfile = {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  phone_normalized: string | null;
  marketing_opt_in: boolean;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsumerReservationSummary = {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  starts_at: string;
  party_size: number;
  status: string;
  notes: string | null;
};
