import { NextResponse } from "next/server";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import { isNativeAppRequest, NATIVE_BILLING_BLOCKED_MESSAGE } from "@/lib/capacitor/nativeRequest";
import { isStripeConfigured } from "@/lib/billing/config";
import { createPreSignupCheckoutSession } from "@/lib/billing/checkoutService";

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe n'est pas configuré." }, { status: 503 });
  }

  if (await isNativeAppRequest()) {
    return NextResponse.json({ error: NATIVE_BILLING_BLOCKED_MESSAGE }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const owned = await getAccessibleRestaurantsForUser(user.id);
  if (owned.length > 0) {
    return NextResponse.json({ error: "Vous avez déjà un établissement." }, { status: 400 });
  }

  try {
    const result = await createPreSignupCheckoutSession({
      ownerUserId: user.id,
      ownerEmail: user.email,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ url: result.url });
  } catch (err) {
    console.error("[billing/pre-checkout]", err);
    const message =
      err instanceof Error && err.message ? err.message : "Impossible de créer la session Checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
