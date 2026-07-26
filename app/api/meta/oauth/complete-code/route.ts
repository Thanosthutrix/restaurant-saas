import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { completeMetaOAuthFromCode } from "@/lib/meta/completeOAuth";

function revalidateSocialPaths(restaurantId: string) {
  revalidatePath(`/restaurants/${restaurantId}/edit`);
  revalidatePath(`/restaurant/${restaurantId}`);
  revalidatePath("/communication");
  revalidatePath("/");
}

export async function POST(request: Request) {
  let body: { code?: string; state?: string };
  try {
    body = (await request.json()) as { code?: string; state?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Corps de requête invalide." }, { status: 400 });
  }

  const result = await completeMetaOAuthFromCode({
    code: body.code ?? "",
    state: body.state ?? "",
  });

  if (result.ok) {
    revalidateSocialPaths(result.restaurantId);
    return NextResponse.json({ ok: true, restaurantId: result.restaurantId });
  }

  return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
}
