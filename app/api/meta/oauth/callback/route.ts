import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/meta/config";
import { upsertMetaUserConnection } from "@/lib/meta/metaDb";
import {
  exchangeMetaLongLivedToken,
  exchangeMetaOAuthCode,
  fetchMetaUserProfile,
} from "@/lib/meta/oauthClient";
import { decodeMetaOAuthState } from "@/lib/meta/oauthState";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const state = stateRaw ? decodeMetaOAuthState(stateRaw) : null;
  const fallbackEdit = `${getAppBaseUrl()}/dashboard`;

  if (oauthError || !code || !state) {
    const target = state
      ? `${getAppBaseUrl()}/restaurants/${state.restaurantId}/edit?meta=error`
      : `${fallbackEdit}?meta=error`;
    return NextResponse.redirect(target);
  }

  const user = await getCurrentUser();
  if (!user || user.id !== state.userId) {
    return NextResponse.redirect(
      `${getAppBaseUrl()}/login?next=/restaurants/${state.restaurantId}/edit`
    );
  }

  try {
    const short = await exchangeMetaOAuthCode(code);
    const long = await exchangeMetaLongLivedToken(short.access_token);
    const profile = await fetchMetaUserProfile(long.access_token);

    await upsertMetaUserConnection({
      restaurantId: state.restaurantId,
      metaAccountName: profile.name,
      userAccessToken: long.access_token,
      expiresInSec: long.expires_in,
    });

    return NextResponse.redirect(
      `${getAppBaseUrl()}/restaurants/${state.restaurantId}/edit?meta=connected`
    );
  } catch (err) {
    console.error("[meta/oauth/callback]", err);
    return NextResponse.redirect(
      `${getAppBaseUrl()}/restaurants/${state.restaurantId}/edit?meta=error`
    );
  }
}
