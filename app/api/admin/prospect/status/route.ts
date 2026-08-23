/**
 * PATCH /api/admin/prospect
 * Met à jour le statut d'un prospect.
 */

import { NextRequest, NextResponse } from "next/server";
import { isCurrentUserAdmin, updateProspectStatusRecord } from "@/lib/admin";
import { logAdminSupportActivity } from "@/lib/admin/supportActivityDb";
import { getCurrentUser } from "@/lib/auth";
import type { AdminProspectStatus } from "@/lib/admin/types";

const VALID_STATUSES: AdminProspectStatus[] = [
  "new",
  "contacted",
  "demo_scheduled",
  "invited",
  "signed_up",
  "lost",
];

export async function PATCH(req: NextRequest) {
  const [isAdmin, user] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const { prospectId, status } = body as { prospectId?: string; status?: AdminProspectStatus };

  if (!prospectId || !status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const result = await updateProspectStatusRecord({ prospectId, status });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  await logAdminSupportActivity({
    authorId: user.id,
    prospectId,
    action: "prospect_status",
    summary: `Statut prospect → ${status}`,
    metadata: { status },
  });

  return NextResponse.json({ ok: true });
}
