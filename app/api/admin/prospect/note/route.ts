/**
 * POST /api/admin/prospect/note
 * Ajoute une note interne sur un prospect.
 */

import { NextRequest, NextResponse } from "next/server";
import { addProspectNoteRecord, isCurrentUserAdmin } from "@/lib/admin";
import { logAdminSupportActivity } from "@/lib/admin/supportActivityDb";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const [isAdmin, user] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const { prospectId, content } = body as { prospectId?: string; content?: string };

  if (!prospectId || !content?.trim()) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const result = await addProspectNoteRecord({
    prospectId,
    authorId: user.id,
    content,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  await logAdminSupportActivity({
    authorId: user.id,
    prospectId,
    action: "prospect_note",
    summary: content.trim().slice(0, 200),
    metadata: { fullLength: content.trim().length },
  });

  return NextResponse.json({ ok: true });
}
