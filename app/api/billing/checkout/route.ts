import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { isNativeAppRequest, NATIVE_BILLING_BLOCKED_MESSAGE } from "@/lib/capacitor/nativeRequest";
import { isStripeConfigured } from "@/lib/billing/config";
import {
  createBillingCheckoutSession,
  verifyRestaurantOwner,
} from "@/lib/billing/checkoutService";

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

  try {
    const result = await createBillingCheckoutSession({
      restaurantId,
      ownerUserId: user.id,
      ownerEmail: verified.email,
      restaurantName: verified.name,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ url: result.url });
  } catch (err) {
    console.error("[billing/checkout]", err);
    const message =
      err instanceof Error && err.message ? err.message : "Impossible de créer la session Checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
