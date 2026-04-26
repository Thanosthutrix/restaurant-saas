export type CustomerSource =
  | "walk_in"
  | "phone"
  | "website"
  | "referral"
  | "social"
  | "event"
  | "import"
  | "other";

export type TimelineEventType = "note" | "call" | "email" | "visit" | "consent_change" | "tag_change" | "system";

export type ConsentKey = "marketing" | "service_messages" | "analytics";

export type CustomerTag = {
  id: string;
  restaurant_id: string;
  label: string;
  color: string;
  created_at: string;
};

export type RestaurantCustomer = {
  id: string;
  restaurant_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  preferred_locale: string;
  birth_date: string | null;
  company_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  internal_notes: string | null;
  /** Rappel équipe (salle / caisse), affiché sur la commande si la fiche est liée. */
  service_memo: string | null;
  allergens_note: string | null;
  source: CustomerSource;
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
  service_messages_opt_in: boolean;
  analytics_opt_in: boolean;
  visit_count: number;
  last_visit_at: string | null;
  first_seen_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
};

export type CustomerTagAssignment = {
  tag: CustomerTag;
};

export type CustomerWithTags = RestaurantCustomer & {
  tags: CustomerTag[];
};

export type CustomerTimelineEvent = {
  id: string;
  restaurant_id: string;
  customer_id: string;
  event_type: TimelineEventType;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_by_user_id: string | null;
  created_at: string;
};

export type CustomerConsentLog = {
  id: string;
  customer_id: string;
  consent_key: ConsentKey;
  previous_value: boolean | null;
  new_value: boolean;
  recorded_at: string;
  actor_user_id: string | null;
  notes: string | null;
};

export type CustomerListSort = "name_asc" | "created_desc" | "last_visit_desc" | "visits_desc";

export type CustomerListFilters = {
  search?: string;
  tagIds?: string[];
  source?: CustomerSource | "all";
  activeOnly?: boolean;
  marketingOnly?: boolean;
  sort?: CustomerListSort;
  limit?: number;
  offset?: number;
};
