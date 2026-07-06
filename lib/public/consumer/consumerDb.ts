import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import type { ConsumerProfile, ConsumerReservationSummary } from "@/lib/public/consumer/types";
import { normalizePhoneForDedup } from "@/lib/customers/phoneNormalize";

function mapProfile(row: Record<string, unknown>, email: string | null): ConsumerProfile {
  return {
    user_id: String(row.user_id),
    first_name: String(row.first_name ?? ""),
    last_name: String(row.last_name ?? ""),
    phone: row.phone == null ? null : String(row.phone),
    phone_normalized: row.phone_normalized == null ? null : String(row.phone_normalized),
    marketing_opt_in: Boolean(row.marketing_opt_in),
    email,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getConsumerProfileByUserId(
  userId: string,
  email: string | null = null
): Promise<ConsumerProfile | null> {
  const { data, error } = await supabaseServer
    .from("consumer_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapProfile(data as Record<string, unknown>, email);
}

export const getCurrentConsumerProfile = cache(async function getCurrentConsumerProfile(): Promise<ConsumerProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getConsumerProfileByUserId(user.id, user.email ?? null);
});

export async function upsertConsumerProfile(input: {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  marketingOptIn: boolean;
}): Promise<ConsumerProfile | null> {
  const phoneNorm = input.phone ? normalizePhoneForDedup(input.phone) : null;
  const { data, error } = await supabaseServer
    .from("consumer_profiles")
    .upsert(
      {
        user_id: input.userId,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        phone_normalized: phoneNorm,
        marketing_opt_in: input.marketingOptIn,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .maybeSingle();

  if (error || !data) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return mapProfile(data as Record<string, unknown>, user?.email ?? null);
}

export async function findRestaurantCustomerForConsumer(
  restaurantId: string,
  consumer: ConsumerProfile
): Promise<string | null> {
  const { data: byUser } = await supabaseServer
    .from("restaurant_customers")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("consumer_user_id", consumer.user_id)
    .maybeSingle();

  if (byUser?.id) return String(byUser.id);

  if (consumer.email) {
    const { data: byEmail } = await supabaseServer
      .from("restaurant_customers")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .ilike("email", consumer.email.trim())
      .maybeSingle();

    if (byEmail?.id) {
      await supabaseServer
        .from("restaurant_customers")
        .update({ consumer_user_id: consumer.user_id })
        .eq("id", byEmail.id);
      return String(byEmail.id);
    }
  }

  return null;
}

export async function listConsumerReservations(
  userId: string
): Promise<ConsumerReservationSummary[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_reservations")
    .select("id, restaurant_id, starts_at, party_size, status, notes, restaurants(name)")
    .eq("consumer_user_id", userId)
    .order("starts_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => {
    const rest = row.restaurants as { name?: string } | null;
    return {
      id: String(row.id),
      restaurant_id: String(row.restaurant_id),
      restaurant_name: rest?.name ?? "Restaurant",
      starts_at: String(row.starts_at),
      party_size: Number(row.party_size),
      status: String(row.status),
      notes: row.notes == null ? null : String(row.notes),
    };
  });
}

export async function isRestaurantPublicListed(restaurantId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("restaurants")
    .select("is_public_listed")
    .eq("id", restaurantId)
    .maybeSingle();

  return Boolean((data as { is_public_listed?: boolean } | null)?.is_public_listed);
}
