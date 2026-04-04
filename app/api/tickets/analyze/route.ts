import { NextResponse } from "next/server";
import type { TicketItem } from "@/lib/ticket-analysis";
import { analyzeTicketImage } from "@/lib/ticket-analysis";

export type AnalyzeTicketResponse = {
  items: TicketItem[];
};

export async function POST(request: Request) {
  try {
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
