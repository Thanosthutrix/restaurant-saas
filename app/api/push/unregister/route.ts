import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { unregisterUserPushToken } from "@/lib/push/pushTokenDb";
import { supabaseServer } from "@/lib/supabaseServer";

type Body = {
  token?: string;
};

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

/** Retire le token push de l'utilisateur connecté (déconnexion appareil). */
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
  if (!token || token.length < 8) {
    return NextResponse.json({ ok: false, error: "Token push invalide." }, { status: 400 });
  }

  const { error } = await unregisterUserPushToken(user.id, token);
  if (error) {
    console.error("[push/unregister]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
