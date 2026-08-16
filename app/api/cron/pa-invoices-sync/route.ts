import { NextResponse } from "next/server";
import { syncAllActivePaConnections } from "@/lib/pa/syncInvoices";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron périodique — sonde GET /invoices?direction=in pour chaque restaurant connecté à une PA. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const results = await syncAllActivePaConnections();
  console.info("[cron/pa-invoices-sync]", JSON.stringify(results));

  return NextResponse.json({ ok: true, results });
}
