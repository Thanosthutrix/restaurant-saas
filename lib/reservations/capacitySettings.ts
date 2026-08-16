export type ReservationCapacitySettings = {
  restaurant_id: string;
  online_reservations_enabled: boolean;
  default_duration_minutes: number;
  slot_step_minutes: number;
  min_lead_minutes: number;
  max_covers_per_slot: number | null;
  max_online_covers_per_slot: number | null;
  max_party_size_online: number;
  max_party_size_staff: number;
  use_table_capacity: boolean;
  online_share_pct: number;
  enforce_availability_online: boolean;
  enforce_availability_staff: boolean;
  reservation_notify_email: string | null;
};

export const DEFAULT_CAPACITY_SETTINGS: Omit<ReservationCapacitySettings, "restaurant_id"> = {
  online_reservations_enabled: true,
  default_duration_minutes: 90,
  slot_step_minutes: 15,
  min_lead_minutes: 30,
  max_covers_per_slot: null,
  max_online_covers_per_slot: null,
  max_party_size_online: 12,
  max_party_size_staff: 50,
  use_table_capacity: true,
  online_share_pct: 100,
  enforce_availability_online: true,
  enforce_availability_staff: false,
  reservation_notify_email: null,
};

export function parseReservationCapacitySettings(
  row: unknown,
  restaurantId: string
): ReservationCapacitySettings {
  const d = DEFAULT_CAPACITY_SETTINGS;
  if (!row || typeof row !== "object") {
    return { restaurant_id: restaurantId, ...d };
  }
  const r = row as Record<string, unknown>;

  const intOr = (v: unknown, fallback: number, min: number, max: number) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  const nullableInt = (v: unknown, min: number, max: number): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  return {
    restaurant_id: restaurantId,
    online_reservations_enabled: r.online_reservations_enabled !== false,
    default_duration_minutes: intOr(r.default_duration_minutes, d.default_duration_minutes, 30, 360),
    slot_step_minutes: r.slot_step_minutes === 30 ? 30 : 15,
    min_lead_minutes: intOr(r.min_lead_minutes, d.min_lead_minutes, 0, 1440),
    max_covers_per_slot: nullableInt(r.max_covers_per_slot, 1, 500),
    max_online_covers_per_slot: nullableInt(r.max_online_covers_per_slot, 0, 500),
    max_party_size_online: intOr(r.max_party_size_online, d.max_party_size_online, 1, 50),
    max_party_size_staff: intOr(r.max_party_size_staff, d.max_party_size_staff, 1, 50),
    use_table_capacity: r.use_table_capacity !== false,
    online_share_pct: intOr(r.online_share_pct, d.online_share_pct, 0, 100),
    enforce_availability_online: r.enforce_availability_online !== false,
    enforce_availability_staff: r.enforce_availability_staff === true,
    reservation_notify_email:
      typeof r.reservation_notify_email === "string" && r.reservation_notify_email.trim()
        ? r.reservation_notify_email.trim()
        : null,
  };
}

export type DiningTableMergeGroup = {
  id: string;
  restaurant_id: string;
  label: string;
  table_ids: string[];
  capacity: number;
  sort_order: number;
  is_active: boolean;
};

export function parseMergeGroup(row: Record<string, unknown>): DiningTableMergeGroup {
  const tableIds = Array.isArray(row.table_ids)
    ? (row.table_ids as unknown[]).map(String).filter(Boolean)
    : [];
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    label: String(row.label ?? ""),
    table_ids: tableIds,
    capacity: Math.max(2, Math.min(50, Number(row.capacity) || 2)),
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
  };
}

/** Sources comptées dans le plafond « en ligne » (site + Meta). */
export function isOnlineReservationSource(source: string): boolean {
  return source === "website" || source === "instagram_dm" || source === "facebook_messenger";
}
