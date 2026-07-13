import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { completeMetaOAuthFromToken } from "@/lib/meta/completeOAuth";

export async function POST(request: Request) {
  let body: { state?: string; accessToken?: string };
  try {
    body = (await request.json()) as { state?: string; accessToken?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Corps de requête invalide." }, { status: 400 });
  }

  const result = await completeMetaOAuthFromToken({
    state: body.state ?? "",
    accessToken: body.accessToken ?? "",
  });

  if (result.ok) {
    revalidatePath(`/restaurants/${result.restaurantId}/edit`);
    revalidatePath(`/restaurant/${result.restaurantId}`);
    revalidatePath("/");
    return NextResponse.json({ ok: true, restaurantId: result.restaurantId });
  }

  return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
}
