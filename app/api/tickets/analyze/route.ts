import { NextResponse } from "next/server";
import type { TicketItem } from "@/lib/ticket-analysis";
import { analyzeTicketImage } from "@/lib/ticket-analysis";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

export type AnalyzeTicketResponse = {
  items: TicketItem[];
};

export async function POST(request: Request) {
  try {
    // Route coûteuse (OpenAI Vision) : réservée aux utilisateurs authentifiés
    // pour éviter tout abus / DoS financier depuis l'extérieur.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    // Plafond par utilisateur pour borner la consommation OpenAI.
    const limited = rateLimit(`tickets-analyze:${user.id}`, 30, 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Trop de requêtes, réessayez dans un instant." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
      );
    }

    const body = await request.json();
    const imageUrl = body?.image_url;
    if (typeof imageUrl !== "string" || !imageUrl) {
      return NextResponse.json(
        { error: "image_url required" },
        { status: 400 }
      );
    }

    const { items, error } = await analyzeTicketImage(imageUrl);
    if (error) {
      console.warn("[tickets/analyze] analyzer error", error);
    }
    return NextResponse.json({ items } as AnalyzeTicketResponse);
  } catch (e) {
    console.error("[tickets/analyze] error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
