import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import { createTrialRequest, getPendingTrialRequestForUser } from "@/lib/pro/trialRequestDb";
import { getActiveSignupEntitlement } from "@/lib/pro/signupEntitlementDb";
import { notifyAdminTrialRequest } from "@/lib/pro/notifyTrialRequest";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const owned = await getAccessibleRestaurantsForUser(user.id);
  if (owned.length > 0) {
    return NextResponse.json({ error: "Vous avez déjà un établissement." }, { status: 400 });
  }

  const entitlement = await getActiveSignupEntitlement(user.id);
  if (entitlement) {
    return NextResponse.json({ error: "Vous avez déjà accès à la création d'établissement." }, { status: 400 });
  }

  const pending = await getPendingTrialRequestForUser(user.id);
  if (pending) {
    return NextResponse.json({ error: "Une demande est déjà en cours." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const restaurantName =
    typeof body.restaurantName === "string" ? body.restaurantName.trim() : null;
  const message = typeof body.message === "string" ? body.message.trim() : null;

  const result = await createTrialRequest({
    userId: user.id,
    contactEmail: user.email,
    restaurantName,
    message,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await notifyAdminTrialRequest({
    contactEmail: user.email,
    restaurantName,
    message,
    requestId: result.id,
  });

  return NextResponse.json({ ok: true, id: result.id });
}
