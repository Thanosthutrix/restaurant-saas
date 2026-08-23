import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { isNativeAppRequest, NATIVE_BILLING_BLOCKED_MESSAGE } from "@/lib/capacitor/nativeRequest";
import { isStripeConfigured } from "@/lib/billing/config";
import { createBillingPortalSession, verifyRestaurantOwner } from "@/lib/billing/checkoutService";

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe n'est pas configuré." }, { status: 503 });
  }

  if (await isNativeAppRequest()) {
    return NextResponse.json({ error: NATIVE_BILLING_BLOCKED_MESSAGE }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const ctx = await getShellAccessContext(user.id);
  const restaurantId = ctx?.currentRestaurantId;
  if (!restaurantId) {
    return NextResponse.json({ error: "Aucun restaurant actif." }, { status: 400 });
  }

  const verified = await verifyRestaurantOwner(restaurantId, user.id);
  if ("error" in verified) {
    return NextResponse.json({ error: verified.error }, { status: 403 });
  }

  const result = await createBillingPortalSession(restaurantId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ url: result.url });
}
