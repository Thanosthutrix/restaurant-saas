import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSignupEntitlement } from "@/lib/pro/signupEntitlementDb";
import { computeTrialDaysRemaining } from "@/lib/pro/trialStatus";
import {
  getLatestTrialRequestForUser,
  getPendingTrialRequestForUser,
} from "@/lib/pro/trialRequestDb";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const entitlement = await getActiveSignupEntitlement(user.id);
  if (entitlement?.kind === "trial" && entitlement.expires_at) {
    return NextResponse.json({
      status: "approved",
      daysRemaining: computeTrialDaysRemaining(entitlement.expires_at),
      expiresAt: entitlement.expires_at,
    });
  }

  const pending = await getPendingTrialRequestForUser(user.id);
  if (pending) {
    return NextResponse.json({ status: "pending" });
  }

  const latest = await getLatestTrialRequestForUser(user.id);
  if (latest?.status === "rejected") {
    return NextResponse.json({ status: "rejected" });
  }

  return NextResponse.json({ status: "none" });
}
