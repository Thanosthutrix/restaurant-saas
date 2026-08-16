import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { buildOpeningHoursSchedule } from "@/lib/public/formatOpeningHours";
import type { PlanningDayKey } from "@/lib/staff/planningHoursTypes";
import { minutesFromMidnight, normalizeClockToHhMm } from "@/lib/staff/planningHoursTypes";
import {
  isOnlineReservationSource,
  type ReservationCapacitySettings,
} from "./capacitySettings";
import { getReservationCapacitySettings } from "./capacitySettingsDb";
import { resolveCapacityLimits } from "./tableCapacity";
import { listReservationsForParisDay, reservationStartsUtc } from "./reservationsDb";
import type { ReservationSource } from "./types";

const MAX_SLOTS_RETURNED = 8;

const WEEKDAY_TO_KEY: Record<string, PlanningDayKey> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

export type ReservationChannel = "online" | "staff";

export function parisTodayYmd(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + days, 12, 0, 0);
  return new Date(utc).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

export function planningDayKeyFromYmd(ymd: string): PlanningDayKey {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    weekday: "short",
  }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
  return WEEKDAY_TO_KEY[wd] ?? "mon";
}

/** Parse « aujourd'hui », « demain », JJ/MM[/AAAA]. */
export function parseFrenchDateInput(text: string, referenceYmd = parisTodayYmd()): string | null {
  const raw = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!raw) return null;
  if (raw === "aujourd'hui" || raw === "aujourdhui") return referenceYmd;
  if (raw === "demain") return addDaysToYmd(referenceYmd, 1);

  const m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(raw);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] ? Number(m[3]) : Number(referenceYmd.slice(0, 4));
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const ymd = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (Number.isNaN(Date.parse(`${ymd}T12:00:00`))) return null;
  return ymd;
}

export function parseTimeHmInput(text: string): string | null {
  const raw = text.trim().toLowerCase().replace(/\s+/g, "");
  const withColon = raw.replace(/h/g, ":");
  const hmOnly = /^(\d{1,2})$/.exec(withColon);
  if (hmOnly) {
    const h = Number(hmOnly[1]);
    if (h < 0 || h > 23) return null;
    return `${String(h).padStart(2, "0")}:00`;
  }
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(withColon);
  if (!m) return normalizeClockToHhMm(withColon);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function loadRestaurantHours(restaurantId: string) {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select("planning_opening_hours, closed_days_of_week")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    return { schedule: buildOpeningHoursSchedule({}, []), error: error?.message ?? "Restaurant introuvable." };
  }

  const closedDays = Array.isArray(data.closed_days_of_week)
    ? (data.closed_days_of_week as number[])
    : [];

  return {
    schedule: buildOpeningHoursSchedule(data.planning_opening_hours, closedDays),
    error: null as string | null,
  };
}

function countOverlappingCovers(
  activeReservations: { party_size: number; starts_at: string; ends_at: string; source: ReservationSource }[],
  slotStartMs: number,
  slotEndMs: number,
  extraPartySize: number,
  channel: ReservationChannel
): { total: number; online: number } {
  let total = extraPartySize;
  let online = channel === "online" ? extraPartySize : 0;

  for (const res of activeReservations) {
    const rStart = new Date(res.starts_at).getTime();
    const rEnd = new Date(res.ends_at).getTime();
    if (!overlaps(slotStartMs, slotEndMs, rStart, rEnd)) continue;
    total += res.party_size;
    if (isOnlineReservationSource(res.source)) {
      online += res.party_size;
    }
  }

  return { total, online };
}

function slotFitsLimits(
  covers: { total: number; online: number },
  limits: Awaited<ReturnType<typeof resolveCapacityLimits>>,
  channel: ReservationChannel,
  enforce: boolean
): boolean {
  if (!enforce) return true;
  if (covers.total > limits.maxCoversPerSlot) return false;
  if (channel === "online" && covers.online > limits.maxOnlineCoversPerSlot) return false;
  return true;
}

/** Créneaux disponibles (heure Paris HH:mm) pour une date et un nombre de couverts. */
async function computeAvailableSlots(params: {
  restaurantId: string;
  ymd: string;
  partySize: number;
  durationMinutes: number;
  channel: ReservationChannel;
  settings?: ReservationCapacitySettings;
  limits?: Awaited<ReturnType<typeof resolveCapacityLimits>>;
}): Promise<{ slots: string[]; error: string | null }> {
  const settings = params.settings ?? (await getReservationCapacitySettings(params.restaurantId));
  const limits = params.limits ?? (await resolveCapacityLimits(params.restaurantId, settings));

  if (params.channel === "online") {
    if (!settings.online_reservations_enabled) {
      return { slots: [], error: "Les réservations en ligne sont désactivées." };
    }
    if (params.partySize > limits.maxPartySizeOnline) {
      return {
        slots: [],
        error: `Maximum ${limits.maxPartySizeOnline} convives en ligne pour cet établissement.`,
      };
    }
  } else if (params.partySize > limits.maxPartySizeStaff) {
    return {
      slots: [],
      error: `Maximum ${limits.maxPartySizeStaff} convives par réservation.`,
    };
  }

  const enforce =
    params.channel === "online"
      ? settings.enforce_availability_online
      : settings.enforce_availability_staff;

  const { schedule, error: hoursError } = await loadRestaurantHours(params.restaurantId);
  if (hoursError) return { slots: [], error: hoursError };

  const dayKey = planningDayKeyFromYmd(params.ymd);
  const day = schedule.find((d) => d.key === dayKey);
  if (!day || day.isClosed || day.bands.length === 0) {
    return { slots: [], error: "Le restaurant est fermé ce jour-là." };
  }

  const { data: reservations, error: resErr } = await listReservationsForParisDay(
    params.restaurantId,
    params.ymd
  );
  if (resErr) return { slots: [], error: resErr.message };

  const activeReservations = reservations.filter(
    (r) => r.status !== "cancelled" && r.status !== "no_show"
  );

  const nowParisYmd = parisTodayYmd();
  const minLead = settings.min_lead_minutes;
  const nowMinutes =
    params.ymd === nowParisYmd
      ? (() => {
          const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Paris",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).formatToParts(new Date());
          const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
          const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
          return h * 60 + m + minLead;
        })()
      : 0;

  const slotStep = settings.slot_step_minutes;
  const slots: string[] = [];

  for (const band of day.bands) {
    const bandStart = minutesFromMidnight(band.start);
    const bandEnd = minutesFromMidnight(band.end);
    if (bandStart == null || bandEnd == null) continue;

    for (
      let startMin = bandStart;
      startMin + params.durationMinutes <= bandEnd;
      startMin += slotStep
    ) {
      if (startMin < nowMinutes) continue;

      const h = Math.floor(startMin / 60);
      const m = startMin % 60;
      const timeHm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      const { data: startsAt, error: startErr } = await reservationStartsUtc(params.ymd, timeHm);
      if (startErr || !startsAt) continue;

      const slotStartMs = new Date(startsAt).getTime();
      const slotEndMs = slotStartMs + params.durationMinutes * 60_000;

      const covers = countOverlappingCovers(
        activeReservations,
        slotStartMs,
        slotEndMs,
        params.partySize,
        params.channel
      );

      if (slotFitsLimits(covers, limits, params.channel, enforce)) {
        slots.push(timeHm);
      }
    }
  }

  return { slots, error: null };
}

export async function listAvailableReservationSlots(params: {
  restaurantId: string;
  ymd: string;
  partySize: number;
  durationMinutes?: number;
  limit?: number;
  channel?: ReservationChannel;
}): Promise<{ slots: string[]; error: string | null }> {
  const settings = await getReservationCapacitySettings(params.restaurantId);
  const duration = params.durationMinutes ?? settings.default_duration_minutes;
  const result = await computeAvailableSlots({
    restaurantId: params.restaurantId,
    ymd: params.ymd,
    partySize: params.partySize,
    durationMinutes: duration,
    channel: params.channel ?? "online",
    settings,
  });
  if (result.error) return result;

  const limit = params.limit ?? MAX_SLOTS_RETURNED;
  return { slots: result.slots.slice(0, limit), error: null };
}

/** Vérifie un créneau précis. */
export async function checkReservationSlotAvailable(params: {
  restaurantId: string;
  ymd: string;
  timeHm: string;
  partySize: number;
  durationMinutes?: number;
  channel?: ReservationChannel;
}): Promise<{ available: boolean; error: string | null }> {
  const normalized = parseTimeHmInput(params.timeHm) ?? params.timeHm;
  if (!normalized) return { available: false, error: "Heure invalide." };

  const settings = await getReservationCapacitySettings(params.restaurantId);
  const duration = params.durationMinutes ?? settings.default_duration_minutes;
  const channel = params.channel ?? "online";

  const { slots, error } = await computeAvailableSlots({
    restaurantId: params.restaurantId,
    ymd: params.ymd,
    partySize: params.partySize,
    durationMinutes: duration,
    channel,
    settings,
  });

  if (error) return { available: false, error };
  return { available: slots.includes(normalized), error: null };
}

export async function isReservationSlotAvailable(params: {
  restaurantId: string;
  ymd: string;
  timeHm: string;
  partySize: number;
  durationMinutes?: number;
  channel?: ReservationChannel;
}): Promise<boolean> {
  const result = await checkReservationSlotAvailable(params);
  return result.available;
}

/** Infos capacité pour affichage B2B (settings). */
export async function getReservationCapacitySummary(restaurantId: string) {
  const settings = await getReservationCapacitySettings(restaurantId);
  const limits = await resolveCapacityLimits(restaurantId, settings);
  return { settings, limits };
}
