import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { completePaOAuthFromCode } from "@/lib/pa/completeOAuth";
import { completePlatformPaOAuthFromCode } from "@/lib/platform/completePlatformPaOAuth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const fallback = new URL("/supplier-invoices?pa=error", url.origin);

  if (oauthError || !code || !stateRaw) {
    return NextResponse.redirect(fallback);
  }

  const platformResult = await completePlatformPaOAuthFromCode({ code, state: stateRaw });
  if (platformResult) {
    if (platformResult.ok) {
      revalidatePath("/admin/company/invoices");
      revalidatePath("/admin/company/emitted");
      return NextResponse.redirect(new URL("/admin/company/invoices?pa=connected", url.origin));
    }
    console.error("[pa/oauth/callback] platform", platformResult.error);
    return NextResponse.redirect(new URL("/admin/company/invoices?pa=error", url.origin));
  }

  const result = await completePaOAuthFromCode({ code, state: stateRaw });
  if (result.ok) {
    revalidatePath("/supplier-invoices");
    return NextResponse.redirect(new URL(result.redirectPath, url.origin));
  }

  console.error("[pa/oauth/callback]", result.error);
  return NextResponse.redirect(fallback);
}
