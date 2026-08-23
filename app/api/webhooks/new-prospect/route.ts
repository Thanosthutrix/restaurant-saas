/**
 * POST /api/webhooks/new-prospect
 * Webhook optionnel (Supabase INSERT prospects) — email admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { notifyAdminNewProspect } from "@/lib/admin/notifyNewProspect";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = req.headers.get("x-webhook-secret");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }

  const record = body.record as Record<string, string | null> | undefined;
  if (!record?.id || !record.contact_email) {
    return NextResponse.json({ error: "Pas de record." }, { status: 400 });
  }

  try {
    await notifyAdminNewProspect({
      contactName: record.contact_name,
      contactEmail: record.contact_email,
      restaurantName: record.restaurant_name,
      source: record.source ?? "outbound",
      prospectId: record.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook/new-prospect] error:", err);
    return NextResponse.json({ ok: false, reason: "notify_failed" });
  }
}
