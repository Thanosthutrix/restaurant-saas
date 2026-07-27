import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser, getCurrentRestaurant } from "@/lib/auth";
import { upsertUserPushToken, type PushPlatform } from "@/lib/push/pushTokenDb";
import { supabaseServer } from "@/lib/supabaseServer";

type Body = {
  token?: string;
  platform?: string;
};

function parsePlatform(raw: string | undefined): PushPlatform | null {
  if (raw === "ios" || raw === "android" || raw === "web") return raw;
  return null;
}

async function resolveAuthenticatedUser(request: Request): Promise<User | null> {
  const fromCookie = await getCurrentUser();
  if (fromCookie) return fromCookie;

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer) return null;

  const { data, error } = await supabaseServer.auth.getUser(bearer);
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(request: Request) {
  const user = await resolveAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Non connecté." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide." }, { status: 400 });
  }

  const token = body.token?.trim();
  const platform = parsePlatform(body.platform);
  if (!token || token.length < 8) {
    return NextResponse.json({ ok: false, error: "Token push invalide." }, { status: 400 });
  }
  if (!platform || platform === "web") {
    return NextResponse.json({ ok: false, error: "Plateforme native requise." }, { status: 400 });
  }

  const restaurant = await getCurrentRestaurant();
  const { error } = await upsertUserPushToken({
    userId: user.id,
    restaurantId: restaurant?.id ?? null,
    token,
    platform,
  });

  if (error) {
    console.error("[push/register] upsert failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
