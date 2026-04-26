import { supabaseServer } from "@/lib/supabaseServer";
import { normalizePhoneForDedup } from "@/lib/customers/phoneNormalize";
import type {
  ConsentKey,
  CustomerConsentLog,
  CustomerListFilters,
  CustomerListSort,
  CustomerSource,
  CustomerTag,
  CustomerTimelineEvent,
  CustomerWithTags,
  RestaurantCustomer,
  TimelineEventType,
} from "@/lib/customers/types";

function mapCustomer(row: Record<string, unknown>): RestaurantCustomer {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    display_name: String(row.display_name ?? ""),
    first_name: row.first_name == null ? null : String(row.first_name),
    last_name: row.last_name == null ? null : String(row.last_name),
    email: row.email == null || String(row.email).trim() === "" ? null : String(row.email).trim(),
    phone: row.phone == null || String(row.phone).trim() === "" ? null : String(row.phone).trim(),
    phone_normalized:
      row.phone_normalized == null || String(row.phone_normalized).trim() === ""
        ? null
        : String(row.phone_normalized).trim(),
    preferred_locale: String(row.preferred_locale ?? "fr"),
    birth_date: row.birth_date == null ? null : String(row.birth_date).slice(0, 10),
    company_name: row.company_name == null ? null : String(row.company_name),
    address_line1: row.address_line1 == null ? null : String(row.address_line1),
    address_line2: row.address_line2 == null ? null : String(row.address_line2),
    postal_code: row.postal_code == null ? null : String(row.postal_code),
    city: row.city == null ? null : String(row.city),
    country: String(row.country ?? "FR"),
    internal_notes: row.internal_notes == null ? null : String(row.internal_notes),
    service_memo: row.service_memo == null || String(row.service_memo).trim() === "" ? null : String(row.service_memo),
    allergens_note: row.allergens_note == null ? null : String(row.allergens_note),
    source: row.source as CustomerSource,
    marketing_opt_in: Boolean(row.marketing_opt_in),
    marketing_opt_in_at: row.marketing_opt_in_at == null ? null : String(row.marketing_opt_in_at),
    service_messages_opt_in: Boolean(row.service_messages_opt_in),
    analytics_opt_in: Boolean(row.analytics_opt_in),
    visit_count: Number(row.visit_count ?? 0),
    last_visit_at: row.last_visit_at == null ? null : String(row.last_visit_at),
    first_seen_at: String(row.first_seen_at),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    created_by_user_id: row.created_by_user_id == null ? null : String(row.created_by_user_id),
  };
}

function mapTag(row: Record<string, unknown>): CustomerTag {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    label: String(row.label),
    color: String(row.color ?? "#6366f1"),
    created_at: String(row.created_at),
  };
}

export async function listCustomerTags(restaurantId: string): Promise<CustomerTag[]> {
  const { data, error } = await supabaseServer
    .from("customer_tags")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("label", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapTag);
}

async function fetchTagsForCustomerIds(
  restaurantId: string,
  customerIds: string[]
): Promise<Map<string, CustomerTag[]>> {
  const out = new Map<string, CustomerTag[]>();
  if (customerIds.length === 0) return out;
  const { data, error } = await supabaseServer
    .from("customer_tag_assignments")
    .select("customer_id, customer_tags(id, restaurant_id, label, color, created_at)")
    .in("customer_id", customerIds);
  if (error || !data) return out;
  for (const row of data as Record<string, unknown>[]) {
    const cid = String(row.customer_id);
    const t = row.customer_tags as Record<string, unknown> | null;
    if (!t || !t.id) continue;
    const tag = mapTag(t);
    if (tag.restaurant_id !== restaurantId) continue;
    const list = out.get(cid) ?? [];
    list.push(tag);
    out.set(cid, list);
  }
  return out;
}

function sortKey(sort: CustomerListSort | undefined): { column: string; ascending: boolean } {
  switch (sort) {
    case "created_desc":
      return { column: "created_at", ascending: false };
    case "last_visit_desc":
      return { column: "last_visit_at", ascending: false };
    case "visits_desc":
      return { column: "visit_count", ascending: false };
    case "name_asc":
    default:
      return { column: "display_name", ascending: true };
  }
}

async function customerIdsWithAllTags(restaurantId: string, tagIds: string[]): Promise<string[]> {
  const { data: custRows } = await supabaseServer
    .from("restaurant_customers")
    .select("id")
    .eq("restaurant_id", restaurantId);
  const allowed = new Set((custRows ?? []).map((c: { id: string }) => c.id));

  const { data: assRows } = await supabaseServer
    .from("customer_tag_assignments")
    .select("customer_id, tag_id")
    .in("tag_id", tagIds);

  const byCustomer = new Map<string, Set<string>>();
  for (const row of assRows ?? []) {
    const cid = String((row as { customer_id: string }).customer_id);
    if (!allowed.has(cid)) continue;
    const tid = String((row as { tag_id: string }).tag_id);
    let s = byCustomer.get(cid);
    if (!s) {
      s = new Set();
      byCustomer.set(cid, s);
    }
    s.add(tid);
  }

  const out: string[] = [];
  for (const [cid, s] of byCustomer) {
    if (tagIds.every((t) => s.has(t))) out.push(cid);
  }
  return out;
}

export async function listCustomers(
  restaurantId: string,
  filters: CustomerListFilters = {}
): Promise<{ rows: CustomerWithTags[]; totalApprox: number }> {
  const limit = Math.min(100, Math.max(1, filters.limit ?? 40));
  const offset = Math.max(0, filters.offset ?? 0);
  const activeOnly = filters.activeOnly !== false;
  const sort = sortKey(filters.sort);

  const tagIds = filters.tagIds?.filter(Boolean) ?? [];
  let idFilter: string[] | null = null;
  if (tagIds.length > 0) {
    idFilter = await customerIdsWithAllTags(restaurantId, tagIds);
    if (idFilter.length === 0) return { rows: [], totalApprox: 0 };
  }

  let q = supabaseServer.from("restaurant_customers").select("*", { count: "exact" }).eq("restaurant_id", restaurantId);

  if (activeOnly) q = q.eq("is_active", true);

  if (idFilter) q = q.in("id", idFilter);

  const search = filters.search?.trim();
  if (search) {
    const esc = `%${search.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    q = q.or(
      `display_name.ilike.${esc},email.ilike.${esc},phone.ilike.${esc},city.ilike.${esc},company_name.ilike.${esc}`
    );
  }

  if (filters.source && filters.source !== "all") {
    q = q.eq("source", filters.source);
  }

  if (filters.marketingOnly) {
    q = q.eq("marketing_opt_in", true);
  }

  q = q.order(sort.column, { ascending: sort.ascending, nullsFirst: sort.column === "last_visit_at" ? false : true });

  const { data, error, count } = await q.range(offset, offset + limit - 1);
  if (error || !data) return { rows: [], totalApprox: 0 };

  const rows = (data as Record<string, unknown>[]).map(mapCustomer);

  const tagMap = await fetchTagsForCustomerIds(
    restaurantId,
    rows.map((r) => r.id)
  );
  const withTags: CustomerWithTags[] = rows.map((r) => ({
    ...r,
    tags: tagMap.get(r.id) ?? [],
  }));

  return {
    rows: withTags,
    totalApprox: typeof count === "number" ? count : rows.length,
  };
}

export async function getCustomerById(
  restaurantId: string,
  customerId: string
): Promise<CustomerWithTags | null> {
  const { data, error } = await supabaseServer
    .from("restaurant_customers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", customerId)
    .maybeSingle();
  if (error || !data) return null;
  const c = mapCustomer(data as Record<string, unknown>);
  const tagMap = await fetchTagsForCustomerIds(restaurantId, [c.id]);
  return { ...c, tags: tagMap.get(c.id) ?? [] };
}

export async function findDuplicateCandidates(
  restaurantId: string,
  email: string | null,
  phoneNorm: string | null,
  excludeCustomerId?: string
): Promise<RestaurantCustomer[]> {
  const out: RestaurantCustomer[] = [];
  const em = email?.trim().toLowerCase();
  if (em) {
    let q = supabaseServer
      .from("restaurant_customers")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .ilike("email", em);
    if (excludeCustomerId) q = q.neq("id", excludeCustomerId);
    const { data } = await q.limit(5);
    for (const row of data ?? []) out.push(mapCustomer(row as Record<string, unknown>));
  }
  if (phoneNorm) {
    let q = supabaseServer
      .from("restaurant_customers")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("phone_normalized", phoneNorm);
    if (excludeCustomerId) q = q.neq("id", excludeCustomerId);
    const { data } = await q.limit(5);
    for (const row of data ?? []) {
      const m = mapCustomer(row as Record<string, unknown>);
      if (!out.some((x) => x.id === m.id)) out.push(m);
    }
  }
  return out;
}

export async function createCustomerTag(
  restaurantId: string,
  label: string,
  color?: string
): Promise<CustomerTag | null> {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const { data, error } = await supabaseServer
    .from("customer_tags")
    .insert({
      restaurant_id: restaurantId,
      label: trimmed,
      color: color?.trim() || "#6366f1",
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return mapTag(data as Record<string, unknown>);
}

export type CreateCustomerInput = {
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_locale?: string;
  birth_date?: string | null;
  company_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string;
  internal_notes?: string | null;
  service_memo?: string | null;
  allergens_note?: string | null;
  source?: CustomerSource;
  marketing_opt_in?: boolean;
  service_messages_opt_in?: boolean;
  analytics_opt_in?: boolean;
  created_by_user_id?: string | null;
};

export async function createCustomer(
  restaurantId: string,
  input: CreateCustomerInput
): Promise<RestaurantCustomer | null> {
  const phoneNorm = normalizePhoneForDedup(input.phone);
  const now = new Date().toISOString();
  const marketing = Boolean(input.marketing_opt_in);
  const row = {
    restaurant_id: restaurantId,
    display_name: input.display_name.trim(),
    first_name: input.first_name?.trim() || null,
    last_name: input.last_name?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    phone_normalized: phoneNorm,
    preferred_locale: input.preferred_locale?.trim() || "fr",
    birth_date: input.birth_date || null,
    company_name: input.company_name?.trim() || null,
    address_line1: input.address_line1?.trim() || null,
    address_line2: input.address_line2?.trim() || null,
    postal_code: input.postal_code?.trim() || null,
    city: input.city?.trim() || null,
    country: input.country?.trim() || "FR",
    internal_notes: input.internal_notes?.trim() || null,
    service_memo: input.service_memo?.trim() || null,
    allergens_note: input.allergens_note?.trim() || null,
    source: input.source ?? "other",
    marketing_opt_in: marketing,
    marketing_opt_in_at: marketing ? now : null,
    service_messages_opt_in: input.service_messages_opt_in !== false,
    analytics_opt_in: Boolean(input.analytics_opt_in),
    created_by_user_id: input.created_by_user_id ?? null,
  };

  const { data, error } = await supabaseServer.from("restaurant_customers").insert(row).select("*").maybeSingle();
  if (error || !data) return null;
  const c = mapCustomer(data as Record<string, unknown>);

  await supabaseServer.from("customer_timeline_events").insert({
    restaurant_id: restaurantId,
    customer_id: c.id,
    event_type: "system",
    title: "Fiche créée",
    body: null,
    metadata: { source: row.source },
    occurred_at: now,
    created_by_user_id: input.created_by_user_id ?? null,
  });

  if (marketing) {
    await supabaseServer.from("customer_consent_logs").insert({
      customer_id: c.id,
      consent_key: "marketing",
      previous_value: null,
      new_value: true,
      actor_user_id: input.created_by_user_id ?? null,
      notes: "Création fiche",
    });
  }

  return c;
}

export type UpdateCustomerInput = Partial<
  Omit<CreateCustomerInput, "created_by_user_id"> & {
    is_active: boolean;
  }
> & { id: string };

export async function updateCustomer(
  restaurantId: string,
  customerId: string,
  input: Partial<CreateCustomerInput> & {
    is_active?: boolean;
  },
  actorUserId: string | null
): Promise<RestaurantCustomer | null> {
  const existing = await getCustomerById(restaurantId, customerId);
  if (!existing) return null;

  const phoneNorm =
    input.phone !== undefined ? normalizePhoneForDedup(input.phone) : existing.phone_normalized;

  const patch: Record<string, unknown> = {};
  if (input.display_name !== undefined) patch.display_name = input.display_name.trim();
  if (input.first_name !== undefined) patch.first_name = input.first_name?.trim() || null;
  if (input.last_name !== undefined) patch.last_name = input.last_name?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.phone !== undefined) {
    patch.phone = input.phone?.trim() || null;
    patch.phone_normalized = phoneNorm;
  }
  if (input.preferred_locale !== undefined) patch.preferred_locale = input.preferred_locale?.trim() || "fr";
  if (input.birth_date !== undefined) patch.birth_date = input.birth_date || null;
  if (input.company_name !== undefined) patch.company_name = input.company_name?.trim() || null;
  if (input.address_line1 !== undefined) patch.address_line1 = input.address_line1?.trim() || null;
  if (input.address_line2 !== undefined) patch.address_line2 = input.address_line2?.trim() || null;
  if (input.postal_code !== undefined) patch.postal_code = input.postal_code?.trim() || null;
  if (input.city !== undefined) patch.city = input.city?.trim() || null;
  if (input.country !== undefined) patch.country = input.country?.trim() || "FR";
  if (input.internal_notes !== undefined) patch.internal_notes = input.internal_notes?.trim() || null;
  if (input.service_memo !== undefined) patch.service_memo = input.service_memo?.trim() || null;
  if (input.allergens_note !== undefined) patch.allergens_note = input.allergens_note?.trim() || null;
  if (input.source !== undefined) patch.source = input.source;
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  const now = new Date().toISOString();
  if (input.marketing_opt_in !== undefined) {
    const next = Boolean(input.marketing_opt_in);
    if (next !== existing.marketing_opt_in) {
      patch.marketing_opt_in = next;
      patch.marketing_opt_in_at = next ? now : null;
      await supabaseServer.from("customer_consent_logs").insert({
        customer_id: customerId,
        consent_key: "marketing",
        previous_value: existing.marketing_opt_in,
        new_value: next,
        actor_user_id: actorUserId,
        notes: null,
      });
      await supabaseServer.from("customer_timeline_events").insert({
        restaurant_id: restaurantId,
        customer_id: customerId,
        event_type: "consent_change",
        title: "Consentement communications commerciales",
        body: next ? "Accepté" : "Retiré",
        metadata: { key: "marketing" },
        occurred_at: now,
        created_by_user_id: actorUserId,
      });
    }
  }

  if (input.service_messages_opt_in !== undefined) {
    const next = Boolean(input.service_messages_opt_in);
    if (next !== existing.service_messages_opt_in) {
      patch.service_messages_opt_in = next;
      await supabaseServer.from("customer_consent_logs").insert({
        customer_id: customerId,
        consent_key: "service_messages",
        previous_value: existing.service_messages_opt_in,
        new_value: next,
        actor_user_id: actorUserId,
        notes: null,
      });
    }
  }

  if (input.analytics_opt_in !== undefined) {
    const next = Boolean(input.analytics_opt_in);
    if (next !== existing.analytics_opt_in) {
      patch.analytics_opt_in = next;
      await supabaseServer.from("customer_consent_logs").insert({
        customer_id: customerId,
        consent_key: "analytics",
        previous_value: existing.analytics_opt_in,
        new_value: next,
        actor_user_id: actorUserId,
        notes: null,
      });
    }
  }

  if (Object.keys(patch).length === 0) return existing;

  const { data, error } = await supabaseServer
    .from("restaurant_customers")
    .update(patch)
    .eq("id", customerId)
    .eq("restaurant_id", restaurantId)
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return mapCustomer(data as Record<string, unknown>);
}

export async function assignTagToCustomer(
  restaurantId: string,
  customerId: string,
  tagId: string,
  actorUserId: string | null
): Promise<boolean> {
  const { data: tag } = await supabaseServer
    .from("customer_tags")
    .select("id,label")
    .eq("id", tagId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!tag) return false;

  const { error } = await supabaseServer
    .from("customer_tag_assignments")
    .insert({ customer_id: customerId, tag_id: tagId });
  if (error) {
    if (String(error.code) === "23505") return true;
    return false;
  }

  await supabaseServer.from("customer_timeline_events").insert({
    restaurant_id: restaurantId,
    customer_id: customerId,
    event_type: "tag_change",
    title: "Étiquette ajoutée",
    body: (tag as { label: string }).label,
    metadata: { tag_id: tagId, action: "add" },
    occurred_at: new Date().toISOString(),
    created_by_user_id: actorUserId,
  });
  return true;
}

export async function removeTagFromCustomer(
  restaurantId: string,
  customerId: string,
  tagId: string,
  actorUserId: string | null
): Promise<boolean> {
  const { data: tag } = await supabaseServer
    .from("customer_tags")
    .select("label")
    .eq("id", tagId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const { error } = await supabaseServer
    .from("customer_tag_assignments")
    .delete()
    .eq("customer_id", customerId)
    .eq("tag_id", tagId);
  if (error) return false;

  await supabaseServer.from("customer_timeline_events").insert({
    restaurant_id: restaurantId,
    customer_id: customerId,
    event_type: "tag_change",
    title: "Étiquette retirée",
    body: tag ? String((tag as { label: string }).label) : null,
    metadata: { tag_id: tagId, action: "remove" },
    occurred_at: new Date().toISOString(),
    created_by_user_id: actorUserId,
  });
  return true;
}

export async function addTimelineEvent(
  restaurantId: string,
  customerId: string,
  eventType: TimelineEventType,
  title: string,
  body: string | null,
  metadata: Record<string, unknown>,
  actorUserId: string | null,
  occurredAt?: string
): Promise<CustomerTimelineEvent | null> {
  const { data, error } = await supabaseServer
    .from("customer_timeline_events")
    .insert({
      restaurant_id: restaurantId,
      customer_id: customerId,
      event_type: eventType,
      title: title.trim(),
      body: body?.trim() || null,
      metadata,
      occurred_at: occurredAt ?? new Date().toISOString(),
      created_by_user_id: actorUserId,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    restaurant_id: String(r.restaurant_id),
    customer_id: String(r.customer_id),
    event_type: r.event_type as TimelineEventType,
    title: String(r.title),
    body: r.body == null ? null : String(r.body),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    occurred_at: String(r.occurred_at),
    created_by_user_id: r.created_by_user_id == null ? null : String(r.created_by_user_id),
    created_at: String(r.created_at),
  };
}

export async function registerVisit(
  restaurantId: string,
  customerId: string,
  actorUserId: string | null,
  note?: string | null
): Promise<boolean> {
  const c = await getCustomerById(restaurantId, customerId);
  if (!c) return false;
  const now = new Date().toISOString();
  const { error } = await supabaseServer
    .from("restaurant_customers")
    .update({
      visit_count: c.visit_count + 1,
      last_visit_at: now,
    })
    .eq("id", customerId)
    .eq("restaurant_id", restaurantId);
  if (error) return false;
  await addTimelineEvent(
    restaurantId,
    customerId,
    "visit",
    "Visite enregistrée",
    note?.trim() || null,
    {},
    actorUserId,
    now
  );
  return true;
}

export async function listTimelineEvents(
  restaurantId: string,
  customerId: string,
  limit = 80
): Promise<CustomerTimelineEvent[]> {
  const { data, error } = await supabaseServer
    .from("customer_timeline_events")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("customer_id", customerId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    restaurant_id: String(r.restaurant_id),
    customer_id: String(r.customer_id),
    event_type: r.event_type as TimelineEventType,
    title: String(r.title),
    body: r.body == null ? null : String(r.body),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    occurred_at: String(r.occurred_at),
    created_by_user_id: r.created_by_user_id == null ? null : String(r.created_by_user_id),
    created_at: String(r.created_at),
  }));
}

export async function listConsentLogs(customerId: string, limit = 50): Promise<CustomerConsentLog[]> {
  const { data, error } = await supabaseServer
    .from("customer_consent_logs")
    .select("*")
    .eq("customer_id", customerId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    customer_id: String(r.customer_id),
    consent_key: r.consent_key as ConsentKey,
    previous_value: r.previous_value == null ? null : Boolean(r.previous_value),
    new_value: Boolean(r.new_value),
    recorded_at: String(r.recorded_at),
    actor_user_id: r.actor_user_id == null ? null : String(r.actor_user_id),
    notes: r.notes == null ? null : String(r.notes),
  }));
}

export type CustomerLookupRow = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
};

/** Fiches récentes pour filtrage local (comme les lots préparations). */
export async function listRecentCustomersForLookup(
  restaurantId: string,
  limit = 80
): Promise<CustomerLookupRow[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_customers")
    .select("id, display_name, email, phone")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    display_name: String(r.display_name ?? ""),
    email: r.email == null || String(r.email).trim() === "" ? null : String(r.email).trim(),
    phone: r.phone == null || String(r.phone).trim() === "" ? null : String(r.phone).trim(),
  }));
}

function matchesCustomerLookupRow(row: CustomerLookupRow, searchNorm: string): boolean {
  const parts = [
    row.display_name,
    row.email ?? "",
    row.phone ?? "",
    (row.phone ?? "").replace(/\s+/g, ""),
  ]
    .join(" ")
    .toLowerCase();
  const compact = parts.replace(/\s+/g, "");
  const sn = searchNorm.replace(/\s+/g, "");
  return (
    parts.includes(searchNorm) ||
    searchNorm.includes(parts.trim()) ||
    (sn.length >= 2 && (compact.includes(sn) || sn.includes(compact)))
  );
}

/** Filtre instantané sur une liste locale (nom, email, téléphone). */
export function filterCustomersLocalPool(pool: CustomerLookupRow[], searchRaw: string, max = 10): CustomerLookupRow[] {
  const searchNorm = searchRaw.trim().toLowerCase();
  if (searchNorm.length < 1) return [];
  return pool.filter((r) => matchesCustomerLookupRow(r, searchNorm)).slice(0, max);
}

/** Recherche serveur si pas assez de résultats en local. */
export async function searchCustomersLookup(
  restaurantId: string,
  query: string,
  limit = 12
): Promise<CustomerLookupRow[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const esc = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const { data, error } = await supabaseServer
    .from("restaurant_customers")
    .select("id, display_name, email, phone")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .or(`display_name.ilike.${esc},email.ilike.${esc},phone.ilike.${esc}`)
    .order("display_name", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    display_name: String(r.display_name ?? ""),
    email: r.email == null || String(r.email).trim() === "" ? null : String(r.email).trim(),
    phone: r.phone == null || String(r.phone).trim() === "" ? null : String(r.phone).trim(),
  }));
}

/**
 * Après encaissement : historique sur la fiche client + fréquence (dernière visite + compteur).
 */
export async function recordOrderSettledForCustomer(
  restaurantId: string,
  customerId: string,
  orderId: string,
  totalTtc: number,
  lineSummaries: { dishName: string; qty: number }[]
): Promise<void> {
  const body =
    lineSummaries.length > 0
      ? lineSummaries.map((l) => `· ${l.dishName} × ${l.qty}`).join("\n")
      : "—";
  const title = `Commande encaissée · ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(totalTtc)} TTC`;
  await addTimelineEvent(
    restaurantId,
    customerId,
    "system",
    title,
    body,
    { dining_order_id: orderId, total_ttc: totalTtc },
    null
  );
  const c = await getCustomerById(restaurantId, customerId);
  if (!c) return;
  await supabaseServer
    .from("restaurant_customers")
    .update({
      visit_count: c.visit_count + 1,
      last_visit_at: new Date().toISOString(),
    })
    .eq("id", customerId)
    .eq("restaurant_id", restaurantId);
}

export async function countCustomers(restaurantId: string): Promise<number> {
  const { count, error } = await supabaseServer
    .from("restaurant_customers")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true);
  if (error || count == null) return 0;
  return count;
}

export function buildCustomersCsvExport(rows: CustomerWithTags[]): string {
  const headers = [
    "id",
    "display_name",
    "email",
    "phone",
    "city",
    "tags",
    "source",
    "marketing_opt_in",
    "visit_count",
    "last_visit_at",
    "created_at",
  ];
  const lines = [headers.join(";")];
  for (const r of rows) {
    const tagLabels = r.tags.map((t) => t.label).join(", ");
    const cells = [
      r.id,
      escapeCsv(r.display_name),
      escapeCsv(r.email ?? ""),
      escapeCsv(r.phone ?? ""),
      escapeCsv(r.city ?? ""),
      escapeCsv(tagLabels),
      r.source,
      r.marketing_opt_in ? "oui" : "non",
      String(r.visit_count),
      r.last_visit_at ?? "",
      r.created_at,
    ];
    lines.push(cells.join(";"));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  const t = s.replace(/"/g, '""');
  if (/[;\n\r]/.test(t)) return `"${t}"`;
  return t;
}

export async function fetchAllCustomersForExport(restaurantId: string): Promise<CustomerWithTags[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_customers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  if (error || !data) return [];
  const rows = (data as Record<string, unknown>[]).map(mapCustomer);
  const tagMap = await fetchTagsForCustomerIds(
    restaurantId,
    rows.map((r) => r.id)
  );
  return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}
