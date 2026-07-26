import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/meta/config";
import { completeMetaOAuthFromCode } from "@/lib/meta/completeOAuth";

function revalidateSocialPaths(restaurantId: string) {
  revalidatePath(`/restaurants/${restaurantId}/edit`);
  revalidatePath(`/restaurant/${restaurantId}`);
  revalidatePath("/communication");
  revalidatePath("/");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const fallback = `${getAppBaseUrl()}/communication?meta=error`;

  if (oauthError || !code || !stateRaw) {
    return NextResponse.redirect(fallback);
  }

  const result = await completeMetaOAuthFromCode({ code, state: stateRaw });
  if (result.ok) {
    revalidateSocialPaths(result.restaurantId);
    return NextResponse.redirect(`${getAppBaseUrl()}/communication?meta=connected`);
  }

  console.error("[meta/oauth/callback]", result.error);
  return NextResponse.redirect(fallback);
}
