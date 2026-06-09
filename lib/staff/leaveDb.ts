import { supabaseServer } from "@/lib/supabaseServer";

export type StaffLeaveKind = "leave" | "unavailable";
export type StaffLeaveStatus = "pending" | "validated";

export type StaffLeaveRow = {
  id: string;
  restaurant_id: string;
  staff_member_id: string;
  day: string; // YYYY-MM-DD
  kind: StaffLeaveKind;
  status: StaffLeaveStatus;
  label: string | null;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function mapLeave(row: Record<string, unknown>): StaffLeaveRow | null {
  const day = String(row.day ?? "").trim().slice(0, 10);
  if (!YMD.test(day)) return null;
  const kind = row.kind === "leave" || row.kind === "unavailable" ? row.kind : null;
  if (!kind) return null;
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    staff_member_id: String(row.staff_member_id),
    day,
    kind,
    status: row.status === "pending" ? "pending" : "validated",
    label: row.label == null || String(row.label).trim() === "" ? null : String(row.label).trim(),
  };
}

/**
 * Congés / indisponibilités d'un établissement sur une plage de dates [from, toExclusive[.
 * Par défaut, seules les lignes "validated" sont retournées (ingestion algorithme).
 */
export async function listStaffLeaveInRange(
  restaurantId: string,
  fromYmdInclusive: string,
  toYmdExclusive: string,
  opts?: { includePending?: boolean }
): Promise<StaffLeaveRow[]> {
  let q = supabaseServer
    .from("staff_leave")
    .select("id, restaurant_id, staff_member_id, day, kind, status, label")
    .eq("restaurant_id", restaurantId)
    .gte("day", fromYmdInclusive)
    .lt("day", toYmdExclusive)
    .order("day", { ascending: true });

  if (!opts?.includePending) q = q.eq("status", "validated");

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Record<string, unknown>[])
    .map(mapLeave)
    .filter((r): r is StaffLeaveRow => r != null);
}

/** Upsert d'une absence (rétro-enregistrement depuis le wizard). */
export async function upsertStaffLeave(params: {
  restaurantId: string;
  staffMemberId: string;
  day: string;
  kind: StaffLeaveKind;
  status?: StaffLeaveStatus;
  label?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabaseServer.from("staff_leave").upsert(
    {
      restaurant_id: params.restaurantId,
      staff_member_id: params.staffMemberId,
      day: params.day,
      kind: params.kind,
      status: params.status ?? "validated",
      label: params.label ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "staff_member_id,day,kind" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
