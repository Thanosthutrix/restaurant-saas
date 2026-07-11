import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/google/config";
import { upsertRestaurantGoogleConnection } from "@/lib/google/googleDb";
import {
  exchangeGoogleOAuthCode,
  fetchGoogleUserEmail,
} from "@/lib/google/oauthClient";
import { decodeGoogleOAuthState } from "@/lib/google/oauthState";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const state = stateRaw ? decodeGoogleOAuthState(stateRaw) : null;
  const fallbackEdit = `${getAppBaseUrl()}/dashboard`;

  if (oauthError || !code || !state) {
    const target = state
      ? `${getAppBaseUrl()}/restaurants/${state.restaurantId}/edit?google=error`
      : `${fallbackEdit}?google=error`;
    return NextResponse.redirect(target);
  }

  const user = await getCurrentUser();
  if (!user || user.id !== state.userId) {
    return NextResponse.redirect(`${getAppBaseUrl()}/login?next=/restaurants/${state.restaurantId}/edit`);
  }

  try {
    const tokens = await exchangeGoogleOAuthCode(code);
    const profile = await fetchGoogleUserEmail(tokens.access_token);

    await upsertRestaurantGoogleConnection({
      restaurantId: state.restaurantId,
      googleAccountEmail: profile.email,
      googleAccountId: profile.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresInSec: tokens.expires_in,
    });

    return NextResponse.redirect(
      `${getAppBaseUrl()}/restaurants/${state.restaurantId}/edit?google=connected`
    );
  } catch (err) {
    console.error("[google/oauth/callback]", err);
    return NextResponse.redirect(
      `${getAppBaseUrl()}/restaurants/${state.restaurantId}/edit?google=error`
    );
  }
}
