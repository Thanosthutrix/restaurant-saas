/**
 * POST /api/webhooks/new-restaurant
 *
 * Webhook appelé par Supabase Database Webhooks quand une ligne est insérée
 * dans la table `restaurants`.
 *
 * Configuration Supabase (une seule fois) :
 *   1. Dashboard → Database → Webhooks → "Create a new webhook"
 *   2. Name        : notify-admin-new-restaurant
 *   3. Table       : restaurants / Event : INSERT
 *   4. Type        : HTTP Request → POST
 *   5. URL         : https://<ton-domaine>/api/webhooks/new-restaurant
 *   6. HTTP Headers: ajouter { "x-webhook-secret": "<WEBHOOK_SECRET>" }
 *   7. Ajoute WEBHOOK_SECRET dans tes variables d'environnement.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendEmailViaResend } from "@/lib/messaging/resendSend";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Vérification du secret ─────────────────────────────────────────────
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = req.headers.get("x-webhook-secret");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  // ── Lecture du payload Supabase ────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }

  // Supabase envoie { type: "INSERT", table: "restaurants", record: {...}, old_record: null }
  const record = body.record as Record<string, string | null> | undefined;
  if (!record) {
    return NextResponse.json({ error: "Pas de record." }, { status: 400 });
  }

  const restaurantName = record.name ?? "Inconnu";
  const restaurantId   = record.id   ?? "—";
  const createdAt      = record.created_at
    ? new Date(record.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
    : "—";
  const activityType   = record.activity_type ?? "—";

  const adminEmail = process.env.ADMIN_EMAIL ?? "medhi.thuleau@gmail.com";
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.ubion.fr";

  try {
    await sendEmailViaResend({
      to: adminEmail,
      subject: `🎉 Nouveau client Ubion : ${restaurantName}`,
      text: [
        `Un nouveau restaurant vient de s'inscrire sur Ubion !`,
        ``,
        `Nom          : ${restaurantName}`,
        `Type         : ${activityType}`,
        `Inscrit le   : ${createdAt}`,
        `ID           : ${restaurantId}`,
        ``,
        `👉 Fiche admin : ${appUrl}/admin/restaurants/${restaurantId}`,
      ].join("\n"),
      fromDisplayName: "Ubion Admin",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook/new-restaurant] Erreur envoi email :", err);
    // On renvoie 200 pour ne pas faire boucler Supabase
    return NextResponse.json({ ok: false, reason: "email_failed" });
  }
}
