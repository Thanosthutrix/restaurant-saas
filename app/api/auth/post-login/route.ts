import { NextRequest, NextResponse } from "next/server";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { resolveMfaRedirect } from "@/lib/auth/mfaGate";

/** Redirection post-connexion (MFA → admin → parcours pro habituel). */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const destination = await resolvePostLoginPath(next);
  const mfaRedirect = await resolveMfaRedirect(destination);
  const path = mfaRedirect ?? destination;
  return NextResponse.redirect(new URL(path, request.url));
}
