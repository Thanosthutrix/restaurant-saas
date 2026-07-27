import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendTestPushToUser } from "@/lib/push/sendTestPush";

export const dynamic = "force-dynamic";

/** Envoie une notification test à l'utilisateur connecté (diagnostic). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Non connecté." }, { status: 401 });
  }

  const result = await sendTestPushToUser(user.id);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
