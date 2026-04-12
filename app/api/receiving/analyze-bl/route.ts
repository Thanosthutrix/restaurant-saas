import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentRestaurant } from "@/lib/auth";
import { runDeliveryNoteBlExtraction } from "@/lib/delivery-note-bl-extract";

/** Dépasse le timeout court des Server Actions (souvent ~60 s) sur Vercel / hébergeurs. */
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const deliveryNoteId = body?.deliveryNoteId;
    const restaurantId = body?.restaurantId;
    if (typeof deliveryNoteId !== "string" || typeof restaurantId !== "string") {
      return NextResponse.json({ ok: false, error: "Paramètres invalides." }, { status: 400 });
    }

    const restaurant = await getCurrentRestaurant();
    if (!restaurant || restaurant.id !== restaurantId) {
      return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
    }

    const res = await runDeliveryNoteBlExtraction(deliveryNoteId, restaurantId);
    if (res.ok) {
      revalidatePath(`/receiving/${deliveryNoteId}`);
      revalidatePath("/livraison");
    }
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur serveur.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
