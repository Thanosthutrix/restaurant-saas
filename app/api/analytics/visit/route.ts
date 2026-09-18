import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

const VISIT_COOKIE = "ubion_vid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

function safePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.length > 500) return null;
  return path.split("?")[0] || "/";
}

/** Enregistre une visite page sur le site public (cookie session anonyme). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { path?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const path = safePath(body.path);
  if (!path) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let sessionKey = req.cookies.get(VISIT_COOKIE)?.value?.trim();
  let setCookie = false;
  if (!sessionKey) {
    sessionKey = randomUUID();
    setCookie = true;
  }

  const { error } = await supabaseServer.from("platform_site_visits").insert({
    session_key: sessionKey,
    path,
  });

  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  if (setCookie) {
    res.cookies.set(VISIT_COOKIE, sessionKey, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
