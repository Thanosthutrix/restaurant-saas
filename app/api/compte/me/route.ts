import { NextResponse } from "next/server";
import { getCurrentConsumerProfile } from "@/lib/public/consumer/consumerDb";

export async function GET() {
  const profile = await getCurrentConsumerProfile();
  if (!profile) {
    return NextResponse.json({ profile: null }, { status: 401 });
  }
  return NextResponse.json({ profile });
}
