import { NextRequest, NextResponse } from "next/server";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";

/** Redirection post-connexion (admin → /admin, sinon parcours pro habituel). */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const path = await resolvePostLoginPath(next);
  return NextResponse.redirect(new URL(path, request.url));
}
