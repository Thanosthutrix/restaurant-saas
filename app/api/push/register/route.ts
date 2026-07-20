import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentRestaurant } from "@/lib/auth";
import { upsertUserPushToken, type PushPlatform } from "@/lib/push/pushTokenDb";

type Body = {
  token?: string;
  platform?: string;
};

function parsePlatform(raw: string | undefined): PushPlatform | null {
  if (raw === "ios" || raw === "android" || raw === "web") return raw;
  return null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
